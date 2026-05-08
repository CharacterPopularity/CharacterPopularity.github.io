/* ---------------------------------------------------------
   FIREBASE v9 (MODULAR) INITIALIZATION
   --------------------------------------------------------- */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getDatabase, ref, get, set, onValue } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

// Your Firebase config (from your console)
const firebaseConfig = {
  apiKey: "AIzaSyBFD3pEleXfgxT5BXrcDLU7Pq2EAtX2KA4",
  authDomain: "character-popularity.firebaseapp.com",
  databaseURL: "https://character-popularity-default-rtdb.firebaseio.com",
  projectId: "character-popularity",
  storageBucket: "character-popularity.firebasestorage.app",
  messagingSenderId: "34609153629",
  appId: "1:34609153629:web:8c3a5cf88101b9bd59efb4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);


/* ---------------------------------------------------------
   CHARACTER DATA
   --------------------------------------------------------- */

const characters = [
  {
    name: "Megumi",
    series: "Jujutsu Kaisen",
    tags: ["urchin", "daddy issues", "deuterogonist"],
    votes: 0,
    image: "https://i.pinimg.com/736x/47/58/18/4758184d6811b6e1934adcbb5b5198a9.jpg"
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


/* ---------------------------------------------------------
   LOAD GLOBAL VOTES (REALTIME)
   --------------------------------------------------------- */

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


/* ---------------------------------------------------------
   SAVE A VOTE
   --------------------------------------------------------- */

window.vote = function(name) {
  // Prevent multiple votes from the same device
  if (votedCharacters.includes(name)) {
    alert("You already voted for " + name + " on this device.");
    return;
  }

  // Mark this character as voted
  votedCharacters.push(name);
  localStorage.setItem("votedCharacters", JSON.stringify(votedCharacters));

  // Update Firebase
  const charRef = ref(db, "characters/" + name);

  get(charRef).then(snapshot => {
    let currentVotes = snapshot.exists() ? snapshot.val() : 0;
    set(charRef, currentVotes + 1);
  });
};



/* ---------------------------------------------------------
   RENDER TAG BUTTONS
   --------------------------------------------------------- */

function renderTags() {
  const allTags = [...new Set(characters.flatMap(c => c.tags))];
  const tagDiv = document.getElementById("tag-filter");

  tagDiv.innerHTML = allTags
    .map(t => `<button onclick="renderCharacters('${t}')">${t}</button>`)
    .join(" ");
}


/* ---------------------------------------------------------
   RENDER CHARACTER CARDS
   --------------------------------------------------------- */

// use class "hero-top" on the card
window.renderCharactersHeroTop = function(filterTag = null) {
  const list = document.getElementById("character-list");
  list.innerHTML = "";

  characters
    .filter(c => !filterTag || c.tags.includes(filterTag))
    .sort((a,b) => b.votes - a.votes)
    .forEach(c => {
      const card = document.createElement("div");
      card.className = "card hero-top";

      card.innerHTML = `
        <div class="hero" style="background-image:url('${c.image}');">
          <h3 class="hero-name">${c.name}</h3>
          <div class="hero-tags">
            ${c.tags.map(t => `<span class="tag">${t}</span>`).join("")}
          </div>
        </div>

        <div class="card-body">
          <p class="series"><strong>Series:</strong> ${c.series}</p>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <p class="votes" style="margin:0;"><strong>Votes:</strong> ${c.votes}</p>
            <button onclick="vote('${c.name}')" style="padding:6px 8px;border-radius:8px;border:none;background:#ff6b6b;color:#fff;cursor:pointer;">Vote</button>
          </div>
        </div>
      `;

      list.appendChild(card);
    });
};





/* ---------------------------------------------------------
   START APP
   --------------------------------------------------------- */

loadVotes(() => {
  renderTags();
  renderCharacters();
});

  renderCharacters();
