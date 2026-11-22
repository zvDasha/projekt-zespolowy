export const API_URL = (import.meta.env?.VITE_API_URL || '/api').replace(/\/$/, '');

const messages = {
  'Incorrect email or password': 'Nieprawidłowy e-mail lub hasło.',
  'Email address already registered': 'Ten adres e-mail ma już konto.',
  'User account is inactive': 'To konto zostało zablokowane.',
  'Inactive user account': 'To konto zostało zablokowane.',
  'Could not validate credentials': 'Sesja wygasła. Zaloguj się ponownie.',
  'Not authenticated': 'Zaloguj się, aby kontynuować.',
  'Operation not permitted for this role': 'Nie masz uprawnień do tej czynności.',
  'Book not found': 'Nie znaleziono książki.',
  'User not found': 'Nie znaleziono użytkownika.',
  'No available copies': 'Ktoś właśnie zarezerwował ostatni egzemplarz. Spróbuj później.',
  'You already have an active reservation for this book': 'Masz już aktywną rezerwację tej książki.',
  'You can review a book only after your reservation is confirmed':
    'Ocenę można dodać po wydaniu książki przez bibliotekarza.',
  'You have already reviewed this book': 'Ta książka ma już Twoją ocenę.',
  'Current password is incorrect': 'Obecne hasło jest nieprawidłowe.',
  'Password reset token has expired': 'Kod wygasł. Wygeneruj nowy kod resetowania hasła.',
  'Invalid password reset token': 'Kod resetowania hasła jest nieprawidłowy.',
  'Book with this ISBN already exists': 'Książka z tym numerem ISBN już istnieje.',
  'ISBN must have 10 or 13 digits': 'ISBN musi mieć 10 lub 13 znaków.',
  'Book has reservation history and cannot be deleted': 'Nie można usunąć książki z historią rezerwacji.',
  'Copy has reservation history and cannot be deleted': 'Nie można usunąć egzemplarza z historią rezerwacji.',
  'Only available copies can be deleted': 'Można usunąć tylko dostępny egzemplarz.',
  'Reservation not found': 'Nie znaleziono rezerwacji.',
  'Copy not found': 'Nie znaleziono egzemplarza.',
  'File too large (max 5 MB)': 'Plik jest za duży. Maksymalny rozmiar to 5 MB.',
  'Only .csv and .xlsx files are supported': 'Wybierz plik CSV lub XLSX.',
  'File is not a valid .xlsx workbook': 'Plik nie jest poprawnym arkuszem XLSX.',
  'Unsupported file encoding (use UTF-8)': 'Zapisz plik w kodowaniu UTF-8.',
  'Duplicate ISBN within the file': 'Numer ISBN powtarza się w pliku.',
  'Too many rows (max 5000)': 'Plik może zawierać maksymalnie 5000 wierszy.',
  'Admin cannot deactivate their own account': 'Nie możesz zablokować swojego konta.',
  'Admin cannot remove their own admin role': 'Nie możesz odebrać sobie roli administratora.',
};

export function errorMessage(detail, status) {
  const fields = {
    email: 'e-mail',
    password: 'hasło',
    full_name: 'imię i nazwisko',
    field_of_study: 'kierunek studiów',
    preferences_text: 'zainteresowania',
    current_password: 'obecne hasło',
    new_password: 'nowe hasło',
    token: 'kod resetowania',
    title: 'tytuł',
    author: 'autor',
    isbn: 'ISBN',
    genre: 'gatunek',
    publication_year: 'rok wydania',
    cover_url: 'adres okładki',
    copies: 'egzemplarze',
    count: 'liczba',
    rating: 'ocena',
    comment: 'komentarz',
    q: 'wyszukiwanie',
    year_from: 'rok od',
    year_to: 'rok do',
    page: 'strona',
  };
  if (Array.isArray(detail))
    return (
      'Sprawdź dane formularza: ' +
      [...new Set(detail.map((e) => fields[e.loc?.at(-1)] || 'pozostałe pola'))].join(', ') +
      '.'
    );
  if (messages[detail]) return messages[detail];
  if (typeof detail === 'string' && detail.startsWith('Reservation is'))
    return 'Status tej rezerwacji już się zmienił. Odśwież listę.';
  if (typeof detail === 'string' && detail.startsWith('Missing columns:'))
    return 'Brak kolumn: ' + detail.slice(16);
  if (status === 422) return 'Sprawdź format i długość wprowadzonych danych.';
  if (status === 409) return 'Nie można zapisać zmiany. Sprawdź aktualny stan danych.';
  if (status >= 500) return 'Serwer biblioteki napotkał błąd. Spróbuj ponownie później.';
  return 'Nie udało się wykonać operacji. Sprawdź dane i spróbuj ponownie.';
}

export function getToken() {
  try {
    return sessionStorage.getItem('library-token');
  } catch {
    return null;
  }
}

export async function api(path, { method = 'GET', body, signal, raw = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !(body instanceof FormData) && !(body instanceof URLSearchParams)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const timeout = AbortSignal.timeout(20000);
  let response;
  try {
    response = await fetch(API_URL + path, {
      method,
      body,
      headers,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Brak połączenia z biblioteką. Sprawdź połączenie i spróbuj ponownie.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (token && (response.status === 401 || data.detail === 'Inactive user account'))
      window.dispatchEvent(new Event('library:unauthorized'));
    const error = new Error(errorMessage(data.detail, response.status));
    error.status = response.status;
    throw error;
  }
  if (raw) return response.blob();
  return response.status === 204 ? null : response.json();
}

export const refreshData = () => window.dispatchEvent(new Event('library:update'));

export async function allBooks() {
  const first = await api('/books?page_size=100');
  const books = [...first.items];
  for (let page = 2; page <= first.pages; page++)
    books.push(...(await api(`/books?page_size=100&page=${page}`)).items);
  return books;
}
