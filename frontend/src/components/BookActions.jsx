import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Star } from 'lucide-react';
import { api, refreshData } from '../api';
import { useAuth } from '../auth';
import { FavoriteButton, useFavorites } from '../favorites';
import { useApi } from '../hooks';
import { ErrorBox, Notice, Status } from './UI';

export default function BookActions({ book, reviews }) {
  const { user } = useAuth();
  const { error: favoriteError } = useFavorites();
  const reservations = useApi(user ? '/reservations/me' : null, 10000);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(5);
  const own = (reservations.data || []).filter((r) => r.book_id === book.id);
  const current = own.find((r) => ['pending', 'confirmed'].includes(r.status));
  const mayReview = own.some((r) => ['confirmed', 'returned'].includes(r.status));
  const reviewed = reviews?.some((r) => r.user_id === user?.id);
  async function submit(event) {
    event?.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const form = event?.currentTarget;
    try {
      await api(form ? `/books/${book.id}/reviews` : '/reservations', {
        method: 'POST',
        body: form
          ? { rating, comment: new FormData(form).get('comment').trim() || null }
          : { book_id: book.id },
      });
      setMessage(
        form
          ? 'Dziękujemy za Twoją opinię!'
          : 'Książka została zarezerwowana. Czeka na wydanie w bibliotece.',
      );
      form?.reset();
    } catch (error) {
      setError(error.message);
    } finally {
      refreshData();
      setBusy(false);
    }
  }
  return (
    <>
      <div className="reserve-box">
        <strong>
          {book.available_copies
            ? `${book.available_copies} z ${book.total_copies} egzemplarzy dostępnych`
            : 'Wszystkie egzemplarze są niedostępne'}
        </strong>
        <p>Zarezerwuj online. Wypożyczenie trwa 14 dni od wydania książki.</p>
        {current && (
          <p className="inline">
            <Status status={current.status} />
            <Link className="text-link" to="/rezerwacje">
              Twoja rezerwacja
            </Link>
          </p>
        )}
        <div className="actions">
          {!user ? (
            <Link className="button" to="/logowanie" state={{ from: `/ksiazki/${book.id}` }}>
              Zaloguj się, aby zarezerwować
            </Link>
          ) : (
            !current && (
              <button
                className="button"
                disabled={busy || reservations.loading || !!reservations.error || !book.available_copies}
                onClick={() => submit()}
              >
                <Bookmark size={17} />
                {busy
                  ? 'Zapisywanie…'
                  : book.available_copies
                    ? 'Zarezerwuj książkę'
                    : 'Brak dostępnych egzemplarzy'}
              </button>
            )
          )}
          <FavoriteButton book={book} />
        </div>
        <ErrorBox
          error={error || favoriteError || reservations.error}
          reload={reservations.error ? reservations.reload : undefined}
        />
        <Notice>{message}</Notice>
      </div>
      {user && (
        <div className="review-form">
          <h3>Twoja opinia</h3>
          {reviewed ? (
            <p>Dziękujemy — Twoja ocena jest już zapisana.</p>
          ) : mayReview ? (
            <form className="form-stack" onSubmit={submit}>
              <fieldset className="rating-input">
                <legend>Ocena książki</legend>
                {[1, 2, 3, 4, 5].map((value) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="rating"
                      value={value}
                      checked={rating === value}
                      onChange={() => setRating(value)}
                    />
                    <Star size={18} fill={value <= rating ? 'currentColor' : 'none'} />
                    <span>{value}</span>
                  </label>
                ))}
              </fieldset>
              <label>
                Komentarz <span className="optional">(opcjonalnie)</span>
                <textarea name="comment" maxLength={2000} rows={3} placeholder="Co sądzisz o tej książce?" />
              </label>
              <button className="button" disabled={busy || !reviews}>
                Dodaj opinię
              </button>
            </form>
          ) : (
            <p>Ocenę dodasz po wydaniu książki przez bibliotekarza. Sama rezerwacja nie wystarcza.</p>
          )}
        </div>
      )}
    </>
  );
}
