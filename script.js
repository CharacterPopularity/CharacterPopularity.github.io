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

/* ---------------- Sample characters ----------------
   Replace or extend this array as you like.
   Tags remain in the data for filtering even though they are hidden on the card.
*/
const characters = [
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
    characters.forEach(c => {
      c.votes = data[c.name] || 0;
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

/* ---------------- Render tag buttons ---------------- */
function renderTags() {
  const allTags = [...new Set(characters.flatMap(c => c.tags))];
  const tagDiv = document.getElementById("tag-filter");
  tagDiv.innerHTML = "";

  allTags.forEach(t => {
    const btn = document.createElement("button");
    btn.textContent = t;
    btn.onclick = () => {
      renderCharacters(t);
      document.getElementById("reset-filter").style.display = "inline-block";
    };
    tagDiv.appendChild(btn);
  });

  const reset = document.getElementById("reset-filter");
  reset.onclick = () => {
    renderCharacters();
    reset.style.display = "none";
  };
}

/* ---------------- Render characters (hero-top variant) ---------------- */
window.renderCharacters = function(filterTag = null) {
  const list = document.getElementById("character-list");
  list.innerHTML = "";

  characters
    .filter(c => !filterTag || c.tags.includes(filterTag))
    .sort((a, b) => b.votes - a.votes)
    .forEach(c => {
      const card = document.createElement("div");
      card.className = "card hero-top";
      // keep tags in DOM for filtering but hide them visually via CSS
      card.innerHTML = `
        <div class="hero" style="background-image:url('${c.image}');" aria-hidden="true">
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
};

/* ---------------- Start app ---------------- */
loadVotes(() => {
  renderTags();
  renderCharacters();
});

