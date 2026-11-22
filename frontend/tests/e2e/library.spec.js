import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

let sequence = 0;
const nextIsbn = () => '978' + String(Date.now()).slice(-8) + String(sequence++).padStart(2, '0');
const title = (prefix) => `${prefix} ${Date.now()}-${sequence++}`;
async function token(request, email = 'librarian@library.pl', password = 'lib123') {
  const response = await request.post('/api/auth/login', {
    form: { username: email, password },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).access_token;
}
const headers = (token) => ({ Authorization: `Bearer ${token}` });
async function createReader(request) {
  const email = `frontend-${Date.now()}-${sequence++}@example.com`;
  const password = 'Czytelnik123!';
  const response = await request.post('/api/auth/register', {
    data: { email, password, full_name: 'Czytelnik Testowy' },
  });
  expect(response.status()).toBe(201);
  return {
    ...(await response.json()),
    email,
    password,
    token: await token(request, email, password),
  };
}
async function createBook(request, name = title('Książka testowa'), copies = 2) {
  const response = await request.post('/api/books', {
    headers: headers(await token(request)),
    data: {
      title: name,
      author: 'Autor Testowy',
      isbn: nextIsbn(),
      genre: 'Testy',
      publication_year: 2024,
      copies,
    },
  });
  expect(response.status()).toBe(201);
  return response.json();
}
async function login(page, email, password) {
  await page.goto('/logowanie');
  await page.getByLabel('Adres e-mail').fill(email);
  await page.getByLabel(/^Hasło/).fill(password);
  await page.getByRole('button', { name: 'Zaloguj się', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Wyloguj' })).toBeVisible();
}

async function choose(page, name, option) {
  await page.getByRole('combobox', { name, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

test.beforeAll(async ({ request }) => {
  const auth = headers(await token(request));
  const covers = JSON.parse(await readFile(new URL('../../scripts/covers.json', import.meta.url), 'utf8'));
  for (const cover of covers) {
    const data = await (await request.get('/api/books?isbn=' + cover.isbn)).json();
    const book = data.items.find((b) => b.title === cover.title);
    if (book)
      expect(
        (
          await request.patch(`/api/books/${book.id}`, {
            headers: auth,
            data: { cover_url: cover.cover_url },
          })
        ).ok(),
      ).toBeTruthy();
  }
});

test('hero search, real covers, title and author search, filters and history', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a[href="/skaner"]')).toHaveCount(0);
  await expect(page.getByText('Projekt zespołowy · 2026')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Twoja kolejna wielka historia.' })).toBeVisible();
  await expect(page.locator('.book-grid .book-card')).toHaveCount(6);
  for (const name of [
    'lalka.jpg',
    'solaris.jpg',
    'clean-code.jpg',
    'thinking.jpg',
    'machine-learning.jpg',
    'habits.png',
  ]) {
    const image = await page.request.get('/images/covers/' + name);
    expect(image.ok()).toBeTruthy();
    expect(image.headers()['content-type']).toMatch(/^image\//);
  }
  await page.getByLabel('Tytuł lub autor', { exact: true }).fill('Solaris');
  await page.getByRole('button', { name: 'Szukaj', exact: true }).click();
  await expect(page.locator('main h1')).toHaveCount(0);
  await expect(page.getByText('ZNAJDŹ SWOJĄ HISTORIĘ')).toHaveCount(0);
  await expect(page.getByText('Szukaj po tytule lub autorze. Wybierz, zarezerwuj i czytaj.')).toHaveCount(0);
  await expect(page.locator('.book-card')).toHaveCount(1);
  await expect(page.locator('.book-card h3')).toHaveText('Solaris');
  await page.getByLabel('Tytuł lub autor', { exact: true }).fill('Kahneman');
  await page.getByRole('button', { name: 'Szukaj', exact: true }).click();
  await expect(page.locator('.book-card h3')).toContainText('Pułapki myślenia');
  await page.getByRole('button', { name: 'Wyczyść filtry' }).click();
  await choose(page, 'Gatunek', 'Informatyka');
  await expect(page.locator('.book-card')).toHaveCount(2);
  await choose(page, 'Sortowanie', 'Tytuł: A–Z');
  await expect(page.locator('.book-card h3').first()).toHaveText('Clean Code. Czysty kod');
  await page.getByText('Więcej filtrów').click();
  await page.getByLabel('Rok od').fill('2015');
  await page.getByRole('button', { name: 'Zastosuj' }).click();
  await expect(page.locator('.book-card')).toHaveCount(1);
  await page.goBack();
  await expect(page.locator('.book-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Wyczyść filtry' }).click();
  await page.getByText('Więcej filtrów').click();
  await page.getByLabel('ISBN', { exact: true }).fill('9788308049051');
  await page.getByRole('button', { name: 'Zastosuj' }).click();
  await expect(page.locator('.book-card h3')).toHaveText('Solaris');
});

test('responsive layout and dark theme survive refresh', async ({ page }) => {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.book-grid .book-card').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `.artifacts/home-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole('button', { name: 'Włącz ciemny motyw' }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({
    path: '.artifacts/home-dark-mobile.png',
    fullPage: true,
  });
});

test('network errors can be retried and no results are clearly explained', async ({ page }) => {
  await page.route('**/api/books?*', (route) => route.abort());
  await page.goto('/katalog');
  await expect(page.getByRole('alert')).toContainText('Brak połączenia');
  await expect(page.locator('.book-card')).toHaveCount(0);
  await page.unroute('**/api/books?*');
  await page.getByRole('button', { name: 'Spróbuj ponownie' }).click();
  await expect(page.locator('.book-card').first()).toBeVisible();
  await page.goto('/katalog?q=nieistniejacytytulxyz123');
  await expect(page.getByRole('heading', { name: 'Nie znaleziono książek' })).toBeVisible();
  await page.goto('/ksiazki/9999999');
  await expect(page.getByRole('alert').first()).toContainText('Nie znaleziono książki');
  await page.goto('/nie-ma-takiej-strony');
  await expect(page.getByText('404 · ZAGUBIONA STRONA')).toBeVisible();
});

test('guests, readers and expired tokens cannot open staff panels', async ({ page, request }) => {
  await page.goto('/admin/uzytkownicy');
  await expect(page).toHaveURL(/\/logowanie$/);
  await login(page, 'maja@library.pl', 'maja123');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Brak dostępu' })).toBeVisible();
  await page.goto('/bibliotekarz');
  await expect(page.getByRole('heading', { name: 'Brak dostępu' })).toBeVisible();
  const readerToken = await token(request, 'maja@library.pl', 'maja123');
  expect((await request.get('/api/users', { headers: headers(readerToken) })).status()).toBe(403);
  await page.evaluate(() => sessionStorage.setItem('library-token', 'expired.invalid.token'));
  await page.goto('/rezerwacje');
  await expect(page).toHaveURL(/\/logowanie$/);
  expect(await page.evaluate(() => sessionStorage.getItem('library-token'))).toBeNull();
});

test('registration, profile editing, password change and test reset work', async ({ page }) => {
  const email = `ui-${Date.now()}@example.com`;
  await page.goto('/rejestracja');
  await page.getByLabel('Imię i nazwisko').fill('Alicja Testowa');
  await page.getByLabel('Kierunek studiów').fill('Informatyka');
  await page.getByLabel('Adres e-mail').fill(email);
  await page.getByLabel(/^Hasło/).fill('NoweHaslo123');
  await page.getByLabel('Powtórz hasło').fill('NoweHaslo123');
  await page.getByRole('button', { name: 'Załóż konto' }).click();
  await expect(page).toHaveURL(/\/logowanie$/);
  await login(page, email, 'NoweHaslo123');
  await page.getByLabel('Kierunek studiów').fill('Psychologia');
  await page.getByLabel('Co lubisz czytać?').fill('Fantastyka i psychologia poznawcza.');
  await page.getByRole('button', { name: 'Zapisz profil' }).click();
  await expect(page.getByRole('status')).toContainText('Twój profil został zapisany');
  await page.reload();
  await expect(page.getByLabel('Kierunek studiów')).toHaveValue('Psychologia');
  await page.getByLabel('Obecne hasło').fill('NoweHaslo123');
  await page.getByLabel(/^Nowe hasło/).fill('Zmienione123');
  await page.getByLabel('Powtórz nowe hasło').fill('Zmienione123');
  await page.getByRole('button', { name: 'Zmień hasło' }).click();
  await expect(page.getByRole('status')).toContainText('Hasło zostało zmienione');
  await page.getByRole('button', { name: 'Wyloguj' }).click();
  await login(page, email, 'Zmienione123');
  await page.getByRole('button', { name: 'Wyloguj' }).click();
  await page.goto('/zapomniane-haslo');
  await page.getByLabel('Adres e-mail').fill(email);
  await page.getByRole('button', { name: 'Wygeneruj kod resetowania' }).click();
  await page.getByRole('link', { name: 'Ustaw nowe hasło' }).click();
  await page.getByLabel(/^Nowe hasło/).fill('Resetowane123');
  await page.getByLabel('Powtórz hasło').fill('Resetowane123');
  await page.getByRole('button', { name: 'Zapisz nowe hasło' }).click();
  await expect(page).toHaveURL(/\/logowanie$/);
  await login(page, email, 'Resetowane123');
});

for (const role of ['librarian', 'admin']) {
  test(`${role} profile only edits personal details and preserves reader preferences`, async ({
    page,
    request,
  }) => {
    const user = await createReader(request);
    await request.patch('/api/users/me', {
      headers: headers(user.token),
      data: { field_of_study: 'Psychologia', preferences_text: 'Literatura' },
    });
    const admin = await token(request, 'admin@library.pl', 'admin123');
    expect(
      (await request.patch(`/api/users/${user.id}`, { headers: headers(admin), data: { role } })).ok(),
    ).toBeTruthy();
    await login(page, user.email, user.password);
    await page.goto('/profil');
    await expect(page.getByLabel('Kierunek studiów')).toHaveCount(0);
    await expect(page.getByLabel('Co lubisz czytać?')).toHaveCount(0);
    await expect(page.getByPlaceholder('Np. psychologia')).toHaveCount(0);
    await page.getByLabel('Imię i nazwisko').fill('Pracownik Biblioteki');
    const saving = page.waitForRequest(
      (req) => req.url().endsWith('/api/users/me') && req.method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Zapisz profil' }).click();
    expect((await saving).postDataJSON()).toEqual({ full_name: 'Pracownik Biblioteki' });
    await expect(page.getByRole('status')).toContainText('Twój profil został zapisany');
    const profile = await (await request.get('/api/users/me', { headers: headers(user.token) })).json();
    expect(profile).toMatchObject({
      full_name: 'Pracownik Biblioteki',
      field_of_study: 'Psychologia',
      preferences_text: 'Literatura',
    });
  });
}

test('styled reservation dropdown supports keyboard, dismissal and mobile dark mode', async ({
  page,
  request,
}) => {
  const user = await createReader(request);
  await login(page, user.email, user.password);
  await page.goto('/rezerwacje');
  const status = page.getByRole('combobox', { name: 'Status', exact: true });
  await status.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(page.getByRole('option', { name: 'Aktywne rezerwacje', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('option', { name: 'Cała historia', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(status).toHaveText('Cała historia');
  await expect(status).toBeFocused();
  await status.click();
  await page.keyboard.press('Home');
  await expect(page.getByRole('option', { name: 'Aktywne rezerwacje', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(status).toHaveText('Cała historia');
  await status.click();
  await page.mouse.click(10, 20);
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Włącz ciemny motyw' }).click();
  await status.click();
  const menu = page.getByRole('listbox');
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: '.artifacts/reservations-dropdown-dark.png',
    animations: 'disabled',
  });
  await page.getByRole('option', { name: 'Zwrócone', exact: true }).click();
  await expect(status).toHaveText('Zwrócone');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/katalog');
  expect(await page.locator('main').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
});

test('favorites persist locally and stay separate for each account', async ({ page, request }) => {
  const first = await createReader(request);
  const second = await createReader(request);
  await login(page, first.email, first.password);
  await page.goto('/ksiazki/4');
  await page.getByRole('button', { name: 'Dodaj do ulubionych: Solaris', exact: true }).click();
  await page.goto('/ulubione');
  await expect(page.locator('.book-card h3')).toHaveText('Solaris');
  await page.reload();
  await expect(page.locator('.book-card h3')).toHaveText('Solaris');
  await page.getByRole('button', { name: 'Wyloguj' }).click();
  await login(page, second.email, second.password);
  await page.goto('/ulubione');
  await expect(page.getByRole('heading', { name: 'Zrób miejsce na dobre historie' })).toBeVisible();
});

test('reservation, librarian checkout, review gate and return update real availability', async ({
  page,
  request,
  browser,
}) => {
  const reader = await createReader(request);
  const book = await createBook(request);
  const auth = headers(reader.token);
  expect(
    (
      await request.post(`/api/books/${book.id}/reviews`, {
        headers: auth,
        data: { rating: 4 },
      })
    ).status(),
  ).toBe(403);
  await login(page, reader.email, reader.password);
  await page.goto(`/ksiazki/${book.id}`);
  await expect(page.getByText('Ocenę dodasz po wydaniu książki', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Zarezerwuj książkę' }).click();
  await expect(page.getByRole('status')).toContainText('Książka została zarezerwowana');
  await expect(page.getByText('1 z 2 egzemplarzy dostępnych')).toBeVisible();
  expect(
    (
      await request.post('/api/reservations', {
        headers: auth,
        data: { book_id: book.id },
      })
    ).status(),
  ).toBe(409);
  const staff = await browser.newPage({ baseURL: 'http://127.0.0.1:3001' });
  try {
    await login(staff, 'librarian@library.pl', 'lib123');
    await staff.goto('/bibliotekarz/rezerwacje');
    await staff.getByLabel('Książka, czytelnik lub egzemplarz').fill(book.title);
    await staff.getByRole('button', { name: 'Wydaj książkę' }).click();
    await expect(staff.getByRole('status')).toContainText('Wydano książkę');
    await page.reload();
    await page.getByRole('radio', { name: '4', exact: true }).check();
    await page.getByLabel('Komentarz').fill('Sprawdzona opinia po wypożyczeniu.');
    await page.getByRole('button', { name: 'Dodaj opinię' }).click();
    await expect(page.locator('.review')).toContainText('Sprawdzona opinia po wypożyczeniu.');
    expect(
      (
        await request.post(`/api/books/${book.id}/reviews`, {
          headers: auth,
          data: { rating: 5 },
        })
      ).status(),
    ).toBe(409);
    await staff.getByRole('button', { name: 'Przyjmij zwrot' }).click();
    await expect(staff.getByRole('status')).toContainText('Przyjęto zwrot');
    await page.reload();
    await expect(page.getByText('2 z 2 egzemplarzy dostępnych')).toBeVisible();
    await page.goto('/rezerwacje');
    await choose(page, 'Status', 'Zwrócone');
    await expect(page.locator('.reservation-card')).toContainText(book.title);
  } finally {
    await staff.close();
  }
});

test('cancelling a pending reservation releases the copy', async ({ page, request }) => {
  const reader = await createReader(request);
  const book = await createBook(request, title('Anulowanie'), 1);
  await login(page, reader.email, reader.password);
  await page.goto(`/ksiazki/${book.id}`);
  await page.getByRole('button', { name: 'Zarezerwuj książkę' }).click();
  await expect(page.getByRole('status')).toContainText('Książka została zarezerwowana');
  await page.goto('/rezerwacje');
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Anuluj rezerwację' }).click();
  await expect(page.getByRole('status')).toContainText('Rezerwacja została anulowana');
  const detail = await (await request.get(`/api/books/${book.id}`)).json();
  expect(detail.available_copies).toBe(1);
});

test('librarian creates, edits and deletes books and copies', async ({ page, request }) => {
  const name = title('CRUD');
  await login(page, 'librarian@library.pl', 'lib123');
  await page.goto('/bibliotekarz/ksiazki/nowa');
  await page.getByLabel('Tytuł', { exact: true }).fill(name);
  await page.getByLabel('Autor', { exact: true }).fill('Autor testowy');
  await page.getByLabel('ISBN', { exact: true }).fill(nextIsbn());
  await page.getByLabel('Gatunek', { exact: true }).fill('Testy');
  await page.getByLabel('Rok wydania').fill('2024');
  await page.getByLabel('Liczba egzemplarzy').fill('2');
  await page.getByRole('button', { name: 'Dodaj książkę', exact: true }).click();
  await expect(page).toHaveURL(/\/bibliotekarz\/ksiazki\/\d+$/);
  const id = page.url().split('/').at(-1);
  await page.getByLabel('Tytuł', { exact: true }).fill(name + ' po edycji');
  await page.getByRole('button', { name: 'Zapisz zmiany' }).click();
  await expect(page.getByRole('status')).toContainText('Zmiany zostały zapisane');
  await page.getByLabel('Nowe egzemplarze').fill('3');
  await page.getByRole('button', { name: 'Dodaj egzemplarze' }).click();
  await expect(page.locator('.copy-list li')).toHaveCount(5);
  page.on('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('button', { name: /Usuń egzemplarz/ })
    .first()
    .click();
  await expect(page.locator('.copy-list li')).toHaveCount(4);
  await page.goto(`/bibliotekarz/ksiazki?q=${encodeURIComponent(name)}`);
  await page.getByRole('button', { name: /Usuń książkę/ }).click();
  await expect(page.getByRole('status')).toContainText('Książka została usunięta');
  expect((await request.get('/api/books/' + id)).status()).toBe(404);
});

test('CSV dry-run does not write and actual import skips duplicate ISBN', async ({ page, request }) => {
  const isbn = nextIsbn();
  const name = title('CSV');
  await login(page, 'librarian@library.pl', 'lib123');
  await page.goto('/bibliotekarz/import');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Pobierz szablon CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('szablon-ksiazek.csv');
  const csv = `title,author,isbn,genre,publication_year,copies\n${name},Autor,${isbn},Testy,2024,2\nDuplikat,Prus,9788373271890,Klasyka,1890,1\n`;
  await page.getByLabel('Plik z książkami').setInputFiles({
    name: 'test.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await page.getByRole('button', { name: 'Sprawdź plik' }).click();
  await expect(page.getByRole('heading', { name: 'Wynik sprawdzania' })).toBeVisible();
  expect((await (await request.get('/api/books?isbn=' + isbn)).json()).total).toBe(0);
  await page.getByRole('button', { name: 'Importuj poprawne wiersze (1)' }).click();
  await expect(page.getByRole('heading', { name: 'Import zakończony' })).toBeVisible();
  const data = await (await request.get('/api/books?isbn=' + isbn)).json();
  expect(data.items[0].total_copies).toBe(2);
  await expect(page.locator('.import-result')).toContainText('Książka z tym numerem ISBN już istnieje');
});

test('XLSX import is accepted and unsupported file types are blocked', async ({ page, request }) => {
  const found = await (await request.get('/api/books?isbn=9780000000902')).json();
  for (const book of found.items)
    await request.delete('/api/books/' + book.id, {
      headers: headers(await token(request)),
    });
  await login(page, 'librarian@library.pl', 'lib123');
  await page.goto('/bibliotekarz/import');
  await page.getByLabel('Plik z książkami').setInputFiles('tests/fixtures/books.xlsx');
  await page.getByRole('button', { name: 'Sprawdź plik' }).click();
  await page.getByRole('button', { name: 'Importuj poprawne wiersze (1)' }).click();
  await expect(page.getByRole('heading', { name: 'Import zakończony' })).toBeVisible();
  expect((await (await request.get('/api/books?isbn=9780000000902')).json()).total).toBe(1);
  await page.getByLabel('Plik z książkami').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello'),
  });
  await expect(page.getByRole('alert')).toContainText('Wybierz plik CSV lub XLSX');
  await expect(page.getByRole('button', { name: 'Sprawdź plik' })).toBeDisabled();
});

test('administrator changes roles and activity, self-protection remains enabled', async ({
  page,
  request,
}) => {
  const reader = await createReader(request);
  await login(page, 'admin@library.pl', 'admin123');
  await page.goto('/admin/uzytkownicy');
  await page.getByLabel('Znajdź użytkownika').fill(reader.email);
  await choose(page, `Rola: ${reader.email}`, 'Bibliotekarz');
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Zapisz', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Zapisano zmiany konta');
  await page.getByRole('button', { name: 'Zablokuj', exact: true }).click();
  await expect(page.getByText('Zablokowane', { exact: true })).toBeVisible();
  expect(
    (
      await request.post('/api/auth/login', {
        form: { username: reader.email, password: reader.password },
      })
    ).status(),
  ).toBe(403);
  await page.getByRole('button', { name: 'Odblokuj', exact: true }).click();
  await expect(page.getByText('Aktywne', { exact: true })).toBeVisible();
  await page.getByLabel('Znajdź użytkownika').fill('admin@library.pl');
  await expect(page.getByLabel('Rola: admin@library.pl')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Zablokuj', exact: true })).toBeDisabled();
});

test('dashboard reports actual library counts and unfinished modules are explicit', async ({
  page,
  request,
}) => {
  await login(page, 'admin@library.pl', 'admin123');
  await page.goto('/admin');
  const books = await (await request.get('/api/books?page_size=100')).json();
  await expect(
    page.locator('.stat-card').filter({ hasText: 'Tytułów w katalogu' }).locator('strong'),
  ).toHaveText(String(books.total));
  await page.goto('/admin/ustawienia');
  await expect(page.getByRole('heading', { name: 'Ustawienia są w przygotowaniu' })).toBeVisible();
  await page.goto('/rekomendacje');
  await expect(page.getByText('W przygotowaniu', { exact: true })).toBeVisible();
  await page.goto('/kluby');
  await expect(page.getByText('W przygotowaniu', { exact: true })).toBeVisible();
  await expect(page.locator('textarea')).toHaveCount(0);
});

test('catalog pagination and availability filtering use server results', async ({ page, request }) => {
  const prefix = title('Paginacja');
  for (let i = 0; i < 13; i++)
    await createBook(request, `${prefix} ${String(i).padStart(2, '0')}`, i === 12 ? 0 : 1);
  await page.goto('/katalog?' + new URLSearchParams({ q: prefix, sort: 'title' }));
  await expect(page.locator('.book-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Następna', exact: true }).click();
  await expect(page.locator('.book-card')).toHaveCount(1);
  await expect(page.locator('.book-card h3')).toHaveText(prefix + ' 12');
  await page.getByLabel('Tylko dostępne').click();
  await expect(page.getByLabel('Tylko dostępne')).toBeChecked();
  await expect(page.locator('.book-card')).toHaveCount(12);
  await expect(page.locator('.pagination')).toHaveCount(0);
});

test('availability changes made by another reader appear through polling', async ({ page, request }) => {
  const reader = await createReader(request);
  const book = await createBook(request, title('Aktualizacja'));
  await page.goto(`/ksiazki/${book.id}`);
  await expect(page.getByText('2 z 2 egzemplarzy dostępnych')).toBeVisible();
  const response = await request.post('/api/reservations', {
    headers: headers(reader.token),
    data: { book_id: book.id },
  });
  expect(response.status()).toBe(201);
  await expect(page.getByText('1 z 2 egzemplarzy dostępnych')).toBeVisible({
    timeout: 18000,
  });
});
