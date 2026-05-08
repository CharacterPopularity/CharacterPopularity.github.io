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
});/**
 * script.js
 * Full client-side implementation for:
 *  - Clear Filters (including clearing "Most popular")
 *  - UI submission flow with admin approval queue
 *  - Admin mode protected by password "SnowyOwl"
 *  - Admin approve/deny UIs and hover-delete character cards
 *
 * NOTE: This is a self-contained front-end prototype.
 * For production, move persistence and admin auth to a secure server.
 */

/* ===========================
   Configuration / Constants
   =========================== */
const ADMIN_PASSWORD = 'SnowyOwl'; // Provided by user; client-side check is NOT secure for production
const STORAGE_KEYS = {
  CHARACTERS: 'cp_characters',
  UIS: 'cp_uis',
  PENDING_UIS: 'cp_pending_uis',
  APP_STATE: 'cp_app_state'
};

/* ===========================
   In-memory state (backed by localStorage)
   =========================== */
let state = {
  characters: [],   // approved characters (array of {id, name, popularity, ...})
  uis: [],          // approved UIs (array of {id, title, markup})
  pendingUIs: [],   // submitted UIs awaiting admin approval
  filters: {
    mostPopular: false,
    // add other filter fields here (e.g., searchText, tags, etc.)
  },
  isAdmin: false
};

/* ===========================
   Utilities: persistence
   =========================== */
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEYS.CHARACTERS, JSON.stringify(state.characters));
    localStorage.setItem(STORAGE_KEYS.UIS, JSON.stringify(state.uis));
    localStorage.setItem(STORAGE_KEYS.PENDING_UIS, JSON.stringify(state.pendingUIs));
    localStorage.setItem(STORAGE_KEYS.APP_STATE, JSON.stringify({ filters: state.filters, isAdmin: state.isAdmin }));
  } catch (err) {
    console.warn('Failed to save state:', err);
  }
}

function loadState() {
  try {
    const chars = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHARACTERS) || '[]');
    const uis = JSON.parse(localStorage.getItem(STORAGE_KEYS.UIS) || '[]');
    const pending = JSON.parse(localStorage.getItem(STORAGE_KEYS.PENDING_UIS) || '[]');
    const appState = JSON.parse(localStorage.getItem(STORAGE_KEYS.APP_STATE) || '{}');

    state.characters = Array.isArray(chars) ? chars : [];
    state.uis = Array.isArray(uis) ? uis : [];
    state.pendingUIs = Array.isArray(pending) ? pending : [];
    state.filters = appState.filters || state.filters;
    state.isAdmin = !!appState.isAdmin;
  } catch (err) {
    console.warn('Failed to load state:', err);
  }
}

/* ===========================
   DOM helpers
   =========================== */
function $id(id) { return document.getElementById(id); }
function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v);
  });
  children.forEach(c => e.appendChild(c));
  return e;
}

/* ===========================
   Initialization
   =========================== */
function init() {
  loadState();
  wireUpControls();
  renderAll();
  // If admin was active in previous session, show admin panel (optional)
  if (state.isAdmin) enterAdminModeUI();
}

/* ===========================
   Wire up UI controls
   =========================== */
function wireUpControls() {
  // Clear Filters button
  const clearBtn = $id('clearFiltersBtn');
  if (clearBtn) clearBtn.addEventListener('click', onClearFilters);

  // Most popular checkbox
  const mostPopularCheckbox = $id('mostPopular');
  if (mostPopularCheckbox) {
    mostPopularCheckbox.checked = !!state.filters.mostPopular;
    mostPopularCheckbox.addEventListener('change', (e) => {
      state.filters.mostPopular = e.target.checked;
      saveState();
      renderCharacters();
    });
  }

  // UI submission form
  const uiForm = $id('uiSubmitForm');
  if (uiForm) {
    uiForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(uiForm);
      const title = (fd.get('title') || '').toString().trim();
      const markup = (fd.get('markup') || '').toString().trim();
      if (!title) {
        alert('Please provide a title for the UI.');
        return;
      }
      submitUI({ title, markup });
      uiForm.reset();
    });
  }

  // Admin login controls
  const adminLoginBtn = $id('adminLoginBtn');
  if (adminLoginBtn) adminLoginBtn.addEventListener('click', onAdminLogin);

  const adminLogoutBtn = $id('adminLogoutBtn');
  if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', onAdminLogout);

  // Optional: seed sample data button (for dev/testing)
  const seedBtn = $id('seedDataBtn');
  if (seedBtn) seedBtn.addEventListener('click', seedSampleData);
}

