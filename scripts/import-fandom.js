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

const WIKI_BASE = process.env.FANDOM_API_BASE || 'https://jujutsu-kaisen.fandom.com';
const CATEGORY = process.env.FANDOM_CATEGORY || 'Category:Characters';
const SLEEP_MS = Number(process.env.SLEEP_MS || 450);
const PAGE_CHUNK = Number(process.env.PAGE_CHUNK || 20);
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 5);
const RETRY_BASE_MS = Number(process.env.RETRY_BASE_MS || 600);

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function keyForName(name){ return encodeURIComponent(name); }

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

async function fetchCategoryMembers(cmcontinue=''){
  const url = `${WIKI_BASE}/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(CATEGORY)}&cmlimit=500&format=json${cmcontinue?`&cmcontinue=${encodeURIComponent(cmcontinue)}`:''}`;
  return fetchJson(url);
}

async function fetchPagesInfoByTitles(titles){
  // titles: array of page titles (max safe length)
  const url = `${WIKI_BASE}/api.php?action=query&format=json&prop=info|pageimages|categories|pageprops&inprop=url&piprop=thumbnail&pithumbsize=800&ppprop=disambiguation&titles=${encodeURIComponent(titles.join('|'))}`;
  return fetchJson(url);
}

async function fetchCategoriesForPageids(pageids){
  // optional: fetch categories for pageids (if not returned earlier)
  const url = `${WIKI_BASE}/api.php?action=query&format=json&prop=categories&pageids=${pageids.join('|')}&cllimit=500`;
  return fetchJson(url);
}

async function preserveVotesAndWrite(title, payload){
  const key = keyForName(title);
  const ref = db.ref('charactersData/' + key);
  const snap = await ref.get();
  const existing = snap.exists() ? snap.val() : null;
  // preserve votes if present
  if (existing && typeof existing.votes === 'number') payload.votes = existing.votes;
  // preserve series if existing and payload.series is missing
  if (existing && existing.series && !payload.series) payload.series = existing.series;
  await ref.set(payload);
}

async function importAll(){
  console.log('Starting import from', WIKI_BASE, 'category', CATEGORY);
  let cont = '';
  let total = 0;

  while(true){
    const batch = await fetchCategoryMembers(cont);
    const members = batch.query?.categorymembers || [];
    if (members.length === 0) break;

    // process in chunks to avoid huge title queries
    for (let i=0;i<members.length;i+=PAGE_CHUNK){
      const chunk = members.slice(i,i+PAGE_CHUNK);
      const titles = chunk.map(m => m.title);
      const info = await fetchPagesInfoByTitles(titles);
      const pages = info.query?.pages || {};

      // For each page, extract metadata and write to Firebase
      for (const pid of Object.keys(pages)){
        const p = pages[pid];
        const title = p.title;
        const image = p.thumbnail?.source || '';
        const fullurl = p.fullurl || `${WIKI_BASE}/wiki/${encodeURIComponent(title)}`;

        // derive tags from categories if present
        const cats = (p.categories || []).map(c => c.title.replace(/^Category:/i, '').trim());
        const tags = cats.filter(Boolean);

        // series heuristic: try to pick a category that looks like a series (first category not 'Characters')
        let series = 'Unknown';
        for (const c of cats){
          const lower = c.toLowerCase();
          if (!lower.includes('character') && !lower.includes('characters') && !lower.includes('fictional') && c.length < 40){
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
          console.error('Failed to write', title, err);
        }
      }

      await sleep(SLEEP_MS);
    }

    if (batch.continue && batch.continue.cmcontinue) cont = batch.continue.cmcontinue;
    else break;
  }

  console.log(`Import complete. ${total} pages processed.`);
}

importAll().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
