import { readFile } from 'node:fs/promises';

// Zmienia wyłącznie puste cover_url przez istniejące API bibliotekarza.
const base = process.env.LIBRARY_API_URL || 'http://127.0.0.1:8000';
const email = process.env.LIBRARY_EMAIL;
const password = process.env.LIBRARY_PASSWORD;
if (!email || !password) throw new Error('Ustaw LIBRARY_EMAIL i LIBRARY_PASSWORD konta bibliotekarza.');
let token;
async function request(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}
const login = await request('/auth/login', { method: 'POST', body: new URLSearchParams({ username: email, password }) });
token = login.access_token;
const covers = JSON.parse(await readFile(new URL('./covers.json', import.meta.url), 'utf8'));
for (const cover of covers) {
  const result = await request('/books?isbn=' + cover.isbn);
  const book = result.items.find(b => b.title === cover.title && b.author === cover.author);
  if (!book) { console.log(`Pominięto: ${cover.title} (brak zgodnego rekordu)`); continue; }
  const detail = await request('/books/' + book.id);
  if (detail.cover_url) { console.log(`Pominięto: ${book.title} (ma już okładkę)`); continue; }
  await request('/books/' + book.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cover_url: cover.cover_url }) });
  console.log(`Dodano okładkę: ${book.title}`);
}
