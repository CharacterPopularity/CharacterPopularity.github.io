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

/* ---------------- Data (Megumi removed) ---------------- */
let characters = [
  {
    name: "Gojo Satoru",
    series: "Jujutsu Kaisen",
    tags: ["teacher", "OP", "white hair"],
    votes: 0,
    image: "https://i.pinimg.com/originals/b4/27/c3/b427c399f12289a23dd1caa82c40530f.jpg"
  }
];

let votedTimestamps = JSON.parse(localStorage.getItem("votedTimestamps")) || {}; // { "CharacterName": 162... }

/* ---------------- Realtime votes loader ---------------- */
function loadVotes(callback) {
  const votesRef = ref(db, "characters");
  onValue(votesRef, snapshot => {
    const data = snapshot.val() || {};
    // update votes for known characters; if new characters exist in DB, merge them
    characters.forEach(c => {
      c.votes = data[c.name] || 0;
    });
    Object.keys(data).forEach(name => {
      if (!characters.find(x => x.name === name)) {
        characters.push({
          name,
          series: "Unknown",
          tags: [],
          votes: data[name],
          image: ""
        });
      }
    });
    callback();
  });
}

/* ---------------- Vote function (1 vote per 24 hours per device per character) ---------------- */
window.vote = function(name) {
  const now = Date.now();
  const key = `vote_ts_${name}`;
  const last = parseInt(localStorage.getItem(key) || "0", 10);
  const DAY = 24 * 60 * 60 * 1000;

  if (last && (now - last) < DAY) {
    const remaining = Math.ceil((DAY - (now - last)) / (60*60*1000));
    alert(`You can vote for ${name} again in about ${remaining} hour(s).`);
    return;
  }

  // mark vote timestamp locally
  localStorage.setItem(key, String(now));
  votedTimestamps[name] = now;
  localStorage.setItem("votedTimestamps", JSON.stringify(votedTimestamps));

  // Update Firebase
  const charRef = ref(db, "characters/" + name);
  get(charRef).then(snapshot => {
    let currentVotes = snapshot.exists() ? snapshot.val() : 0;
    set(charRef, currentVotes + 1);
  }).catch(err => {
    console.error(err);
    alert("Vote failed to save. Please try again later.");
  });
};

/* ---------------- Utility: unique sorted tags ---------------- */
function getAllTags() {
  const all = [...new Set(characters.flatMap(c => c.tags || []))];
  return all.sort((a,b) => a.localeCompare(b, undefined, {sensitivity:'base'}));
}

/* ---------------- Render ranking (right column) ---------------- */
function renderRankList() {
  const rankList = document.getElementById("rank-list");
  rankList.innerHTML = "";
  const top = [...characters].sort((a,b) => b.votes - a.votes).slice(0,8);
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

/* ---------------- Render characters (hero-top variant) ---------------- */
window.renderCharacters = function(filter = null) {
  const list = document.getElementById("character-list");
  list.innerHTML = "";

  const q = filter ? String(filter).toLowerCase() : null;

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
      card.innerHTML = `
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
            <button class="vote-btn" onclick="vote('${c.name}')">Vote</button>
          </div>
        </div>
      `;

      const sr = document.createElement('div');
      sr.className = 'visually-hidden';
      sr.setAttribute('aria-hidden','false');
      sr.innerText = `${c.name}. Series: ${c.series}. Tags: ${c.tags.join(', ')}. Votes: ${c.votes}.`;
      card.appendChild(sr);

      list.appendChild(card);
    });

  renderRankList();
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
    } else {
      renderCharacters(v);
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

/* ---------------- Start app ---------------- */
loadVotes(() => {
  setupSearchAndTags();
  renderCharacters();
});
