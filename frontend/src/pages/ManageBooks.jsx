import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api, refreshData } from '../api';
import { useApi } from '../hooks';
import { BookCover } from '../components/BookCard';
import { Empty, ErrorBox, Loading, Notice, PageTitle } from '../components/UI';

export default function ManageBooks() {
  const [params, setParams] = useSearchParams();
  const query = new URLSearchParams(params); query.set('page_size', '10'); query.set('sort', '-added');
  const result = useApi('/books?' + query, 15000);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function remove(book) {
    if (!window.confirm(`Usunąć książkę „${book.title}” wraz z jej egzemplarzami?`)) return;
    setError(''); setMessage(''); setBusy(true);
    try { await api(`/books/${book.id}`, { method: 'DELETE' }); setMessage('Książka została usunięta.'); refreshData(); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  function page(value) { const next = new URLSearchParams(params); next.set('page', String(value)); setParams(next); }
  return <><PageTitle eyebrow="PANEL BIBLIOTEKARZA" title="Księgozbiór" action={<Link className="button" to="/bibliotekarz/ksiazki/nowa"><Plus size={18} /> Dodaj książkę</Link>}>Książki, opisy, okładki i dostępne egzemplarze.</PageTitle><form className="management-search" key={params.get('q') || ''} onSubmit={e => { e.preventDefault(); setParams({ q: new FormData(e.currentTarget).get('q').trim() }); }}><input name="q" defaultValue={params.get('q') || ''} aria-label="Szukaj w księgozbiorze" placeholder="Tytuł lub autor…" maxLength={100} /><button className="button">Szukaj</button></form><ErrorBox error={error || result.error} reload={result.error ? result.reload : undefined} /><Notice>{message}</Notice>{result.loading ? <Loading /> : result.data?.items.length ? <><div className="table-scroll"><table><caption>Książki w bibliotece · {result.data.total}</caption><thead><tr><th scope="col">Książka</th><th scope="col">ISBN / rok</th><th scope="col">Dostępność</th><th scope="col">Działania</th></tr></thead><tbody>{result.data.items.map(book => <tr key={book.id}><td><div className="table-book"><div className="table-cover"><BookCover book={book} /></div><span><Link to={`/ksiazki/${book.id}`}><strong>{book.title}</strong></Link><small>{book.author}</small><small>{book.genre}</small></span></div></td><td><span className="small">{book.isbn}</span><small>{book.publication_year || '—'}</small></td><td>{book.available_copies} / {book.total_copies}<small>dostępnych</small></td><td><div className="actions"><Link className="button button-outline" to={`/bibliotekarz/ksiazki/${book.id}`}><Pencil size={15} /> Edytuj</Link><button className="icon-button danger-text" aria-label={`Usuń książkę ${book.title}`} onClick={() => remove(book)} disabled={busy}><Trash2 size={18} /></button></div></td></tr>)}</tbody></table></div><nav className="pagination" aria-label="Strony księgozbioru"><button disabled={result.data.page <= 1} onClick={() => page(result.data.page - 1)}>Poprzednia</button><span>{result.data.page} / {result.data.pages}</span><button disabled={result.data.page >= result.data.pages} onClick={() => page(result.data.page + 1)}>Następna</button></nav></> : !result.error && <Empty title="Brak książek">Zmień wyszukiwanie albo dodaj nową książkę.</Empty>}</>;
}
