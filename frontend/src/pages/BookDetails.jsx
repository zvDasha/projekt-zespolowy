import { Link, useParams } from 'react-router-dom';
import { Star } from 'lucide-react';
import { useApi } from '../hooks';
import { BookCover } from '../components/BookCard';
import { dateLabel, ErrorBox, Loading } from '../components/UI';

export default function BookDetails() {
  const { id } = useParams();
  const { data: book, loading, error, reload } = useApi(`/books/${id}`, 15000);
  const reviews = useApi(`/books/${id}/reviews`);
  if (loading) return <Loading />;
  if (!book) return <ErrorBox error={error} reload={reload} />;
  return <><div className="breadcrumbs"><Link to="/katalog">Katalog</Link><span>/</span><span>{book.title}</span></div><ErrorBox error={error} reload={reload} /><div className="book-detail"><div className="detail-cover"><BookCover book={book} eager /></div><div><span className="eyebrow">{book.genre}</span><h1>{book.title}</h1><p className="detail-author">{book.author}</p><p className="inline"><Star size={18} className="star" fill="currentColor" /> {book.average_rating ? `${book.average_rating.toLocaleString('pl-PL')} / 5` : 'Brak ocen'} · {reviews.data?.length || 0} opinii</p><p>{book.description || 'Ta książka nie ma jeszcze opisu.'}</p><dl className="book-facts"><div><dt>Rok wydania</dt><dd>{book.publication_year || '—'}</dd></div><div><dt>ISBN</dt><dd>{book.isbn}</dd></div><div><dt>Gatunek</dt><dd>{book.genre}</dd></div></dl><div className="reserve-box"><strong>{book.available_copies ? `${book.available_copies} z ${book.total_copies} egzemplarzy dostępnych` : 'Wszystkie egzemplarze są niedostępne'}</strong><p>Zarezerwuj online i odbierz książkę w bibliotece.</p><Link className="button" to="/logowanie">Zaloguj się, aby zarezerwować</Link></div></div></div><section className="reviews-section"><h2>Między czytelnikami</h2><p>Opinie osób, którym biblioteka wydała książkę.</p><ErrorBox error={reviews.error} reload={reviews.reload} />{reviews.loading ? <Loading /> : reviews.data?.length ? reviews.data.map(review => <article className="review" key={review.id}><div className="section-heading"><strong>{review.user_name}</strong><span className="inline star"><Star size={15} fill="currentColor" />{review.rating} / 5</span></div><p>{review.comment || 'Ocena bez komentarza.'}</p><small>{dateLabel(review.created_at)}</small></article>) : <p>Jeszcze nikt nie dodał opinii.</p>}</section></>;
}
