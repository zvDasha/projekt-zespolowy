import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { api, refreshData } from '../api';
import { useApi } from '../hooks';
import { dateLabel, Empty, ErrorBox, Loading, Notice, PageTitle, Status } from '../components/UI';

export default function Reservations({ staff = false }) {
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const result = useApi(staff ? '/reservations' : '/reservations/me', 10000);
  const items = (result.data || []).filter(r => (filter === 'all' || (filter === 'active' ? ['pending', 'confirmed'].includes(r.status) : r.status === filter)) && `${r.book_title} ${r.user_email} ${r.inventory_number}`.toLocaleLowerCase('pl').includes(search.toLocaleLowerCase('pl')));
  async function action(reservation, type) {
    if (type === 'cancel' && !window.confirm(`Anulować rezerwację „${reservation.book_title}”?`)) return;
    setBusy(reservation.id); setError(''); setMessage('');
    try {
      await api(`/reservations/${reservation.id}/${type}`, { method: 'POST' });
      setMessage({ cancel: 'Rezerwacja została anulowana.', confirm: 'Wydano książkę. Termin zwrotu został zapisany.', return: 'Przyjęto zwrot. Egzemplarz jest ponownie dostępny.' }[type]);
    } catch (error) { setError(error.message); }
    finally { refreshData(); setBusy(null); }
  }
  return <><PageTitle eyebrow={staff ? 'PANEL BIBLIOTEKARZA' : 'TWOJA CZYTELNICZA HISTORIA'} title={staff ? 'Wypożyczenia i zwroty' : 'Moje rezerwacje'} action={<button className="button button-outline" onClick={result.reload}><RefreshCw size={16} /> Odśwież</button>}>{staff ? 'Wydawaj książki, przyjmuj zwroty i sprawdzaj rezerwacje.' : 'Wszystkie Twoje książki — od rezerwacji do ostatniej strony.'}</PageTitle><div className="filters-top"><label>Status<select value={filter} onChange={e => setFilter(e.target.value)}><option value="active">Aktywne rezerwacje</option><option value="pending">Oczekuje na odbiór</option><option value="confirmed">Wypożyczone</option><option value="returned">Zwrócone</option><option value="cancelled">Anulowane</option><option value="all">Cała historia</option></select></label><label>{staff ? 'Książka, czytelnik lub egzemplarz' : 'Szukaj w rezerwacjach'}<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Wpisz, czego szukasz…" /></label></div><ErrorBox error={error || result.error} reload={result.error ? result.reload : undefined} /><Notice>{message}</Notice>{result.loading ? <Loading /> : items.length ? <div className="reservation-list">{items.map(r => <article className="reservation-card" key={r.id}><div className="reservation-main"><Status status={r.status} /><Link to={`/ksiazki/${r.book_id}`}><h3>{r.book_title}</h3></Link><p>Egzemplarz {r.inventory_number}{staff && <> · {r.user_email}</>}</p><div className="reservation-dates"><span>Rezerwacja: {dateLabel(r.reserved_at)}</span>{r.due_date && <span>Termin zwrotu: <strong>{dateLabel(r.due_date)}</strong></span>}{r.returned_at && <span>Zwrócono: {dateLabel(r.returned_at)}</span>}</div></div><div className="actions">{staff && r.status === 'pending' && <button className="button" disabled={busy !== null} onClick={() => action(r, 'confirm')}>Wydaj książkę</button>}{staff && r.status === 'confirmed' && <button className="button" disabled={busy !== null} onClick={() => action(r, 'return')}>Przyjmij zwrot</button>}{r.status === 'pending' && <button className="button button-outline" disabled={busy !== null} onClick={() => action(r, 'cancel')}>Anuluj rezerwację</button>}{!staff && ['confirmed', 'returned'].includes(r.status) && <Link className="button button-outline" to={`/ksiazki/${r.book_id}`}>Zobacz książkę i oceń</Link>}</div></article>)}</div> : !result.error && <Empty title="Nie ma tu jeszcze rezerwacji">{filter === 'active' ? 'Wybierz książkę z katalogu albo zajrzyj do historii.' : 'Brak rezerwacji spełniających wybrane warunki.'}</Empty>}<p className="small muted">Statusy odświeżają się co 10 sekund oraz po wykonaniu akcji.</p></>;
}
