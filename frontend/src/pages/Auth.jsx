import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, LockKeyhole } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorBox, Notice } from '../components/UI';

function GoogleButton({ onToken, onError }) {
  const holder = useRef(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  useEffect(() => {
    if (!clientId) return;
    let active = true;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
    script.onload = () => {
      if (!active || !window.google?.accounts) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: async response => {
        try { const data = await api('/auth/google', { method: 'POST', body: { id_token: response.credential } }); await onToken(data.access_token); }
        catch (error) { if (active) onError(error.message); }
      } });
      window.google.accounts.id.renderButton(holder.current, { type: 'standard', theme: 'outline', size: 'large', locale: 'pl', width: 280 });
    };
    script.onerror = () => { if (active) onError('Nie udało się wczytać logowania Google.'); };
    document.head.appendChild(script);
    return () => { active = false; script.remove(); };
  }, [clientId]);
  return clientId ? <div className="google-button" ref={holder} /> : <p className="small muted">Logowanie Google nie jest jeszcze skonfigurowane.</p>;
}

export default function Auth({ mode = 'login' }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [devToken, setDevToken] = useState('');
  const titles = { login: 'Dobrze Cię widzieć.', register: 'Zacznij nową historię.', forgot: 'Zapomniane hasło?', reset: 'Ustaw nowe hasło.' };
  async function acceptToken(token) {
    await login(token);
    const from = location.state?.from;
    navigate(from?.startsWith('/') && !from.startsWith('//') ? from : '/profil', { replace: true });
  }
  async function submit(event) {
    event.preventDefault(); setError(''); setMessage(''); setBusy(true);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (mode === 'login') {
        const data = await api('/auth/login', { method: 'POST', body: new URLSearchParams({ username: values.email.trim(), password: values.password }) });
        await acceptToken(data.access_token);
      } else if (mode === 'register') {
        if (values.password !== values.confirm) throw new Error('Hasła muszą być takie same.');
        await api('/auth/register', { method: 'POST', body: { email: values.email.trim(), password: values.password, full_name: values.full_name.trim(), field_of_study: values.field_of_study.trim() || null } });
        navigate('/logowanie', { state: { message: 'Konto zostało utworzone. Możesz się zalogować.' } });
      } else if (mode === 'forgot') {
        const data = await api('/auth/forgot-password', { method: 'POST', body: { email: values.email.trim() } });
        setDevToken(data.dev_reset_token || '');
        setMessage('Jeśli konto istnieje, został wygenerowany kod resetowania. W tej wersji wiadomości e-mail nie są wysyłane.');
      } else {
        if (values.new_password !== values.confirm) throw new Error('Hasła muszą być takie same.');
        await api('/auth/reset-password', { method: 'POST', body: { token: values.token.trim(), new_password: values.new_password } });
        navigate('/logowanie', { state: { message: 'Hasło zostało zmienione. Zaloguj się nowym hasłem.' } });
      }
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <div className="auth-layout"><section className="auth-story"><BookOpen size={42} strokeWidth={1.2} /><span className="eyebrow">TWOJE MIEJSCE MIĘDZY WIERSZAMI</span><h2>Tyle historii.<br />Jedna Twoja półka.</h2><p>Rezerwuj książki, zapisuj ulubione tytuły i dziel się tym, co warto przeczytać.</p><span className="auth-story-bottom">Otwórz się na coś nowego.</span></section><section className="auth-form"><LockKeyhole size={25} /><h1>{titles[mode]}</h1><p>{mode === 'login' ? 'Zaloguj się do swojej biblioteki.' : mode === 'register' ? 'Załóż bezpłatne konto czytelnika.' : 'Pomóżmy Ci wrócić do czytania.'}</p><ErrorBox error={error} /><Notice>{message || location.state?.message}</Notice><form className="form-stack" onSubmit={submit}>
    {mode === 'register' && <><label>Imię i nazwisko<input name="full_name" autoComplete="name" required minLength={2} maxLength={150} /></label><label>Kierunek studiów <span className="optional">(opcjonalnie)</span><input name="field_of_study" maxLength={150} placeholder="Np. informatyka" /></label></>}
    {mode !== 'reset' && <label>Adres e-mail<input name="email" type="email" autoComplete="email" required maxLength={255} /></label>}
    {mode === 'reset' && <label>Kod resetowania<textarea name="token" defaultValue={params.get('token') || location.state?.token || ''} required autoComplete="off" /></label>}
    {mode !== 'forgot' && <label>{mode === 'reset' ? 'Nowe hasło' : 'Hasło'}<input name={mode === 'reset' ? 'new_password' : 'password'} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'login' ? 1 : 6} maxLength={200} />{mode !== 'login' && <small>Minimum 6 znaków.</small>}</label>}
    {['register', 'reset'].includes(mode) && <label>Powtórz hasło<input name="confirm" type="password" autoComplete="new-password" required minLength={6} maxLength={200} /></label>}
    {mode === 'login' && <Link className="text-link" to="/zapomniane-haslo">Nie pamiętam hasła</Link>}
    <button className="button" disabled={busy}>{busy ? 'Proszę czekać…' : { login: 'Zaloguj się', register: 'Załóż konto', forgot: 'Wygeneruj kod resetowania', reset: 'Zapisz nowe hasło' }[mode]}</button>
    </form>{mode === 'login' && <><div className="form-divider">lub</div><GoogleButton onToken={acceptToken} onError={setError} /><p className="auth-bottom">Nie masz konta? <Link to="/rejestracja">Zarejestruj się</Link></p></>}{mode !== 'login' && <p className="auth-bottom"><Link to="/logowanie">Wróć do logowania</Link></p>}{devToken && <Notice>Tryb testowy: kod jest ważny przez 15 minut. <Link className="text-link" to="/reset-hasla" state={{ token: devToken }}>Ustaw nowe hasło</Link></Notice>}</section></div>;
}
