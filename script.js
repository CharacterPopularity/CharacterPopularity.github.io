// script.js (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getDatabase, ref, get, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

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

/* ---------------- Default sample characters (used only if DB empty) ---------------- */
const DEFAULT_CHARACTERS = [
  {
    name: "Gojo Satoru",
    series: "Jujutsu Kaisen",
    tags: ["teacher", "OP", "white hair"],
    votes: 17,
    image: "https://i.pinimg.com/originals/b4/27/c3/b427c399f12289a23dd1caa82c40530f.jpg"
  },
  {
    name: "Yuji Itadori",
    series: "Jujutsu Kaisen",
    tags: ["protagonist", "energetic", "brave"],
    votes: 3,
    image: "https://i.pinimg.com/564x/2b/2f/6b/2b2f6b3b7b3b6f6b3b6f6b3b.jpg"
  }
];

/* ---------------- Local cache of characters (mirrors DB) ----------------
   characters is an array of objects: {name,series,tags,votes,image}
*/
let characters = [];

/* ---------------- Vote lock storage ----------------
   Per-character timestamps in localStorage as:
   vote_ts_<CharacterName> = <ms since epoch>
*/
let votedTimestamps = JSON.parse(localStorage.getItem("votedTimestamps") || "{}");

/* ---------------- Helpers ---------------- */
const ADMIN_PASSWORD = "SnowyOwl";
function keyForName(name) {
  // use encodeURIComponent to make a safe key for Firebase
  return encodeURIComponent(name);
}

/* ---------------- Initialize DB if empty ---------------- */
function ensureDefaultCharacters(callback) {
  const dataRef = ref(db, "charactersData");
  get(dataRef).then(snapshot => {
    const val = snapshot.val();
    if (!val || Object.keys(val).length === 0) {
      // write defaults
      const updates = {};
      DEFAULT_CHARACTERS.forEach(c => {
        updates[keyForName(c.name)] = {
          series: c.series,
          tags: c.tags,
          votes: c.votes,
          image: c.image
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
        image: obj.image || ""
      };
    });
    // keep local order stable by sorting by votes desc
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
      const hours = Math.ceil(remainingMs / (60*60*1000));
      alert(`You can vote for ${name} again in about ${hours} hour(s).`);
      return;
    }

    // mark vote timestamp locally
    localStorage.setItem(key, String(now));
    votedTimestamps[name] = now;
    localStorage.setItem("votedTimestamps", JSON.stringify(votedTimestamps));

    // Update Firebase: increment votes atomically by reading then setting
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
  // remove from DB
  set(charRef, null).then(() => {
    // local characters will update via realtime listener
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

/* ---------------- Utility: unique sorted tags ---------------- */
function getAllTags() {
  const all = [...new Set(characters.flatMap(c => c.tags || []))];
  return all.sort((a,b) => a.localeCompare(b, undefined, {sensitivity:'base'}));
}

/* ---------------- Render ranking (right column) ----------------
   Accepts optional filter string so ranking respects current filter.
*/
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
      // filter to that character and scroll into view
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

/* ---------------- Render characters (hero-top variant) ----------------
   Admin controls (delete / vote editor) are shown only when sessionStorage.isAdmin === "1"
*/
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

      const imageUrl = c.image || "";
      // admin controls: delete + vote editor
      const adminControlsHtml = isAdmin ? `
        <div class="admin-controls">
          <button class="delete" onclick="deleteCharacter('${c.name.replace(/'/g,"\\'")}')">Delete</button>
          <div class="vote-editor">
            <input type="number" id="vote-input-${encodeURIComponent(c.name)}" value="${c.votes}" min="0" />
            <button class="save" onclick="(function(){ const v = document.getElementById('vote-input-${encodeURIComponent(c.name)}').value; setVotesAdmin('${c.name.replace(/'/g,"\\'")}', v); })()">Save</button>
          </div>
        </div>
      ` : "";

      card.innerHTML = `
        ${adminControlsHtml}
        <div class="hero" style="background-image:url('${imageUrl}');" aria-hidden="true">
          <h3 class="hero-name">${c.name}</h3>
          <div class="hero-tags">
            ${c.tags.map(t => `<span class="tag">${t}</span>`).join("")}
          </div>
        </div>

        <div class="card-body">
          <p class="series"><strong>Series:</strong> ${c.series}</p>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <p class="votes" style="margin:0;"><strong>Votes:</strong> ${c.votes}</p>
            <button class="vote-btn" onclick="vote('${c.name.replace(/'/g,"\\'")}')">Vote</button>
          </div>
        </div>
      `;

      // accessibility: expose name and tags to screen readers
      const sr = document.createElement('div');
      sr.className = 'visually-hidden';
      sr.setAttribute('aria-hidden','false');
      sr.innerText = `${c.name}. Series: ${c.series}. Tags: ${c.tags.join(', ')}. Votes: ${c.votes}.`;
      card.appendChild(sr);

      list.appendChild(card);
    });

  // update rank list with same filter
  renderRankList(filter);
};

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

  // hide suggestions when clicking outside
  document.addEventListener('click', (ev) => {
    const target = ev.target;
    if (!document.getElementById('search-area').contains(target)) {
      suggestions.hidden = true;
    }
  });

  // Clear filters button
  clearBtn.onclick = () => {
    input.value = "";
    renderCharacters();
    clearBtn.style.display = "none";
    suggestions.hidden = true;
  };

  // initially hide clear button
  clearBtn.style.display = "none";
}

/* ---------------- Uploader (admin only) ---------------- */
function setupUploader() {
  const form = document.getElementById("uploader-form");
  const nameIn = document.getElementById("input-name");
  const seriesIn = document.getElementById("input-series");
  const tagsIn = document.getElementById("input-tags");
  const imageIn = document.getElementById("input-image");
  const clearBtn = document.getElementById("clear-btn");

  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = nameIn.value.trim();
    const series = seriesIn.value.trim() || "Unknown";
    const tags = tagsIn.value.split(',').map(t => t.trim()).filter(Boolean);
    const image = imageIn.value.trim();

    if (!name || !image) {
      alert("Please provide at least a name and image URL.");
      return;
    }

    if (characters.find(c => c.name.toLowerCase() === name.toLowerCase())) {
      alert("A character with that name already exists.");
      return;
    }

    const newChar = { series, tags, votes: 0, image };
    const charRef = ref(db, "charactersData/" + keyForName(name));
    set(charRef, newChar).then(() => {
      // realtime listener will pick up the new character
      nameIn.value = "";
      seriesIn.value = "";
      tagsIn.value = "";
      imageIn.value = "";
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
  });

  adminLogin.addEventListener('click', () => {
    const val = adminPassword.value || "";
    if (val === ADMIN_PASSWORD) {
      setAdminMode(true);
      adminPassword.value = "";
      adminPanel.hidden = true;
      // re-render to show admin controls
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

  // restore admin state if session says so
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
  });
});
