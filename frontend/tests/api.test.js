import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { api, errorMessage } from '../src/api.js';

globalThis.sessionStorage = { getItem: () => 'test-token' };
globalThis.window = new EventTarget();
afterEach(() => mock.restoreAll());

test('JSON requests include JWT and a JSON body', async () => {
  mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/reservations');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), { book_id: 4 });
    return new Response(JSON.stringify({ id: 12 }), { status: 201 });
  });
  assert.deepEqual(await api('/reservations', { method: 'POST', body: { book_id: 4 } }), { id: 12 });
});

test('multipart upload leaves the browser in charge of its boundary', async () => {
  const body = new FormData();
  body.append('file', new Blob(['test']), 'books.csv');
  mock.method(globalThis, 'fetch', async (_, options) => {
    assert.equal(options.body, body);
    assert.equal(options.headers['Content-Type'], undefined);
    return new Response('{}');
  });
  await api('/books/import', { method: 'POST', body });
});

test('login keeps the OAuth form encoding', async () => {
  const body = new URLSearchParams({ username: 'a@b.pl', password: 'abc123' });
  mock.method(globalThis, 'fetch', async (_, options) => {
    assert.equal(options.body, body);
    assert.equal(options.headers['Content-Type'], undefined);
    return new Response('{}');
  });
  await api('/auth/login', { method: 'POST', body });
});

test('empty deletion response does not try to parse JSON', async () => {
  mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }));
  assert.equal(await api('/books/4', { method: 'DELETE' }), null);
});

test('server validation details become a Polish error without reflecting values', async () => {
  mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        JSON.stringify({ detail: [{ loc: ['body', 'password'], input: 'secret', msg: 'too short' }] }),
        { status: 422 },
      ),
  );
  await assert.rejects(
    api('/auth/register'),
    (error) => error.status === 422 && error.message.includes('hasło') && !error.message.includes('secret'),
  );
});

test('expired session emits the logout event', async () => {
  let fired = false;
  window.addEventListener(
    'library:unauthorized',
    () => {
      fired = true;
    },
    { once: true },
  );
  mock.method(
    globalThis,
    'fetch',
    async () => new Response(JSON.stringify({ detail: 'Could not validate credentials' }), { status: 401 }),
  );
  await assert.rejects(api('/users/me'), /Sesja wygasła/);
  assert.equal(fired, true);
});

test('lost connection gives an actionable error', async () => {
  mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(api('/books'), /Brak połączenia/);
});

test('aborted navigation preserves the abort error', async () => {
  const controller = new AbortController();
  controller.abort();
  mock.method(globalThis, 'fetch', async () => {
    throw controller.signal.reason;
  });
  await assert.rejects(api('/books', { signal: controller.signal }), (error) => error.name === 'AbortError');
});

test('download returns a Blob instead of JSON', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('title,author\nSolaris,Lem'));
  const result = await api('/books/import/template', { raw: true });
  assert.equal(await result.text(), 'title,author\nSolaris,Lem');
});

test('race conditions and non-JSON server failures are translated', () => {
  assert.match(errorMessage("Reservation is 'cancelled', expected 'pending'", 409), /Status.*zmienił/);
  assert.match(errorMessage('Internal Server Error', 500), /Serwer biblioteki/);
  assert.match(errorMessage('No available copies', 409), /ostatni egzemplarz/);
});
