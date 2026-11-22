import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { BookOpen, Bookmark, Users, Library, Settings } from 'lucide-react';
import { allBooks, api } from '../api';
import { ErrorBox, Loading, Notice, PageTitle, statusLabels } from '../components/UI';

export function ManagementLayout({ admin = false }) {
  const root = admin ? '/admin' : '/bibliotekarz';
  return <><div className="management-heading"><span className="eyebrow">{admin ? 'ADMINISTRATOR' : 'BIBLIOTEKARZ'} · BIBLIOTEKA</span><Link className="text-link" to="/profil">Moje konto</Link></div><nav className="management-nav" aria-label="Panel zarządzania"><NavLink to={root} end>Przegląd</NavLink>{admin ? <><NavLink to="/admin/uzytkownicy">Użytkownicy</NavLink><NavLink to="/admin/ustawienia">Ustawienia</NavLink><Link to="/bibliotekarz/ksiazki">Zarządzaj księgozbiorem</Link></> : <><NavLink to="/bibliotekarz/ksiazki">Księgozbiór</NavLink><NavLink to="/bibliotekarz/rezerwacje">Rezerwacje i zwroty</NavLink><NavLink to="/bibliotekarz/import">Import CSV / XLSX</NavLink></>}</nav><Outlet /></>;
}

export function Dashboard({ admin = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    Promise.all([allBooks(), api('/reservations'), admin ? api('/users') : Promise.resolve([])])
      .then(([books, reservations, users]) => { if (active) setData({ books, reservations, users }); })
      .catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [admin, version]);
  return <><PageTitle eyebrow="WSZYSTKO W JEDNYM MIEJSCU" title={admin ? 'Przegląd biblioteki' : 'Dzień dobry w bibliotece'} action={<button className="button button-outline" onClick={() => setVersion(v => v + 1)}>Odśwież statystyki</button>}>Bieżące dane o księgozbiorze i czytelnikach.</PageTitle><ErrorBox error={error} reload={() => setVersion(v => v + 1)} />{!data ? !error && <Loading /> : <><div className="stats-grid">{[
    [BookOpen, data.books.length, 'Tytułów w katalogu'],
    [Library, data.books.reduce((n, b) => n + b.total_copies, 0), 'Wszystkich egzemplarzy'],
    [Bookmark, data.books.reduce((n, b) => n + b.available_copies, 0), 'Dostępnych egzemplarzy'],
    [admin ? Users : Bookmark, admin ? data.users.length : data.reservations.filter(r => r.status === 'pending').length, admin ? 'Kont użytkowników' : 'Rezerwacji do wydania'],
  ].map(([Icon, value, label]) => <article className="stat-card" key={label}><Icon size={22} strokeWidth={1.5} /><strong>{value}</strong><span>{label}</span></article>)}</div><div className="two-columns"><section className="panel"><h2>Rezerwacje w liczbach</h2><p>Cała historia biblioteki według aktualnych statusów.</p>{['pending', 'confirmed', 'returned', 'cancelled'].map(status => { const count = data.reservations.filter(r => r.status === status).length; return <div className="stat-row" key={status}><div><span>{statusLabels[status]}</span><strong>{count}</strong></div><progress max={Math.max(data.reservations.length, 1)} value={count} aria-label={statusLabels[status]} /></div>; })}</section><section className="panel"><h2>{admin ? 'Zarządzaj biblioteką' : 'Co dziś robimy?'}</h2><div className="quick-links">{admin && <Link to="/admin/uzytkownicy"><Users size={21} /><span><strong>Konta i role</strong><small>Uprawnienia i aktywność użytkowników</small></span></Link>}<Link to="/bibliotekarz/rezerwacje"><Bookmark size={21} /><span><strong>Wydaj książkę lub przyjmij zwrot</strong><small>Przejdź do bieżących rezerwacji</small></span></Link><Link to="/bibliotekarz/ksiazki"><Library size={21} /><span><strong>Zadbaj o księgozbiór</strong><small>Dodaj książkę lub nowy egzemplarz</small></span></Link><Link to="/bibliotekarz/import"><BookOpen size={21} /><span><strong>Zaimportuj nowe książki</strong><small>Wczytaj listę z pliku CSV lub XLSX</small></span></Link></div></section></div></>}</>;
}

export function SettingsPage() {
  return <><PageTitle eyebrow="ADMINISTRATOR" title="Ustawienia biblioteki">Konfiguracja całego systemu.</PageTitle><section className="panel"><Settings size={32} /><h2>Ustawienia są w przygotowaniu</h2><p>W tej wersji aplikacji nie można jeszcze zmieniać ustawień całej biblioteki.</p><Notice>Kontami, rolami i dostępem czytelników możesz zarządzać już teraz.</Notice><Link className="button" to="/admin/uzytkownicy">Zarządzaj użytkownikami</Link></section></>;
}
