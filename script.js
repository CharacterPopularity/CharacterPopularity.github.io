// Import the functions you need from the SDKs you need
npm install firebase
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBFD3pEleXfgxT5BXrcDLU7Pq2EAtX2KA4",
  authDomain: "character-popularity.firebaseapp.com",
  projectId: "character-popularity",
  storageBucket: "character-popularity.firebasestorage.app",
  messagingSenderId: "34609153629",
  appId: "1:34609153629:web:8c3a5cf88101b9bd59efb4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const characters = [
  {
    name: "Megumi Fushiguro",
    series: "Konosuba",
    tags: ["mage", "explosion", "chaotic"],
    votes: 0,
    image: "https://www.pinterest.com/pin/711005859946662848/"
  },
  {
    name: "Satoru Gojo",
    series: "Jujutsu Kaisen",
    tags: ["teacher", "OP", "white hair"],
    votes: 0,
    image: "https://fr.pinterest.com/pin/8303580557245603/"
  }
];

function loadVotes(callback) {
  db.ref("characters").on("value", snapshot => {
    const data = snapshot.val() || {};

    characters.forEach(c => {
      c.votes = data[c.name] || 0;
    });

    callback();
  });
}
function vote(name) {
  const charRef = db.ref("characters/" + name);

  charRef.get().then(snapshot => {
    let currentVotes = snapshot.exists() ? snapshot.val() : 0;
    charRef.set(currentVotes + 1);
  });
}


function renderCharacters(filterTag = null) {
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
}

function renderTags() {
  const allTags = [...new Set(characters.flatMap(c => c.tags))];
  const tagDiv = document.getElementById("tag-filter");

  tagDiv.innerHTML = allTags
    .map(t => `<button onclick="renderCharacters('${t}')">${t}</button>`)
    .join(" ");
}

function vote(name) {
  const char = characters.find(c => c.name === name);
  char.votes++;
  saveVote(name, char.votes);
  renderCharacters();
}


loadVotes(() => {
  renderTags();
  renderCharacters();
