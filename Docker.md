## **Instrukcja uruchomienia projektu (Docker)**

## **Wymagane przygotowanie**

1. **Plik konfiguracyjny `.env`** - W głównym folderze projektu musi znajdować się plik `.env` (można go skopiować z pliku `.env.example`).
2. **Uruchomiony Docker Desktop** - Przed wpisaniem komend upewnij się, że aplikacja Docker Desktop działa w tle.

## **Podstawowe komendy Docker**

1. **Uruchomienie projektu** - Buduje obrazy i uruchamia bazę danych, backend oraz frontend:
   ```bash
   docker compose up --build
   ```
2. **Uruchomienie w tle** - Uruchamia wszystkie kontenery w tle, nie blokując terminala:
   ```bash
   docker compose up -d --build
   ```
3. **Zatrzymanie projektu** - Wyłącza kontenery, ale zachowuje wszystkie dane zapisane w bazie:
   ```bash
   docker compose down
   ```
4. **Reset bazy danych** - Usuwa kontenery wraz z zapisaną bazą danych:
   ```bash
   docker compose down -v
   ```

## **Dostęp do usług i linki**

- **Dokumentacja API (Swagger UI):** http://localhost:8000/docs - interaktywny panel do testowania wszystkich endpointów backendu.
- **Sprawdzenie działania serwera (Healthcheck):** http://localhost:8000/health - zwraca status działania aplikacji.
- **Podgląd listy książek (JSON):** http://localhost:8000/books - wyświetla przykładowe książki pobrane z bazy danych.
- **Baza danych PostgreSQL:** `localhost:5432` - port do połączenia przez programy zewnętrzne (np. DBeaver, pgAdmin). Dane logowania znajdują się w pliku `.env`.
- **Frontend (React):** http://localhost:3000 - adres interfejsu użytkownika.

## **Podgląd bazy danych w terminalu**

1. **Wejście do konsoli PostgreSQL** - Pozwala wykonywać zapytania SQL bezpośrednio w działającym kontenerze:
   ```bash
   docker exec -it library_postgres psql -U library_admin -d library_db
   ```
2. **Podstawowe polecenia wewnątrz bazy:**
   - `\dt` - lista wszystkich tabel.
   - `SELECT * FROM users;` - podgląd użytkowników.
   - `SELECT * FROM books;` - podgląd książek.
   - `\q` - wyjście z konsoli bazy danych.