/* ===========================
   Actions: Filters
   =========================== */
function onClearFilters() {
  // Reset all filter inputs and state
  state.filters = {
    mostPopular: false
    // reset other filters here
  };
  // Update UI controls
  const mostPopularCheckbox = $id('mostPopular');
  if (mostPopularCheckbox) mostPopularCheckbox.checked = false;

  // If you have other filter inputs, reset them here (search boxes, selects, etc.)

  saveState();
  renderCharacters();
}

/* ===========================
   Actions: UI submission & admin queue
   =========================== */
function submitUI(ui) {
  const item = {
    id: Date.now(),
    title: ui.title,
    markup: ui.markup,
    submittedAt: new Date().toISOString()
  };
  state.pendingUIs.push(item);
  saveState();
  renderPending(); // update admin panel if visible
  alert('UI submitted for admin approval.');
}

/* Approve a pending UI (admin only) */
function approveUI(id) {
  if (!state.isAdmin) { alert('Admin access required'); return; }
  const idx = state.pendingUIs.findIndex(p => p.id === id);
  if (idx === -1) return;
  const approved = state.pendingUIs.splice(idx, 1)[0];
  state.uis.push(approved);
  saveState();
  renderPending();
  renderUIs();
}

/* Deny (remove) a pending UI (admin only) */
function denyUI(id) {
  if (!state.isAdmin) { alert('Admin access required'); return; }
  state.pendingUIs = state.pendingUIs.filter(p => p.id !== id);
  saveState();
  renderPending();
}

/* ===========================
   Admin login / logout
   =========================== */
function onAdminLogin() {
  const passInput = $id('adminPass');
  if (!passInput) return;
  const pass = passInput.value || '';
  if (pass === ADMIN_PASSWORD) {
    state.isAdmin = true;
    saveState();
    enterAdminModeUI();
  } else {
    alert('Incorrect password');
  }
}

function onAdminLogout() {
  state.isAdmin = false;
  saveState();
  exitAdminModeUI();
}

/* Toggle UI for admin mode */
function enterAdminModeUI() {
  const adminPanel = $id('adminPanel');
  const adminLogin = $id('adminLogin');
  if (adminPanel) adminPanel.style.display = 'block';
  if (adminLogin) adminLogin.style.display = 'none';
  renderPending();
  renderCharacters(); // show hover-delete buttons
}

function exitAdminModeUI() {
  const adminPanel = $id('adminPanel');
  const adminLogin = $id('adminLogin');
  if (adminPanel) adminPanel.style.display = 'none';
  if (adminLogin) adminLogin.style.display = 'block';
  // clear password input
  const passInput = $id('adminPass');
  if (passInput) passInput.value = '';
  renderCharacters();
}

/* ===========================
   Renderers
   =========================== */
function renderAll() {
  renderCharacters();
  renderUIs();
  renderPending();
}

/* Render approved UIs list (if you have a UI gallery) */
function renderUIs() {
  const container = $id('uiList');
  if (!container) return;
  container.innerHTML = '';
  if (state.uis.length === 0) {
    container.textContent = 'No approved UIs yet.';
    return;
  }
  state.uis.forEach(u => {
    const row = el('div', { className: 'uiRow' });
    row.innerHTML = `<strong>${escapeHtml(u.title)}</strong> <small>(${new Date(u.submittedAt).toLocaleString()})</small>`;
    // optionally show markup preview
    const preview = el('div', { className: 'uiPreview', html: `<pre>${escapeHtml(u.markup)}</pre>` });
    row.appendChild(preview);
    container.appendChild(row);
  });
}

