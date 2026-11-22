import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Bookmark, UserRound } from 'lucide-react';
import { useAuth } from '../auth';
import { api } from '../api';
import { ErrorBox, Notice, PageTitle } from '../components/UI';

export const roleLabels = { reader: 'Czytelnik', librarian: 'Bibliotekarz', admin: 'Administrator' };
export default function Profile() {
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function save(event, password = false) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    try {
      if (password) {
        if (values.new_password !== values.confirm) throw new Error('Hasła muszą być takie same.');
        await api('/users/me/change-password', {
          method: 'POST',
          body: { current_password: values.current_password, new_password: values.new_password },
        });
        form.reset();
      } else {
        setUser(
          await api('/users/me', {
            method: 'PATCH',
            body: {
              full_name: values.full_name.trim(),
              field_of_study: values.field_of_study.trim() || null,
              preferences_text: values.preferences_text.trim() || null,
            },
          }),
        );
      }
      setMessage(password ? 'Hasło zostało zmienione.' : 'Twój profil został zapisany.');
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle eyebrow="TWOJE MIEJSCE W BIBLIOTECE" title={`Cześć, ${user.full_name.split(' ')[0]}!`}>
        Dobrze mieć własny kącik do czytania.
      </PageTitle>
      <div className="account-summary">
        <div className="avatar">
          <UserRound size={28} />
        </div>
        <div>
          <strong>{user.full_name}</strong>
          <p>{user.email}</p>
        </div>
        <span className="status">{roleLabels[user.role]}</span>
        <div className="account-links">
          <Link to="/rezerwacje" className="inline">
            <Bookmark size={18} /> Moje rezerwacje
          </Link>
          <Link to="/ulubione" className="inline">
            <Heart size={18} /> Ulubione
          </Link>
        </div>
      </div>
      <ErrorBox error={error} />
      <Notice>{message}</Notice>
      <div className="two-columns">
        <section className="panel">
          <h2>Dane i zainteresowania</h2>
          <form className="form-stack" onSubmit={save}>
            <label>
              Imię i nazwisko
              <input name="full_name" defaultValue={user.full_name} minLength={2} maxLength={150} required />
            </label>
            <label>
              Adres e-mail
              <input value={user.email} disabled readOnly />
              <small>Adres e-mail jest przypisany do Twojego konta.</small>
            </label>
            <label>
              Kierunek studiów
              <input
                name="field_of_study"
                defaultValue={user.field_of_study || ''}
                maxLength={150}
                placeholder="Np. psychologia"
              />
            </label>
            <label>
              Co lubisz czytać?
              <textarea
                name="preferences_text"
                defaultValue={user.preferences_text || ''}
                maxLength={5000}
                rows={5}
                placeholder="Ulubione tematy, autorzy, ostatnie odkrycia…"
              />
            </label>
            <small className="muted">
              Te informacje przygotują Twój profil na uruchomienie rekomendacji AI.
            </small>
            <button className="button" disabled={busy}>
              Zapisz profil
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>Zmiana hasła</h2>
          <p>Użyj hasła, które znasz tylko Ty.</p>
          <form className="form-stack" onSubmit={(e) => save(e, true)}>
            <label>
              Obecne hasło
              <input name="current_password" type="password" autoComplete="current-password" required />
            </label>
            <label>
              Nowe hasło
              <input
                name="new_password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                maxLength={200}
                required
              />
            </label>
            <label>
              Powtórz nowe hasło
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={6}
                maxLength={200}
                required
              />
            </label>
            <button className="button button-outline" disabled={busy}>
              Zmień hasło
            </button>
          </form>
          <p className="small">
            Konto założone przez Google? Hasło możesz ustawić przez{' '}
            <Link className="text-link" to="/zapomniane-haslo">
              reset hasła
            </Link>
            .
          </p>
        </section>
      </div>
    </>
  );
}
