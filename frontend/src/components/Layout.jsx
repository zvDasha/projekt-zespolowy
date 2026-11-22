import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Search, Moon, Sun, UserRound, Bookmark, ScanLine, Sparkles } from 'lucide-react';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const home = location.pathname === '/';
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'light'; } catch { return 'light'; }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch { /* Tryb nadal działa bez pamięci. */ }
  }, [theme]);
  useEffect(() => {
    setQuery(new URLSearchParams(location.search).get('q') || '');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname, location.search]);
  function search(event) {
    event.preventDefault();
    navigate('/katalog?' + new URLSearchParams({ q: query.trim() }));
  }
  return <>
    <a className="skip-link" href="#main">Przejdź do treści</a>
    <div className="utility"><div className="container utility-inner">
      <span>Mała przerwa. Wielka historia.</span>
      <div className="inline"><button className="icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? 'Włącz ciemny motyw' : 'Włącz jasny motyw'}>{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button><span className="divider" /><Link to="/logowanie" className="inline"><UserRound size={16} /> Zaloguj się</Link></div>
    </div></div>
    <header className={`hero ${home ? '' : 'hero-compact'}`}>
      <div className="container">
        <div className="masthead">
          <Link to="/" className="brand" aria-label="Biblioteka — strona główna"><BookOpen size={33} strokeWidth={1.5} /><span>Biblioteka<span className="brand-caption">MIĘDZY WIERSZAMI</span></span></Link>
          <form className="search-bar" onSubmit={search} role="search">
            <Search size={20} /><input aria-label="Tytuł lub autor" placeholder="Jaka historia Cię dziś ciekawi?" value={query} onChange={e => setQuery(e.target.value)} maxLength={100} />
            <button type="submit">Szukaj</button>
          </form>
          <Link className="reservation-link inline" to="/rezerwacje"><Bookmark size={18} /> Moje rezerwacje</Link>
        </div>
        {home && <div className="hero-content"><div className="hero-copy">
          <span className="eyebrow">OTWÓRZ KSIĄŻKĘ. ODKRYJ WIĘCEJ.</span>
          <h1>Twoja kolejna<br /><em>wielka historia.</em></h1>
          <p>Od pierwszej strony po nowe horyzonty.<br />Znajdź książkę dla siebie i zarezerwuj ją online.</p>
          <Link to="/katalog" className="button button-light">Odkryj katalog <BookOpen size={17} /></Link>
        </div><div className="hero-note"><span className="eyebrow">CZYTAJ PO SWOJEMU</span><p>Wiedza, wyobraźnia<br />i chwila dla siebie.</p><span className="hero-line" /></div></div>}
      </div>
    </header>
    <nav className="main-nav" aria-label="Nawigacja główna"><div className="container nav-inner">
      <NavLink to="/" end>Odkrywaj</NavLink><NavLink to="/katalog">Katalog książek</NavLink><NavLink to="/ulubione">Ulubione</NavLink><NavLink to="/rekomendacje" className="inline"><Sparkles size={16} /> Rekomendacje AI</NavLink><NavLink to="/kluby">Kluby czytelnicze</NavLink><NavLink className="scan-link inline" to="/skaner"><ScanLine size={18} /> Skanuj okładkę</NavLink>
    </div></nav>
    <main id="main" className="container main-content" tabIndex={-1}><Outlet /></main>
    <footer><div className="container footer-inner"><Link to="/" className="brand"><BookOpen size={26} /><span>Biblioteka<span className="brand-caption">MIĘDZY WIERSZAMI</span></span></Link><p>Dobre historie są po to, żeby się nimi dzielić.</p><span>Projekt zespołowy · 2026</span></div></footer>
  </>;
}
