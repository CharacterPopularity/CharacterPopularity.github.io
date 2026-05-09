// script.js (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getDatabase, ref, get, set, onValue } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

/* ---------------- Firebase config ---------------- */
const firebaseConfig = {
  apiKey: "AIzaSyBFD3pEleXfgxT5BXrcDLU7Pq2EAtX2KA4",
  authDomain: "character-popularity.firebaseapp.com",
  databaseURL: "https://character-popularity-default-rtdb.firebaseio.com",
  projectId: "character-popularity",
  storageBucket: "character-popularity.firebasestorage.app",
  messagingSenderId: "34609153629",
  appId: "1:34609153629:web:8c3a5cf88101b9bd59efb4"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ---------------- Default sample characters ---------------- */
const DEFAULT_CHARACTERS = [
  {
    name: "Gojo Satoru",
    series: "Jujutsu Kaisen",
    tags: ["teacher", "OP", "white hair"],
    votes: 17,
    image: "https://i.pinimg.com/originals/b4/27/c3/b427c399f12289a23dd1caa82c40530f.jpg",
    fandom: "https://jujutsu-kaisen.fandom.com/wiki/Satoru_Gojo"
  },
  {
    name: "Yuji Itadori",
    series: "Jujutsu Kaisen",
    tags: ["protagonist", "energetic", "brave"],
    votes: 3,
    image: "https://i.pinimg.com/564x/2b/2f/6b/2b2f6b3b7b3b6f6b3b6f6b3b.jpg",
    fandom: "https://jujutsu-kaisen.fandom.com/wiki/Yuji_Itadori"
  }
];

/* ---------------- Local cache of characters ---------------- */
let characters = [];

/* ---------------- Vote lock storage ---------------- */
let votedTimestamps = JSON.parse(localStorage.getItem("votedTimestamps") || "{}");

/* ---------------- Helpers ---------------- */
const ADMIN_PASSWORD = "SnowyOwl";
function keyForName(name) {
  return encodeURIComponent(name);
}

/* ---------------- Initialize DB if empty ---------------- */
function ensureDefaultCharacters(callback) {
  const dataRef = ref(db, "charactersData");
  get(dataRef).then(snapshot => {
    const val = snapshot.val();
    if (!val || Object.keys(val).length === 0) {
      const updates = {};
      DEFAULT_CHARACTERS.forEach(c => {
        updates[keyForName(c.name)] = {
          series: c.series,
          tags: c.tags,
          votes: c.votes,
          image: c.image,
          fandom: c.fandom || ""
        };
      });
      set(dataRef, updates).then(() => callback()).catch(err => {
        console.error("Failed to write default characters:", err);
        callback();
      });
    } else {
      callback();
    }
  }).catch(err => {
    console.error("Error checking DB:", err);
    callback();
  });
}

/* ---------------- Realtime loader for full character objects ---------------- */
function loadCharactersRealtime(callback) {
  const dataRef = ref(db, "charactersData");
  onValue(dataRef, snapshot => {
    const data = snapshot.val() || {};
    characters = Object.keys(data).map(k => {
      const obj = data[k] || {};
      return {
        name: decodeURIComponent(k),
        series: obj.series || "Unknown",
        tags: obj.tags || [],
        votes: typeof obj.votes === "number" ? obj.votes : Number(obj.votes || 0),
        image: obj.image || "",
        fandom: obj.fandom || ""
      };
    });
    characters.sort((a,b) => b.votes - a.votes);
    callback();
  }, err => {
    console.error("Failed to load characters:", err);
    callback();
  });
}

/* ---------------- Vote function (1 vote per 24 hours per device per character) ---------------- */
window.vote = function(name) {
  try {
    const now = Date.now();
    const key = `vote_ts_${name}`;
    const last = parseInt(localStorage.getItem(key) || "0", 10);
    const DAY = 24 * 60 * 60 * 1000;

    if (last && (now - last) < DAY) {
      const remainingMs = DAY - (now - last);
      const hours = Math.floor(remainingMs / (60*60*1000));
      const mins = Math.ceil((remainingMs % (60*60*1000)) / (60*1000));
      alert(`You can vote for ${name} again in about ${hours} hour(s) and ${mins} minute(s).`);
      return;
    }

    localStorage.setItem(key, String(now));
    votedTimestamps[name] = now;
    localStorage.setItem("votedTimestamps", JSON.stringify(votedTimestamps));

    const charRef = ref(db, "charactersData/" + keyForName(name) + "/votes");
    get(charRef).then(snapshot => {
      let currentVotes = snapshot.exists() ? Number(snapshot.val()) : 0;
      set(charRef, currentVotes + 1);
    }).catch(err => {
      console.error(err);
      alert("Vote failed to save. Please try again later.");
    });
  } catch (e) {
    console.error("Vote error:", e);
    alert("An error occurred while voting.");
  }
};

/* ---------------- Admin-only: delete character ---------------- */
window.deleteCharacter = function(name) {
  if (!confirm(`Delete "${name}" permanently? This cannot be undone.`)) return;
  const key = keyForName(name);
  const charRef = ref(db, "charactersData/" + key);
  set(charRef, null).then(() => {
    console.log("Deleted", name);
  }).catch(err => {
    console.error("Delete failed:", err);
    alert("Failed to delete character.");
  });
};

/* ---------------- Admin-only: set votes manually ---------------- */
window.setVotesAdmin = function(name, newVotes) {
  const n = Number(newVotes);
  if (!Number.isFinite(n) || n < 0) {
    alert("Enter a valid non-negative number.");
    return;
  }
  const charRef = ref(db, "charactersData/" + keyForName(name) + "/votes");
  set(charRef, n).then(() => {
    // realtime listener will update UI
  }).catch(err => {
    console.error("Failed to set votes:", err);
    alert("Failed to update votes.");
  });
};

/* ---------------- Admin-only: save tags & image & fandom & name edits ---------------- */
window.saveAdminEdits = function(originalName, newName, tagsCsv, imageUrl, fandomUrl) {
  const nameTrim = String(newName || "").trim();
  if (!nameTrim) {
    alert("Name cannot be empty.");
    return;
  }
  const tags = String(tagsCsv || "").split(',').map(t => t.trim()).filter(Boolean);
  const updates = {
    series: null, // series not edited here; keep existing unless admin changes via uploader or separate control
    tags,
    image: imageUrl || "",
    fandom: fandomUrl || ""
  };

  const oldKey = keyForName(originalName);
  const newKey = keyForName(nameTrim);

  const charRefOld = ref(db, "charactersData/" + oldKey);
  get(charRefOld).then(snapshot => {
    if (!snapshot.exists()) {
      alert("Original character not found.");
      return;
    }
    const base = snapshot.val() || {};
    // merge base with updates and possibly new name
    const merged = Object.assign({}, base, {
      tags: updates.tags,
      image: updates.image,
      fandom: updates.fandom
    });

    // If name changed, write to new key and delete old key
    if (oldKey !== newKey) {
      const newRef = ref(db, "charactersData/" + newKey);
      set(newRef, merged).then(() => {
        // remove old
        set(charRefOld, null).then(() => {
          console.log("Renamed", originalName, "to", nameTrim);
        }).catch(err => {
          console.error("Failed to remove old key after rename:", err);
        });
      }).catch(err => {
        console.error("Failed to write new key during rename:", err);
        alert("Failed to rename character.");
      });
    } else {
      // same key: just set merged object (preserve votes & series if present)
      const mergedWithSeries = Object.assign({}, merged, { series: base.series || merged.series, votes: base.votes || merged.votes || 0 });
      set(charRefOld, mergedWithSeries).then(() => {
        console.log("Saved edits for", originalName);
      }).catch(err => {
        console.error("Failed to save edits:", err);
        alert("Failed to save edits.");
      });
    }
  }).catch(err => {
    console.error("Failed to read original character:", err);
    alert("Failed to save edits.");
  });
};

/* ---------------- Utility: unique sorted tags ---------------- */
function getAllTags() {
  const all = [...new Set(characters.flatMap(c => c.tags || []))];
  return all.sort((a,b) => a.localeCompare(b, undefined, {sensitivity:'base'}));
}

/* ---------------- Render ranking (right column) ---------------- */
function renderRankList(filter = null) {
  const rankList = document.getElementById("rank-list");
  if (!rankList) return;
  rankList.innerHTML = "";
  const q = filter ? String(filter).toLowerCase() : null;
  const filtered = characters.filter(c => {
    if (!q) return true;
    if (c.name && c.name.toLowerCase().includes(q)) return true;
    if (c.series && c.series.toLowerCase().includes(q)) return true;
    if (c.tags && c.tags.some(t => t.toLowerCase().includes(q))) return true;
    return false;
  });
  const top = filtered.sort((a,b) => b.votes - a.votes).slice(0,10);
  top.forEach(c => {
    const li = document.createElement("li");
    li.textContent = `${c.name} — ${c.votes}`;
    li.onclick = () => {
      renderCharacters(c.name);
      setTimeout(() => {
        const card = Array.from(document.querySelectorAll('.card .hero-name'))
          .find(h => h.textContent === c.name);
        if (card) card.scrollIntoView({behavior:'smooth', block:'center'});
      }, 80);
    };
    rankList.appendChild(li);
  });
}

/* ---------------- Render characters (hero-top variant) ---------------- */
window.renderCharacters = function(filter = null) {
  const list = document.getElementById("character-list");
  if (!list) return;
  list.innerHTML = "";

  const q = filter ? String(filter).toLowerCase() : null;
  const isAdmin = sessionStorage.getItem("isAdmin") === "1";

  characters
    .filter(c => {
      if (!q) return true;
      if (c.name && c.name.toLowerCase().includes(q)) return true;
      if (c.series && c.series.toLowerCase().includes(q)) return true;
      if (c.tags && c.tags.some(t => t.toLowerCase().includes(q))) return true;
      return false;
    })
    .sort((a, b) => b.votes - a.votes)
    .forEach(c => {
      const card = document.createElement("div");
      card.className = "card hero-top";

      // cooldown badge
      const cooldownBadge = document.createElement("div");
      cooldownBadge.className = "cooldown-badge";
      const remaining = getVoteRemaining(c.name);
      cooldownBadge.textContent = remaining ? remaining : "Ready";
      card.appendChild(cooldownBadge);

      // admin controls (stacked)
      if (isAdmin) {
        const adminControls = document.createElement("div");
        adminControls.className = "admin-controls";

        // vote editor row
        const voteRow = document.createElement("div");
        voteRow.className = "row vote-editor";
        const voteInput = document.createElement("input");
        voteInput.type = "number";
        voteInput.min = "0";
        voteInput.value = c.votes;
        voteInput.id = `vote-input-${encodeURIComponent(c.name)}`;
        const saveVoteBtn = document.createElement("button");
        saveVoteBtn.className = "save";
        saveVoteBtn.textContent = "Save";
        saveVoteBtn.onclick = () => setVotesAdmin(c.name, voteInput.value);
        voteRow.appendChild(voteInput);
        voteRow.appendChild(saveVoteBtn);
        adminControls.appendChild(voteRow);

        // edit row: name, tags, image, fandom
        const editRow = document.createElement("div");
        editRow.className = "row edit-editor";
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.value = c.name;
        nameInput.style.width = "120px";
        nameInput.id = `name-input-${encodeURIComponent(c.name)}`;

        const tagsInput = document.createElement("input");
        tagsInput.type = "text";
        tagsInput.value = (c.tags || []).join(", ");
        tagsInput.placeholder = "tags,comma,separated";
        tagsInput.id = `tags-input-${encodeURIComponent(c.name)}`;

        const imageInput = document.createElement("input");
        imageInput.type = "url";
        imageInput.value = c.image || "";
        imageInput.placeholder = "Image URL";
        imageInput.id = `image-input-${encodeURIComponent(c.name)}`;

        const fandomInput = document.createElement("input");
        fandomInput.type = "url";
        fandomInput.value = c.fandom || "";
        fandomInput.placeholder = "Fandom URL";
        fandomInput.id = `fandom-input-${encodeURIComponent(c.name)}`;

        const saveEditsBtn = document.createElement("button");
        saveEditsBtn.className = "save";
        saveEditsBtn.textContent = "Save";
        saveEditsBtn.onclick = () => {
          const newName = nameInput.value.trim();
          const tagsCsv = tagsInput.value;
          const img = imageInput.value.trim();
          const fandom = fandomInput.value.trim();
          saveAdminEdits(c.name, newName, tagsCsv, img, fandom);
        };

        // stack inputs vertically inside editRow for readability
        const editCol = document.createElement("div");
        editCol.style.display = "flex";
        editCol.style.flexDirection = "column";
        editCol.style.gap = "6px";
        editCol.appendChild(nameInput);
        editCol.appendChild(tagsInput);
        editCol.appendChild(imageInput);
        editCol.appendChild(fandomInput);
        editCol.appendChild(saveEditsBtn);

        adminControls.appendChild(editCol);

        // delete row (below editors)
        const delRow = document.createElement("div");
        delRow.className = "row";
        const delBtn = document.createElement("button");
        delBtn.className = "delete";
        delBtn.textContent = "Delete";
        delBtn.onclick = () => deleteCharacter(c.name);
        delRow.appendChild(delBtn);
        adminControls.appendChild(delRow);

        card.appendChild(adminControls);
      }

      // clickable link overlay (if fandom exists)
      if (c.fandom && c.fandom.trim()) {
        const a = document.createElement("a");
        a.className = "card-link";
        a.href = c.fandom;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        card.appendChild(a);
      }

      // hero area
      const hero = document.createElement("div");
      hero.className = "hero";
      hero.style.backgroundImage = `url('${c.image || ""}')`;
      hero.setAttribute("aria-hidden", "true");

      const h3 = document.createElement("h3");
      h3.className = "hero-name";
      h3.textContent = c.name;
      hero.appendChild(h3);

      const heroTags = document.createElement("div");
      heroTags.className = "hero-tags";
      heroTags.innerHTML = (c.tags || []).map(t => `<span class="tag">${t}</span>`).join("");
      hero.appendChild(heroTags);

      card.appendChild(hero);

      // card body
      const body = document.createElement("div");
      body.className = "card-body";

      const seriesP = document.createElement("p");
      seriesP.className = "series";
      seriesP.innerHTML = `<strong>Series:</strong> ${c.series}`;
      body.appendChild(seriesP);

      const bottomRow = document.createElement("div");
      bottomRow.style.display = "flex";
      bottomRow.style.justifyContent = "space-between";
      bottomRow.style.alignItems = "center";

      const votesP = document.createElement("p");
      votesP.className = "votes";
      votesP.style.margin = "0";
      votesP.innerHTML = `<strong>Votes:</strong> ${c.votes}`;
      bottomRow.appendChild(votesP);

      const voteBtn = document.createElement("button");
      voteBtn.className = "vote-btn";
      voteBtn.textContent = "Vote";
      voteBtn.onclick = (ev) => {
        ev.stopPropagation();
        vote(c.name);
      };
      bottomRow.appendChild(voteBtn);

      body.appendChild(bottomRow);
      card.appendChild(body);

      // accessibility summary
      const sr = document.createElement('div');
      sr.className = 'visually-hidden';
      sr.setAttribute('aria-hidden','false');
      sr.innerText = `${c.name}. Series: ${c.series}. Tags: ${c.tags.join(', ')}. Votes: ${c.votes}.`;
      card.appendChild(sr);

      // clicking the card (if no fandom link) does nothing; if fandom link exists, anchor overlay handles it
      list.appendChild(card);
    });

  renderRankList(filter);
};

/* ---------------- get vote remaining string ---------------- */
function getVoteRemaining(name) {
  const key = `vote_ts_${name}`;
  const last = parseInt(localStorage.getItem(key) || "0", 10);
  if (!last) return null;
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  if ((now - last) >= DAY) return null;
  const remainingMs = DAY - (now - last);
  const hours = Math.floor(remainingMs / (60*60*1000));
  const mins = Math.ceil((remainingMs % (60*60*1000)) / (60*1000));
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

/* ---------------- Search bar + tag suggestions ---------------- */
function setupSearchAndTags() {
  const input = document.getElementById("search-input");
  const suggestions = document.getElementById("tag-suggestions");
  const clearBtn = document.getElementById("clear-filters");

  function showTagSuggestions() {
    const tags = getAllTags();
    suggestions.innerHTML = "";
    if (tags.length === 0) {
      const p = document.createElement('div');
      p.textContent = "No tags available";
      p.style.color = "#777";
      suggestions.appendChild(p);
    } else {
      tags.forEach(t => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = t;
        btn.onclick = () => {
          input.value = t;
          renderCharacters(t);
          suggestions.hidden = true;
          clearBtn.style.display = "inline-block";
        };
        suggestions.appendChild(btn);
      });
    }
    suggestions.hidden = false;
  }

  input.addEventListener('focus', () => {
    showTagSuggestions();
  });

  input.addEventListener('input', (e) => {
    const v = e.target.value.trim();
    if (v === "") {
      renderCharacters();
      clearBtn.style.display = "none";
    } else {
      renderCharacters(v);
      clearBtn.style.display = "inline-block";
    }
  });

  document.addEventListener('click', (ev) => {
    const target = ev.target;
    if (!document.getElementById('search-area').contains(target)) {
      suggestions.hidden = true;
    }
  });

  clearBtn.onclick = () => {
    input.value = "";
    renderCharacters();
    clearBtn.style.display = "none";
    suggestions.hidden = true;
  };

  clearBtn.style.display = "none";
}

/* ---------------- Uploader (admin only) ---------------- */
function setupUploader() {
  const form = document.getElementById("uploader-form");
  const nameIn = document.getElementById("input-name");
  const seriesIn = document.getElementById("input-series");
  const tagsIn = document.getElementById("input-tags");
  const imageIn = document.getElementById("input-image");
  const fandomIn = document.getElementById("input-fandom");
  const clearBtn = document.getElementById("clear-btn");

  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = nameIn.value.trim();
    const series = seriesIn.value.trim() || "Unknown";
    const tags = tagsIn.value.split(',').map(t => t.trim()).filter(Boolean);
    const image = imageIn.value.trim();
    const fandom = fandomIn.value.trim();

    if (!name || !image) {
      alert("Please provide at least a name and image URL.");
      return;
    }

    if (characters.find(c => c.name.toLowerCase() === name.toLowerCase())) {
      alert("A character with that name already exists.");
      return;
    }

    const newChar = { series, tags, votes: 0, image, fandom };
    const charRef = ref(db, "charactersData/" + keyForName(name));
    set(charRef, newChar).then(() => {
      nameIn.value = "";
      seriesIn.value = "";
      tagsIn.value = "";
      imageIn.value = "";
      fandomIn.value = "";
    }).catch(err => {
      console.error(err);
      alert("Failed to save to database. Character not added.");
    });
  });

  clearBtn.addEventListener('click', () => {
    nameIn.value = "";
    seriesIn.value = "";
    tagsIn.value = "";
    imageIn.value = "";
    fandomIn.value = "";
  });
}

