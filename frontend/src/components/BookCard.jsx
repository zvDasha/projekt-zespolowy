import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Star } from 'lucide-react';
import { api } from '../api';
import { FavoriteButton } from '../favorites';

const covers = new Map();
window.addEventListener('library:update', () => covers.clear());
export function BookCover({ book, eager = false }) {
  const [url, setUrl] = useState(book.cover_url || '');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setFailed(false);
    setUrl(book.cover_url || '');
    if (book.cover_url === undefined) {
      if (!covers.has(book.id)) covers.set(book.id, api(`/books/${book.id}`).then(b => b.cover_url).catch(() => { covers.delete(book.id); return ''; }));
      covers.get(book.id).then(value => { if (active) setUrl(value); });
    }
    return () => { active = false; };
  }, [book.id, book.cover_url]);
  const safe = url && (url.startsWith('/images/') || /^https?:\/\//.test(url));
  return safe && !failed ? <img className="book-cover" src={url} alt={`Okładka: ${book.title}`} loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(true)} /> : <div className="cover-placeholder" role="img" aria-label={`Brak okładki: ${book.title}`}><BookOpen size={32} strokeWidth={1} /><strong>{book.title}</strong><span>{book.author}</span></div>;
}
export default function BookCard({ book }) {
  return <article className="book-card"><Link to={`/ksiazki/${book.id}`} className="cover-well"><BookCover book={book} /></Link><FavoriteButton book={book} compact /><div className="book-meta"><span className="genre-label">{book.genre}</span><span className="rating"><Star size={13} fill="currentColor" /> {book.average_rating?.toLocaleString('pl-PL', { maximumFractionDigits: 1 }) || '—'}</span></div><Link to={`/ksiazki/${book.id}`}><h3>{book.title}</h3></Link><p className="book-author">{book.author}</p><span className={`availability ${book.available_copies ? '' : 'unavailable'}`}><span />{book.available_copies ? `Dostępne: ${book.available_copies} z ${book.total_copies}` : 'Obecnie niedostępna'}</span></article>;
}
