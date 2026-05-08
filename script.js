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

function loadVotes() {
  characters.forEach(c => {
    const saved = localStorage.getItem(c.name);
    if (saved) c.votes = parseInt(saved);
  });
}

function saveVote(name, votes) {
  localStorage.setItem(name, votes);
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
        <img src="${c.image}">
        <h3>${c.name}</h3>
        <p>${c.series}</p>
        <div>${c.tags.map(t => `<span class="tag">${t}</span>`).join("")}</div>
        <p>Votes: ${c.votes}</p>
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

loadVotes();
renderTags();
renderCharacters();
