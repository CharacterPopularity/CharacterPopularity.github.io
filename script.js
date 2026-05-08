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
    name: "Megumin",
    series: "Konosuba",
    tags: ["mage", "explosion", "chaotic"],
    votes: 0,
    image: "images/megumin.png"
  },
  {
    name: "Gojo Satoru",
    series: "Jujutsu Kaisen",
    tags: ["teacher", "OP", "white hair"],
    votes: 0,
    image: "images/gojo.png"
  }
];


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

window.renderCharacters = function(filterTag = null) {
  const list = document.getElementById("character-list");
  list.innerHTML = "";

  characters
    .filter(c => !filterTag || c.tags.includes(filterTag))
    .sort((a, b) => b.votes - a.votes)
    .forEach(c => {
      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <img src="${c.image}" alt="${c.name}">
        <h3>${c.name}</h3>
        <p><strong>Series:</strong> ${c.series}</p>

        <div class="tags">
          ${c.tags.map(t => `<span class="tag">${t}</span>`).join("")}
        </div>

        <p><strong>Votes:</strong> ${c.votes}</p>
        <button onclick="vote('${c.name}')">Vote</button>
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
