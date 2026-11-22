import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { api, refreshData } from '../api';
import { useApi } from '../hooks';
import { BookCover } from '../components/BookCard';
import { ErrorBox, Loading, Notice, PageTitle, Status } from '../components/UI';

export default function BookEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const result = useApi(id ? `/books/${id}` : null);
  const copies = useApi(id ? `/books/${id}/copies` : null, 15000);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const body = {
      title: values.title.trim(),
      author: values.author.trim(),
      isbn: values.isbn.trim(),
      genre: values.genre.trim(),
      publication_year: values.publication_year ? Number(values.publication_year) : null,
      description: values.description.trim() || null,
      cover_url: values.cover_url.trim() || null,
    };
    if (!id) body.copies = Number(values.copies);
    try {
      const book = await api(id ? `/books/${id}` : '/books', { method: id ? 'PATCH' : 'POST', body });
      refreshData();
      setMessage(id ? 'Zmiany zostały zapisane.' : 'Książka została dodana.');
      if (!id) navigate(`/bibliotekarz/ksiazki/${book.id}`, { replace: true });
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function changeCopies(event, copy) {
    event?.preventDefault();
    if (copy && !window.confirm(`Usunąć egzemplarz ${copy.inventory_number}?`)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(`/books/${id}/copies${copy ? '/' + copy.id : ''}`, {
        method: copy ? 'DELETE' : 'POST',
        ...(!copy ? { body: { count: Number(new FormData(event.currentTarget).get('count')) } } : {}),
      });
      setMessage(copy ? 'Egzemplarz został usunięty.' : 'Nowe egzemplarze zostały dodane.');
      refreshData();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  if (result.loading) return <Loading />;
  if (id && !result.data) return <ErrorBox error={result.error} reload={result.reload} />;
  const book = result.data || {};
  return (
    <>
      <PageTitle
        eyebrow="KSIĘGOZBIÓR"
        title={id ? 'Edytuj książkę' : 'Nowa książka'}
        action={
          <Link className="button button-outline" to="/bibliotekarz/ksiazki">
            Wróć do księgozbioru
          </Link>
        }
      >
        Zadbaj o dane, które pomogą czytelnikom znaleźć właściwą lekturę.
      </PageTitle>
      <ErrorBox error={error || result.error} />
      <Notice>{message}</Notice>
      <div className="editor-layout">
        <section className="panel">
          <form className="form-stack" onSubmit={save} key={id || 'new'}>
            <label>
              Tytuł
              <input name="title" defaultValue={book.title} required maxLength={255} />
            </label>
            <label>
              Autor
              <input name="author" defaultValue={book.author} required maxLength={255} />
            </label>
            <div className="form-row">
              <label>
                ISBN
                <input
                  name="isbn"
                  defaultValue={book.isbn}
                  required
                  maxLength={20}
                  placeholder="10 lub 13 znaków"
                />
              </label>
              <label>
                Gatunek
                <input name="genre" defaultValue={book.genre} required maxLength={100} />
              </label>
            </div>
            <div className="form-row">
              <label>
                Rok wydania
                <input
                  name="publication_year"
                  type="number"
                  defaultValue={book.publication_year || ''}
                  min={1450}
                  max={new Date().getFullYear() + 1}
                />
              </label>
              {!id && (
                <label>
                  Liczba egzemplarzy
                  <input name="copies" type="number" min={0} max={50} defaultValue={1} required />
                </label>
              )}
            </div>
            <label>
              Opis
              <textarea name="description" defaultValue={book.description || ''} rows={5} maxLength={10000} />
            </label>
            <label>
              Adres okładki
              <input
                name="cover_url"
                defaultValue={book.cover_url || ''}
                maxLength={500}
                placeholder="https://… lub /images/covers/…"
                pattern="https?://.+|/images/.+"
              />
              <small>Adres zdjęcia JPG, PNG lub WebP, nie strony z książką.</small>
            </label>
            <button className="button" disabled={busy}>
              {busy ? 'Zapisywanie…' : id ? 'Zapisz zmiany' : 'Dodaj książkę'}
            </button>
          </form>
        </section>
        <aside>
          {id && (
            <>
              <div className="editor-cover">
                <BookCover book={book} />
              </div>
              <section className="panel">
                <h2>Egzemplarze</h2>
                <ErrorBox error={copies.error} reload={copies.reload} />
                {copies.loading ? (
                  <Loading />
                ) : (
                  <ul className="copy-list">
                    {copies.data?.map((copy) => (
                      <li key={copy.id}>
                        <span>
                          <strong>{copy.inventory_number}</strong>
                          <Status status={copy.status} />
                        </span>
                        <button
                          className="icon-button danger-text"
                          aria-label={`Usuń egzemplarz ${copy.inventory_number}`}
                          disabled={busy || copy.status !== 'available'}
                          onClick={() => changeCopies(null, copy)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {copies.data?.length === 0 && <p>Brak egzemplarzy.</p>}
                <form className="form-stack" onSubmit={changeCopies}>
                  <label>
                    Nowe egzemplarze
                    <input name="count" type="number" defaultValue={1} min={1} max={50} required />
                  </label>
                  <button className="button button-outline" disabled={busy}>
                    Dodaj egzemplarze
                  </button>
                </form>
              </section>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
