import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Search, Moon, Sun, UserRound, Bookmark, Sparkles } from 'lucide-react';
import { useApi } from '../hooks';
import { BookCover } from './BookCard';
import { useAuth } from '../auth';
import Select from './Select';

export default function Layout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const location = useLocation();
  const home = location.pathname === '/';
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('');
  const { data: genres } = useApi('/books/genres');
  const { data: featured } = useApi(home ? '/books?sort=-rating&page_size=3' : null);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme') || 'light';
    } catch {
      return 'light';
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* Tryb nadal działa bez pamięci. */
    }
  }, [theme]);
  useEffect(() => {
    setQuery(new URLSearchParams(location.search).get('q') || '');
    setGenre(new URLSearchParams(location.search).get('genre') || '');
    window.scrollTo({ top: 0, behavior: 'instant' });
    const heading = document.querySelector('main h1, main h2');
    document.title =
      (location.pathname === '/katalog' ? 'Katalog książek' : heading?.textContent || 'Biblioteka') +
      ' — między wierszami';
  }, [location.pathname, location.search]);
  function search(event) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (genre) params.set('genre', genre);
    navigate('/katalog?' + params);
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Przejdź do treści
      </a>
      <div className="utility">
        <div className="container utility-inner">
          <span>Mała przerwa. Wielka historia.</span>
          <div className="inline">
            <button
              className="icon-button"
              onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
              aria-label={theme === 'light' ? 'Włącz ciemny motyw' : 'Włącz jasny motyw'}
            >
              <span key={theme} className="theme-symbol">
                {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
              </span>
            </button>
            <span className="divider" />
            <Link to={user ? '/profil' : '/logowanie'} className="inline">
              <UserRound size={16} />
              {user ? user.full_name.split(' ')[0] : 'Zaloguj się'}
            </Link>
            {user && (
              <button
                className="utility-logout"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                Wyloguj
              </button>
            )}
          </div>
        </div>
      </div>
      <header className={`hero ${home ? '' : 'hero-compact'}`}>
        <div className="container">
          <div className="masthead">
            <Link to="/" className="brand" aria-label="Biblioteka — strona główna">
              <BookOpen size={33} strokeWidth={1.5} />
              <span>
                Biblioteka
                <span className="brand-caption">MIĘDZY WIERSZAMI</span>
              </span>
            </Link>
            <form className="search-bar" onSubmit={search} role="search">
              <Search size={20} />
              <input
                aria-label="Tytuł lub autor"
                placeholder="Jaka historia Cię dziś ciekawi?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={100}
              />
              <Select
                label="Gatunek w wyszukiwarce"
                className="search-genre"
                value={genre}
                onChange={setGenre}
                options={[['', 'Każdy gatunek'], ...(genres || []).map((g) => [g, g])]}
              />
              <button type="submit">Szukaj</button>
            </form>
            <Link className="reservation-link inline" to="/rezerwacje">
              <Bookmark size={18} /> Moje rezerwacje
            </Link>
          </div>
          {home && (
            <div className="hero-content">
              <div className="hero-copy">
                <span className="eyebrow">OTWÓRZ KSIĄŻKĘ. ODKRYJ WIĘCEJ.</span>
                <h1>
                  Twoja kolejna
                  <br />
                  <em>wielka historia.</em>
                </h1>
                <p>
                  Od pierwszej strony po nowe horyzonty.
                  <br />
                  Znajdź książkę dla siebie i zarezerwuj ją online.
                </p>
                <Link to="/katalog" className="button button-light">
                  Odkryj katalog <BookOpen size={17} />
                </Link>
              </div>
              <div className="hero-shelf">
                <span className="eyebrow">NA NASZEJ PÓŁCE</span>
                <div className="featured-covers">
                  {featured?.items.map((book) => (
                    <Link key={book.id} to={`/ksiazki/${book.id}`} title={book.title}>
                      <BookCover book={book} eager />
                    </Link>
                  ))}
                </div>
                <span className="shelf-caption">Otwórz się na nowe historie.</span>
              </div>
            </div>
          )}
        </div>
      </header>
      <nav className="main-nav" aria-label="Nawigacja główna">
        <div className="container nav-inner">
          <NavLink to="/" end>
            Odkrywaj
          </NavLink>
          <NavLink to="/katalog">Katalog książek</NavLink>
          <NavLink to="/ulubione">Ulubione</NavLink>
          <NavLink to="/rekomendacje" className="inline">
            <Sparkles size={16} /> Rekomendacje AI
          </NavLink>
          <NavLink to="/kluby">Kluby czytelnicze</NavLink>
          {['librarian', 'admin'].includes(user?.role) && (
            <NavLink className="staff-link" to="/bibliotekarz">
              Bibliotekarz
            </NavLink>
          )}
          {user?.role === 'admin' && <NavLink to="/admin">Administrator</NavLink>}
        </div>
      </nav>
      <main key={location.pathname} id="main" className="container main-content page-enter" tabIndex={-1}>
        <Outlet />
      </main>
      <footer>
        <div className="container footer-inner">
          <Link to="/" className="brand">
            <BookOpen size={26} />
            <span>
              Biblioteka<span className="brand-caption">MIĘDZY WIERSZAMI</span>
            </span>
          </Link>
          <p>Dobre historie są po to, żeby się nimi dzielić.</p>
        </div>
      </footer>
    </>
  );
}