/* ---------------- Admin UI wiring ---------------- */
function setAdminMode(enabled) {
  const uploader = document.getElementById("uploader");
  const adminPanel = document.getElementById("admin-panel");
  const adminStatus = document.getElementById("admin-status");
  const adminLogout = document.getElementById("admin-logout");
  if (enabled) {
    sessionStorage.setItem("isAdmin", "1");
    uploader.hidden = false;
    adminStatus.textContent = "Admin mode enabled";
    adminLogout.hidden = false;
  } else {
    sessionStorage.removeItem("isAdmin");
    uploader.hidden = true;
    adminStatus.textContent = "";
    adminLogout.hidden = true;
  }
}

function setupAdminUI() {
  const toggleBtn = document.getElementById("admin-toggle-btn");
  const adminPanel = document.getElementById("admin-panel");
  const adminLogin = document.getElementById("admin-login");
  const adminPassword = document.getElementById("admin-password");
  const adminLogout = document.getElementById("admin-logout");
  const adminStatus = document.getElementById("admin-status");

  toggleBtn.addEventListener('click', () => {
    adminPanel.hidden = !adminPanel.hidden;
    if (!adminPanel.hidden) adminPassword.focus();
  });

  adminLogin.addEventListener('click', () => {
    const val = adminPassword.value || "";
    if (val === ADMIN_PASSWORD) {
      setAdminMode(true);
      adminPassword.value = "";
      adminPanel.hidden = true;
      renderCharacters(document.getElementById('search-input').value || null);
    } else {
      adminStatus.textContent = "Incorrect password";
      setTimeout(() => adminStatus.textContent = "", 2000);
    }
  });

  adminLogout.addEventListener('click', () => {
    setAdminMode(false);
    renderCharacters(document.getElementById('search-input').value || null);
  });

  if (sessionStorage.getItem("isAdmin") === "1") {
    setAdminMode(true);
  } else {
    setAdminMode(false);
  }
}

/* ---------------- Start app ---------------- */
ensureDefaultCharacters(() => {
  loadCharactersRealtime(() => {
    setupSearchAndTags();
    setupAdminUI();
    setupUploader();
    renderCharacters();
    // update cooldown badges every minute
    setInterval(() => {
      document.querySelectorAll('.cooldown-badge').forEach(b => {
        const card = b.closest('.card');
        if (!card) return;
        const nameEl = card.querySelector('.hero-name');
        if (!nameEl) return;
        const name = nameEl.textContent;
        const rem = getVoteRemaining(name);
        b.textContent = rem ? rem : "Ready";
      });
    }, 60*1000);
  });
});
