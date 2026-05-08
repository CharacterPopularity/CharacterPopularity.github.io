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

/* ---------------- Data ---------------- */
let characters = [
  {
    name: "Megumi",
    series: "Jujutsu Kaisen",
    tags: ["urchin", "daddy issues", "deuterogonist"],
    votes: 0,
    image: "https://i.pinimg.com/1200x/09/51/0f/09510f6ef14ef55802bd7463c622aef2.jpg"
  },
  {
    name: "Gojo Satoru",
    series: "Jujutsu Kaisen",
    tags: ["teacher", "OP", "white hair"],
    votes: 0,
    image: "https://i.pinimg.com/originals/b4/27/c3/b427c399f12289a23dd1caa82c40530f.jpg"
  }
];

let votedCharacters = JSON.parse(localStorage.getItem("votedCharacters")) || [];

/* ---------------- Realtime votes loader ---------------- */
function loadVotes(callback) {
  const votesRef = ref(db, "characters");
  onValue(votesRef, snapshot => {
    const data = snapshot.val() || {};
    // update votes for known characters; if new characters exist in DB, merge them
    characters.forEach(c => {
      c.votes = data[c.name] || 0;
    });
    // also add any DB-only characters into local array (so rank shows them)
    Object.keys(data).forEach(name => {
      if (!characters.find(x => x.name === name)) {
        characters.push({
          name,
          series: "Unknown",
          tags: [],
          votes: data[name],
          image: "" // no image known
        });
      }
    });
    callback();
  });
}

/* ---------------- Vote function ---------------- */
window.vote = function(name) {
  if (votedCharacters.includes(name)) {
    alert("You already voted for " + name + " on this device.");
    return;
  }
  votedCharacters.push(name);
  localStorage.setItem("votedCharacters", JSON.stringify(votedCharacters));

  const charRef = ref(db, "characters/" + name);
  get(charRef).then(snapshot => {
    let currentVotes = snapshot.exists() ? snapshot.val() : 0;
    set(charRef, currentVotes + 1);
  });
};

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
      // find card and scroll
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

  // filter can be a tag, name, or series; if null show all
  const q = filter ? String(filter).toLowerCase() : null;

  characters
    .filter(c => {
      if (!q) return true;
      // match name, series, or tags
      if (c.name && c.name.toLowerCase().includes(q)) return true;
      if (c.series && c.series.toLowerCase().includes(q)) return true;
      if (c.tags && c.tags.some(t => t.toLowerCase().includes(q))) return true;
      return false;
    })
    .sort((a, b) => b.votes - a.votes)
    .forEach(c => {
      const card = document.createElement("div");
      card.className = "card hero-top";

      // hero uses background-image so the image is a background behind name/tags
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

      // accessibility: expose name and tags to screen readers
      const sr = document.createElement('div');
      sr.className = 'visually-hidden';
      sr.setAttribute('aria-hidden','false');
      sr.innerText = `${c.name}. Series: ${c.series}. Tags: ${c.tags.join(', ')}. Votes: ${c.votes}.`;
      card.appendChild(sr);

      list.appendChild(card);
    });

  renderRankList();
};

/* ---------------- Search bar (live) ---------------- */
function setupSearch() {
  const input = document.getElementById("search-input");
  let last = "";
  input.addEventListener('input', e => {
    const v = e.target.value.trim();
    if (v === last) return;
    last = v;
    if (v === "") {
      renderCharacters();
    } else {
      renderCharacters(v);
    }
  });
}

/* ---------------- Uploader UI ---------------- */
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

    // prevent duplicate names
    if (characters.find(c => c.name.toLowerCase() === name.toLowerCase())) {
      alert("A character with that name already exists.");
      return;
    }

    const newChar = { name, series, tags, votes: 0, image };
    characters.push(newChar);

    // write initial votes to Firebase (0)
    const charRef = ref(db, "characters/" + name);
    set(charRef, 0).then(() => {
      // re-render
      renderCharacters();
      // clear form
      nameIn.value = "";
      seriesIn.value = "";
      tagsIn.value = "";
      imageIn.value = "";
    }).catch(err => {
      console.error(err);
      alert("Failed to save to database. Character added locally only.");
      renderCharacters();
    });
  });

  clearBtn.addEventListener('click', () => {
    nameIn.value = "";
    seriesIn.value = "";
    tagsIn.value = "";
    imageIn.value = "";
  });
}

/* ---------------- Start app ---------------- */
loadVotes(() => {
  setupSearch();
  setupUploader();
  renderCharacters();
});
