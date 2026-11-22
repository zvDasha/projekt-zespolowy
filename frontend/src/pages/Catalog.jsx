import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, SlidersHorizontal, Sparkles, ScanLine, Bookmark } from 'lucide-react';
import { useApi } from '../hooks';
import BookCard from '../components/BookCard';
import { Empty, ErrorBox, Loading, PageTitle } from '../components/UI';
import { useFavorites } from '../favorites';

export default function Catalog({ home = false }) {
  const { error: favoriteError } = useFavorites();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('new');
  const { data: genres } = useApi('/books/genres');
  const query = home
    ? new URLSearchParams({
        sort: tab === 'rating' ? '-rating' : '-added',
        page_size: '6',
        ...(tab === 'available' ? { available_only: 'true' } : {}),
      })
    : new URLSearchParams(params);
  if (!home) {
    query.set('page_size', '12');
    if (!query.has('sort')) query.set('sort', '-added');
  }
  const { data, loading, error, reload } = useApi('/books?' + query, 15000);
  function change(key, value) {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  }
  function filters(event) {
    event.preventDefault();
    const next = new URLSearchParams(params);
    for (const [key, value] of new FormData(event.currentTarget))
      value ? next.set(key, value.trim()) : next.delete(key);
    next.delete('page');
    setParams(next);
  }
  return (
    <>
      {home ? (
        <div className="section-heading">
          <div>
            <span className="eyebrow">ODKRYJ COŚ DLA SIEBIE</span>
            <h2>Dobra książka czeka na Ciebie</h2>
            <p>Znajome tytuły. Nowe perspektywy. Wybierz swoją następną lekturę.</p>
          </div>
          <Link className="text-link" to="/katalog">
            Cały katalog <BookOpen size={16} />
          </Link>
        </div>
      ) : (
        <PageTitle eyebrow="ZNAJDŹ SWOJĄ HISTORIĘ" title="Katalog książek">
          Szukaj po tytule lub autorze. Wybierz, zarezerwuj i czytaj.
        </PageTitle>
      )}
      {home ? (
        <div className="tabs" aria-label="Wybór książek">
          {[
            ['new', 'Ostatnio dodane'],
            ['rating', 'Najlepiej oceniane'],
            ['available', 'Dostępne teraz'],
          ].map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? 'selected' : ''}
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="filters-top">
            <label>
              Gatunek
              <select value={params.get('genre') || ''} onChange={(e) => change('genre', e.target.value)}>
                <option value="">Wszystkie gatunki</option>
                {genres?.map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </label>
            <label>
              Sortowanie
              <select value={params.get('sort') || '-added'} onChange={(e) => change('sort', e.target.value)}>
                <option value="-added">Ostatnio dodane</option>
                <option value="added">Najwcześniej dodane</option>
                <option value="-rating">Najwyższa ocena</option>
                <option value="rating">Najniższa ocena</option>
                <option value="title">Tytuł: A–Z</option>
                <option value="-title">Tytuł: Z–A</option>
                <option value="-year">Rok: od najnowszych</option>
                <option value="year">Rok: od najstarszych</option>
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={params.get('available_only') === 'true'}
                onChange={(e) => change('available_only', e.target.checked ? 'true' : '')}
              />{' '}
              Tylko dostępne
            </label>
            <button className="text-button" onClick={() => setParams({})}>
              Wyczyść filtry
            </button>
          </div>
          <details
            className="advanced-filters"
            open={!!(params.get('isbn') || params.get('year_from') || params.get('year_to'))}
          >
            <summary>
              <SlidersHorizontal size={16} /> Więcej filtrów
            </summary>
            <form className="filter-form" onSubmit={filters} key={params.toString()}>
              <label>
                ISBN
                <input
                  name="isbn"
                  defaultValue={params.get('isbn') || ''}
                  maxLength={20}
                  placeholder="Numer ISBN"
                />
              </label>
              <label>
                Rok od
                <input
                  name="year_from"
                  type="number"
                  min="0"
                  max="9999"
                  defaultValue={params.get('year_from') || ''}
                />
              </label>
              <label>
                Rok do
                <input
                  name="year_to"
                  type="number"
                  min="0"
                  max="9999"
                  defaultValue={params.get('year_to') || ''}
                />
              </label>
              <button className="button">Zastosuj</button>
            </form>
          </details>
          <div className="results-meta">
            <span>
              {params.get('q') ? `Wyniki dla „${params.get('q')}”` : 'Wszystkie książki'}
              {data ? ` · ${data.total}` : ''}
            </span>
            <span>Dostępność odświeżana co 15 s</span>
          </div>
        </>
      )}
      <ErrorBox error={error} reload={reload} />
      <ErrorBox error={favoriteError} />
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        <div className="book-grid">
          {data.items.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      ) : (
        !error && <Empty title="Nie znaleziono książek">Zmień wyszukiwaną frazę lub wyczyść filtry.</Empty>
      )}
      {!home && data?.pages > 1 && (
        <nav className="pagination" aria-label="Strony katalogu">
          <button disabled={data.page <= 1} onClick={() => change('page', String(data.page - 1))}>
            Poprzednia
          </button>
          <span>
            Strona {data.page} z {data.pages}
          </span>
          <button disabled={data.page >= data.pages} onClick={() => change('page', String(data.page + 1))}>
            Następna
          </button>
        </nav>
      )}
      {home && (
        <>
          <section className="discovery-banner">
            <div className="discovery-icon">
              <Sparkles size={28} strokeWidth={1.4} />
            </div>
            <div>
              <span className="eyebrow">NA TWOJEJ FALI</span>
              <h2>Czytanie zaczyna się od ciekawości.</h2>
              <p>Opowiedz nam o swoich zainteresowaniach. Przygotuj profil na rekomendacje AI.</p>
            </div>
            <Link to="/rekomendacje" className="button button-outline">
              Poznaj rekomendacje
            </Link>
          </section>
          <div className="benefits">
            <div>
              <BookOpen />
              <span>
                <strong>Wybieraj bez pośpiechu</strong>
                <small>Cały katalog w jednym miejscu</small>
              </span>
            </div>
            <div>
              <Bookmark />
              <span>
                <strong>Zarezerwuj w kilka chwil</strong>
                <small>Sprawdź dostępne egzemplarze</small>
              </span>
            </div>
            <Link to="/skaner">
              <ScanLine />
              <span>
                <strong>Masz książkę na oku?</strong>
                <small>Wyszukaj ją ze zdjęcia okładki</small>
              </span>
            </Link>
          </div>
        </>
      )}
    </>
  );
}