/* Render pending UIs for admin */
function renderPending() {
  const container = $id('pendingList');
  if (!container) return;
  container.innerHTML = '';
  if (state.pendingUIs.length === 0) {
    container.textContent = 'No pending UIs.';
    return;
  }
  state.pendingUIs.forEach(p => {
    const item = el('div', { className: 'pendingItem' });
    const title = el('div', { className: 'pendingTitle', html: `<strong>${escapeHtml(p.title)}</strong>` });
    const meta = el('div', { className: 'pendingMeta', html: `<small>Submitted: ${new Date(p.submittedAt).toLocaleString()}</small>` });
    const preview = el('div', { className: 'pendingPreview', html: `<pre>${escapeHtml(p.markup)}</pre>` });

    const approveBtn = el('button', { className: 'btn approveBtn' });
    approveBtn.textContent = 'Approve';
    approveBtn.addEventListener('click', () => {
      if (!confirm(`Approve UI "${p.title}"?`)) return;
      approveUI(p.id);
    });

    const denyBtn = el('button', { className: 'btn denyBtn' });
    denyBtn.textContent = 'Deny';
    denyBtn.addEventListener('click', () => {
      if (!confirm(`Deny and remove UI "${p.title}"?`)) return;
      denyUI(p.id);
    });

    const controls = el('div', { className: 'pendingControls' }, []);
    controls.appendChild(approveBtn);
    controls.appendChild(denyBtn);

    item.appendChild(title);
    item.appendChild(meta);
    item.appendChild(preview);
    item.appendChild(controls);
    container.appendChild(item);
  });
}

/* Render character cards grid with optional admin hover-delete */
function renderCharacters() {
  const grid = $id('characterGrid');
  if (!grid) return;
  grid.innerHTML = '';

  // Apply filters
  let list = [...state.characters];
  if (state.filters.mostPopular) {
    // Example: sort by popularity descending and show top N (e.g., top 10)
    list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    // Optionally limit to top N; here we keep all but sorted
  }

  // If you have other filters (search text, tags), apply them here

  if (list.length === 0) {
    grid.textContent = 'No characters to show.';
    return;
  }

  list.forEach(c => {
    const card = el('div', { className: 'charCard' });
    const content = el('div', { className: 'cardContent', html: `<strong>${escapeHtml(c.name)}</strong><div class="meta">Popularity: ${c.popularity || 0}</div>` });

    // Delete button (only visible on hover when admin mode is active)
    const delBtn = el('button', { className: 'charDeleteBtn' });
    delBtn.textContent = 'Delete';
    delBtn.style.display = 'none';
    delBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (!state.isAdmin) { alert('Admin access required'); return; }
      if (!confirm(`Delete character "${c.name}"? This cannot be undone.`)) return;
      deleteCharacter(c.id);
    });

    card.appendChild(content);
    card.appendChild(delBtn);

    // Hover behavior: show delete button only if admin mode is active
    card.addEventListener('mouseenter', () => {
      if (state.isAdmin) delBtn.style.display = 'inline-block';
    });
    card.addEventListener('mouseleave', () => {
      delBtn.style.display = 'none';
    });

    grid.appendChild(card);
  });
}

/* ===========================
   Character CRUD
   =========================== */
function addCharacter(char) {
  const item = Object.assign({ id: Date.now() }, char);
  state.characters.push(item);
  saveState();
  renderCharacters();
  return item;
}

function deleteCharacter(id) {
  state.characters = state.characters.filter(c => c.id !== id);
  saveState();
  renderCharacters();
}

/* ===========================
   Helpers / small utilities
   =========================== */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ===========================
   Dev / seed data (optional)
   =========================== */
function seedSampleData() {
  // Only seed if empty
  if (state.characters.length === 0) {
    addCharacter({ name: 'Astra', popularity: 95 });
    addCharacter({ name: 'Bram', popularity: 82 });
    addCharacter({ name: 'Cleo', popularity: 76 });
  }
  if (state.uis.length === 0) {
    state.uis.push({ id: Date.now() + 1, title: 'Default UI', markup: '<div class="sample">Sample UI</div>', submittedAt: new Date().toISOString() });
  }
  saveState();
  renderAll();
}

/* ===========================
   Boot
   =========================== */
document.addEventListener('DOMContentLoaded', init);

/* ===========================
   Optional: Expose some functions for debugging in console
   =========================== */
window._cp = {
  state,
  addCharacter,
  deleteCharacter,
  submitUI,
  approveUI,
  denyUI,
  enterAdminModeUI,
  exitAdminModeUI,
  onClearFilters
};

/* ===========================
   Security note (in-code)
   ===========================
   - This file implements client-side admin password checking for convenience.
   - DO NOT rely on client-side checks for real admin authentication.
   - Move admin auth and approval endpoints to a secure server with proper authentication.
   =========================== */
