import { useEffect, useState } from 'react';
import { api } from '../api';
import { useFavorites } from '../favorites';
import BookCard from '../components/BookCard';
import { Empty, ErrorBox, Loading, PageTitle } from '../components/UI';

export default function Favorites() {
  const { ids, error: favoriteError } = useFavorites();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setVersion((v) => v + 1);
    window.addEventListener('library:update', refresh);
    return () => window.removeEventListener('library:update', refresh);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api('/favorites', { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setBooks(data);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [ids.join(','), version]);

  return (
    <>
      <PageTitle eyebrow="ZACHOWAJ NA PÓŹNIEJ" title="Twoja ulubiona półka">
        Wszystkie historie, do których chcesz wrócić.
      </PageTitle>
      <ErrorBox error={error || favoriteError} reload={() => setVersion((v) => v + 1)} />
      {loading ? (
        <Loading />
      ) : (
        !error &&
        (books.length ? (
          <div className="book-grid">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        ) : (
          <Empty title="Zrób miejsce na dobre historie">
            Kliknij serduszko przy książce, aby zachować ją na później.
          </Empty>
        ))
      )}
    </>
  );
}
