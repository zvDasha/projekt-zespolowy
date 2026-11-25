# Uruchomienie projektu

Aplikacja korzysta z React, FastAPI i PostgreSQL. Wymagany jest działający Docker Compose. Polecenia Bash są wykonywane z głównego katalogu projektu.

## 1. Uruchomienie przez Docker

Jeżeli brakuje pliku `.env`, należy utworzyć go z szablonu:

```bash
cp .env.example .env
```

Uruchomienie frontendu, backendu i bazy danych jedną komendą:

```bash
docker compose up -d --build
```

Strona jest dostępna pod adresem [localhost:3000](http://localhost:3000), backend na porcie `8000`, a dokumentacja API w [Swagger UI](http://localhost:8000/docs). Baza danych korzysta z portu `5432`.

 Jeśli port `3000` zajmuje wcześniej uruchomione `npm run dev`, proces należy zakończyć przez `Ctrl+C`. Po zmianach w kodzie należy powtórzyć polecenie Docker z `--build`.

Nowa baza automatycznie otrzymuje przykładowe książki (wraz z okładkami) i konta:

| Rola | E-mail | Hasło |
| --- | --- | --- |
| Czytelnik | maja@library.pl | maja123 |
| Bibliotekarz | librarian@library.pl | lib123 |
| Administrator | admin@library.pl | admin123 |

Zatrzymanie projektu z zachowaniem danych:

```bash
docker compose down
```

**Opcja `-v` usuwa wolumen bazy danych — należy ją pominąć.**

## 2. Praca nad frontendem React

Automatyczne odświeżanie strony przez Vite wymaga Node.js **22.12.0 lub nowszego** oraz przygotowanego `.env`.

```bash
docker compose -f docker-compose.yml -f frontend/compose.yml stop frontend
docker compose up -d --build
cd frontend
npm ci
npm run dev
```

Frontend działa pod adresem [localhost:3000](http://localhost:3000). Terminal Vite pozostaje otwarty; `Ctrl+C` zatrzymuje serwer. Backend i baza nadal działają w Dockerze.

Sprawdzenie kompilacji i testy jednostkowe, w osobnym terminalu w katalogu `frontend`:

```bash
npm run build
npm test
```

## 3. Okładki książek

Uzupełnienie okładek wymaga działającego backendu oraz Node.js. Z katalogu `frontend`:

```bash
LIBRARY_EMAIL=librarian@library.pl LIBRARY_PASSWORD=lib123 npm run covers
```

Skrypt uzupełnia wyłącznie brakujące adresy okładek.
