import { useEffect, useState } from 'react';
import { api } from '../api';
import { useFavorites } from '../favorites';
import BookCard from '../components/BookCard';
import { Empty, ErrorBox, Loading, Notice, PageTitle } from '../components/UI';

export default function Favorites() {
  const { ids, error: storageError } = useFavorites();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    Promise.all(ids.map(id => api(`/books/${id}`, { signal: controller.signal }).catch(error => { if (error.status === 404) return null; throw error; })))
      .then(data => { if (!controller.signal.aborted) setBooks(data.filter(Boolean)); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [ids.join(','), version]);
  return <><PageTitle eyebrow="ZACHOWAJ NA PÓŹNIEJ" title="Twoja ulubiona półka">Wszystkie historie, do których chcesz wrócić.</PageTitle><Notice>Ulubione są zapisane dla Twojego konta tylko w tej przeglądarce. Nie synchronizują się między urządzeniami.</Notice><ErrorBox error={error || storageError} reload={() => setVersion(v => v + 1)} />{loading ? <Loading /> : !error && (books.length ? <div className="book-grid">{books.map(book => <BookCard key={book.id} book={book} />)}</div> : <Empty title="Zrób miejsce na dobre historie">Kliknij serduszko przy książce, aby zachować ją na później.</Empty>)}</>;
}
