import { useEffect, useState } from 'react';
import { api, refreshData } from '../api';
import { useAuth } from '../auth';
import { useApi } from '../hooks';
import { roleLabels } from './Profile';
import { dateLabel, ErrorBox, Loading, Notice, PageTitle } from '../components/UI';

function UserRow({ user, self, busy, update }) {
  const [role, setRole] = useState(user.role);
  useEffect(() => setRole(user.role), [user.role]);
  return <tr><td><strong>{user.full_name}{self && ' (Ty)'}</strong><small>{user.email}</small></td><td><form className="role-form" onSubmit={e => { e.preventDefault(); update(user, { role }); }}><select value={role} onChange={e => setRole(e.target.value)} disabled={self || busy} aria-label={`Rola: ${user.email}`}>{Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><button disabled={self || busy || role === user.role}>Zapisz</button></form></td><td><span className={`status ${user.is_active ? '' : 'status-cancelled'}`}>{user.is_active ? 'Aktywne' : 'Zablokowane'}</span></td><td>{dateLabel(user.created_at)}</td><td><button className={`button button-outline ${user.is_active ? 'danger-text' : ''}`} disabled={self || busy} onClick={() => update(user, { is_active: !user.is_active })}>{user.is_active ? 'Zablokuj' : 'Odblokuj'}</button></td></tr>;
}
export default function Users() {
  const { user: currentUser } = useAuth();
  const result = useApi('/users', 15000);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const users = result.data?.filter(user => (!role || role === user.role) && `${user.full_name} ${user.email}`.toLocaleLowerCase('pl').includes(search.toLocaleLowerCase('pl')));
  async function update(user, body) {
    const change = body.role ? `Zmienić rolę użytkownika ${user.email} na „${roleLabels[body.role]}”?` : `${body.is_active ? 'Odblokować' : 'Zablokować'} konto ${user.email}?`;
    if (!window.confirm(change)) return;
    setBusy(true); setError(''); setMessage('');
    try { await api(`/users/${user.id}`, { method: 'PATCH', body }); setMessage('Zapisano zmiany konta.'); refreshData(); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <><PageTitle eyebrow="ADMINISTRATOR" title="Użytkownicy">Zarządzaj rolami i dostępem do biblioteki.</PageTitle><div className="filters-top"><label>Znajdź użytkownika<input placeholder="Imię, nazwisko lub e-mail" value={search} onChange={e => setSearch(e.target.value)} /></label><label>Rola<select value={role} onChange={e => setRole(e.target.value)}><option value="">Wszystkie role</option>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><ErrorBox error={error || result.error} reload={result.error ? result.reload : undefined} /><Notice>{message}</Notice>{result.loading ? <Loading /> : users && <div className="table-scroll"><table><caption>Konta użytkowników · {users.length}</caption><thead><tr><th>Użytkownik</th><th>Rola</th><th>Status</th><th>Data rejestracji</th><th>Dostęp</th></tr></thead><tbody>{users.map(user => <UserRow key={user.id} user={user} self={user.id === currentUser.id} busy={busy} update={update} />)}</tbody></table>{!users.length && <p className="empty-state">Nie znaleziono użytkowników.</p>}</div>}<p className="small muted">Nie możesz zablokować własnego konta ani odebrać sobie roli administratora.</p></>;
}
