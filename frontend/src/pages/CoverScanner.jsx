import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Camera, ScanLine, Search } from 'lucide-react';
import { api } from '../api';
import { BookCover } from '../components/BookCard';
import { ErrorBox, Loading, PageTitle } from '../components/UI';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024;

export default function CoverScanner() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const url = file ? URL.createObjectURL(file) : '';
    setPreview(url);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  function chooseFile(event) {
    const selected = event.target.files?.[0];
    setError('');
    setQuery('');
    setMatches(null);
    setFile(null);
    if (!selected) return;

    if (!ALLOWED_TYPES.includes(selected.type) || selected.size > MAX_BYTES) {
      setError('Wybierz zdjęcie JPG, PNG lub WebP do 10 MB.');
      return;
    }
    setFile(selected);
  }

  async function runScan(customQuery = '') {
    setBusy(true);
    setError('');
    const body = new FormData();
    if (customQuery.trim()) {
      body.append('query', customQuery.trim());
    } else if (file) {
      body.append('file', file);
    }

    try {
      const data = await api('/books/scan-cover', { method: 'POST', body });
      if (!customQuery) {
        setQuery(data.suggested_query || data.extracted_text || '');
      }
      setMatches(data.matches || []);
      if (!customQuery && !data.extracted_text) {
        setError('Nie udało się odczytać tekstu z okładki. Spróbuj wyraźniejszego zdjęcia lub wpisz tytuł.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle eyebrow="ZDJĘCIE ZAMIAST PISANIA" title="Skanuj okładkę książki">
        Zrób zdjęcie okładki, odczytaj tytuł i sprawdź dostępność oraz opinie w naszej bibliotece.
      </PageTitle>

      <div className="two-columns">
        <section className="panel">
          <label className="upload-area">
            <Camera size={34} strokeWidth={1.3} />
            <strong>Dodaj zdjęcie okładki</strong>
            <span>JPG, PNG lub WebP · maks. 10 MB</span>
            <span className="button button-outline upload-trigger">
              {file ? 'Zmień zdjęcie' : 'Wybierz plik ze zdjęciem'}
            </span>
            {file && (
              <small className="muted">
                {file.name} · {(file.size / 1024).toFixed(1)} KB
              </small>
            )}
            <input
              className="file-input-hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={chooseFile}
              disabled={busy}
              aria-label="Zdjęcie okładki"
            />
          </label>
          {preview && (
            <div className="scan-preview-box">
              <img src={preview} className="scan-preview" alt="Podgląd wybranej okładki" />
            </div>
          )}
          <button className="button full-width" disabled={!file || busy} onClick={() => runScan()}>
            <ScanLine size={18} />
            {busy ? 'Odczytywanie okładki…' : 'Odczytaj tytuł i szukaj'}
          </button>
        </section>

        <section className="panel">
          <Search size={24} />
          <h2>Wynik i dopasowanie</h2>
          <p>Możesz też wpisać lub poprawić rozpoznany tytuł albo autora i wyszukać ponownie.</p>
          <ErrorBox error={error} />
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) runScan(query);
            }}
          >
            <label>
              Dopasowany tytuł lub autor
              <div className="scan-search-row">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  maxLength={150}
                  placeholder="Wpisz lub popraw odczytany tytuł…"
                />
                <button className="button" disabled={busy || !query.trim()}>
                  Szukaj
                </button>
              </div>
            </label>
          </form>

          {busy && <Loading />}

          {!busy && matches !== null && (
            <div className="scan-inline-results">
              <div className="section-heading">
                <span className="eyebrow">
                  {matches.length === 1
                    ? 'ZNALEZIONO KSIĄŻKĘ W BIBLIOTECE'
                    : matches.length > 1
                      ? `ZNALEZIONE WARIANTY (${matches.length})`
                      : 'BRAK DOPASOWANIA'}
                </span>
                {query.trim() && (
                  <Link
                    className="text-link"
                    to={'/katalog?' + new URLSearchParams({ q: query.trim() })}
                  >
                    Pełny katalog
                  </Link>
                )}
              </div>

              {matches.length > 0 ? (
                <div className="scan-match-list">
                  {matches.map(({ book, score }) => (
                    <article key={book.id} className="scan-result-item">
                      <Link to={`/ksiazki/${book.id}`} className="scan-result-cover">
                        <BookCover book={book} />
                      </Link>
                      <div className="scan-result-info">
                        <div className="scan-result-badges">
                          <span className="genre-label">{book.genre}</span>
                          <span className="status">Dopasowanie: {Math.round(score * 100)}%</span>
                        </div>
                        <Link to={`/ksiazki/${book.id}`}>
                          <h3>{book.title}</h3>
                        </Link>
                        <p className="book-author">{book.author}</p>
                        <span className={`availability ${book.available_copies ? '' : 'unavailable'}`}>
                          <span />
                          {book.available_copies
                            ? `Dostępne: ${book.available_copies} z ${book.total_copies}`
                            : 'Obecnie niedostępna'}
                        </span>
                        <div className="scan-result-action">
                          <Link className="button" to={`/ksiazki/${book.id}`}>
                            <BookOpen size={16} /> Przejdź do książki i opinii
                          </Link>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">
                  Nie znaleźliśmy pasującej książki. Popraw tytuł wyżej i kliknij „Szukaj”.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
