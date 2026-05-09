// scripts/import-fandom.js
// Node 20+, ESM
import fetch from 'node-fetch';
import admin from 'firebase-admin';

const SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;
if (!SERVICE_ACCOUNT_JSON) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON secret');
if (!FIREBASE_DB_URL) throw new Error('Missing FIREBASE_DB_URL secret');

const serviceAccount = JSON.parse(SERVICE_ACCOUNT_JSON);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), databaseURL: FIREBASE_DB_URL });
const db = admin.database();

/* ---------- Config (override via workflow env) ---------- */
const WIKI_BASE = process.env.FANDOM_API_BASE || 'https://jujutsu-kaisen.fandom.com';
const CATEGORY = process.env.FANDOM_CATEGORY || 'Category:Characters';
const SLEEP_MS = Number(process.env.SLEEP_MS || 450);
const PAGE_CHUNK = Number(process.env.PAGE_CHUNK || 20);
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 5);
const RETRY_BASE_MS = Number(process.env.RETRY_BASE_MS || 600);

/* ---------- Helpers ---------- */
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

/* Normalize title into a safe key (dashes, lowercase, remove unsafe chars) */
function keyForName(name){
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')          // spaces -> dashes
    .replace(/[\/\\]+/g, '-')      // slashes -> dashes
    .replace(/[^a-z0-9\-]/g, '')   // remove other unsafe chars
    .replace(/\-+/g, '-')          // collapse multiple dashes
    .replace(/^\-+|\-+$/g, '');    // trim leading/trailing dashes
}

/* Robust fetch with retries and exponential backoff */
async function fetchJson(url, attempt = 0){
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'ImportScript/1.0 (contact)' }});
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw err;
    const backoff = RETRY_BASE_MS * Math.pow(2, attempt);
    console.warn(`Fetch failed (attempt ${attempt+1}) ${url} — retrying in ${backoff}ms`, err.message);
    await sleep(backoff);
    return fetchJson(url, attempt+1);
  }
}

/* Fetch category members (pages in the category) */
async function fetchCategoryMembers(cmcontinue=''){
  const url = `${WIKI_BASE}/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(CATEGORY)}&cmlimit=500&format=json${cmcontinue?`&cmcontinue=${encodeURIComponent(cmcontinue)}`:''}`;
  return fetchJson(url);
}

/* Fetch page info for a list of titles (pageimages, info, categories) */
async function fetchPagesInfoByTitles(titles){
  const url = `${WIKI_BASE}/api.php?action=query&format=json&prop=info|pageimages|categories&inprop=url&piprop=thumbnail&pithumbsize=800&cllimit=500&titles=${encodeURIComponent(titles.join('|'))}`;
  return fetchJson(url);
}

/* Preserve existing votes and series, then write payload */
async function preserveVotesAndWrite(title, payload){
  const key = keyForName(title);
  const ref = db.ref('charactersData/' + key);
  const snap = await ref.get();
  const existing = snap.exists() ? snap.val() : null;
  if (existing && typeof existing.votes === 'number') payload.votes = existing.votes;
  if (existing && existing.series && (!payload.series || payload.series === 'Unknown')) payload.series = existing.series;
  await ref.set(payload);
}

/* ---------- Main import flow ---------- */
async function importAll(){
  console.log('Starting import from', WIKI_BASE, 'category', CATEGORY);
  let cont = '';
  let total = 0;

  while(true){
    const batch = await fetchCategoryMembers(cont);
    const members = batch.query?.categorymembers || [];
    if (members.length === 0) break;

    for (let i=0;i<members.length;i+=PAGE_CHUNK){
      const chunk = members.slice(i,i+PAGE_CHUNK);
      const titles = chunk.map(m => m.title);
      const info = await fetchPagesInfoByTitles(titles);
      const pages = info.query?.pages || {};

      for (const pid of Object.keys(pages)){
        const p = pages[pid];
        const title = p.title;
        const image = p.thumbnail?.source || '';
        const fullurl = p.fullurl || `${WIKI_BASE}/wiki/${encodeURIComponent(title)}`;

        // derive tags from categories if present
        const cats = (p.categories || []).map(c => c.title.replace(/^Category:/i, '').trim());
        const tags = cats.filter(Boolean);

        // heuristic for series: pick first category that doesn't look generic
        let series = 'Unknown';
        for (const c of cats){
          const lower = c.toLowerCase();
          if (!lower.includes('character') && !lower.includes('characters') && !lower.includes('fictional') && c.length < 60){
            series = c;
            break;
          }
        }

        const payload = { series, tags, votes: 0, image, fandom: fullurl };
        try {
          await preserveVotesAndWrite(title, payload);
          console.log('Wrote/merged:', title);
          total++;
        } catch (err) {
          console.error('Failed to write', title, err.message || err);
        }
      }

      await sleep(SLEEP_MS);
    }

    if (batch.continue && batch.continue.cmcontinue) cont = batch.continue.cmcontinue;
    else break;
  }

  console.log(`Import complete. ${total} pages processed.`);
}

/* ---------- Run ---------- */
importAll().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
