import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { api, refreshData } from '../api';
import { useAuth } from '../auth';
import { useApi } from '../hooks';
import { roleLabels } from './Profile';
import { dateLabel, ErrorBox, Loading, Notice, PageTitle } from '../components/UI';
import Select from '../components/Select';

function SortHeader({ label, columnKey, sort, onSort }) {
  const active = sort.key === columnKey;
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={`sort-button ${active ? 'is-sorted' : ''}`}
        onClick={() => onSort(columnKey)}
      >
        <span>{label}</span>
        <Icon size={15} aria-hidden="true" />
      </button>
    </th>
  );
}

function UserRow({ user, self, busy, update }) {
  const [role, setRole] = useState(user.role);
  useEffect(() => setRole(user.role), [user.role]);
  return (
    <tr>
      <td>
        <strong>
          {user.full_name}
          {self && ' (Ty)'}
        </strong>
        <small>{user.email}</small>
      </td>
      <td>
        <form
          className="role-form"
          onSubmit={(e) => {
            e.preventDefault();
            update(user, { role });
          }}
        >
          <Select
            value={role}
            onChange={setRole}
            disabled={self || busy}
            label={`Rola: ${user.email}`}
            options={Object.entries(roleLabels)}
          />
          <button disabled={self || busy || role === user.role}>Zapisz</button>
        </form>
      </td>
      <td>
        <span className={`status ${user.is_active ? '' : 'status-cancelled'}`}>
          {user.is_active ? 'Aktywne' : 'Nieaktywne'}
        </span>
      </td>
      <td>{dateLabel(user.created_at)}</td>
      <td>
        <button
          className={`button button-outline ${user.is_active ? 'danger-text' : ''}`}
          disabled={self || busy}
          onClick={() => update(user, { is_active: !user.is_active })}
        >
          {user.is_active ? 'Dezaktywuj' : 'Aktywuj'}
        </button>
      </td>
    </tr>
  );
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const result = useApi('/users', 15000);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState({ key: '', dir: 'asc' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function toggleSort(key) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );
  }

  const filteredUsers = result.data?.filter(
    (user) =>
      (!role || role === user.role) &&
      (!status || (status === 'active' ? user.is_active : !user.is_active)) &&
      `${user.full_name} ${user.email}`.toLocaleLowerCase('pl').includes(search.toLocaleLowerCase('pl')),
  );

  const users =
    filteredUsers &&
    [...filteredUsers].sort((a, b) => {
      if (!sort.key) return 0;
      const factor = sort.dir === 'asc' ? 1 : -1;
      if (sort.key === 'user') {
        return (
          factor *
          `${a.full_name} ${a.email}`.localeCompare(`${b.full_name} ${b.email}`, 'pl', {
            sensitivity: 'base',
          })
        );
      }
      if (sort.key === 'role') {
        return (
          factor *
          (roleLabels[a.role] || a.role).localeCompare(roleLabels[b.role] || b.role, 'pl', {
            sensitivity: 'base',
          })
        );
      }
      if (sort.key === 'status') {
        return factor * (Number(b.is_active) - Number(a.is_active));
      }
      if (sort.key === 'created_at') {
        return factor * (new Date(a.created_at) - new Date(b.created_at));
      }
      return 0;
    });

  async function update(user, body) {
    const change = body.role
      ? `Zmienić rolę użytkownika ${user.email} na „${roleLabels[body.role]}”?`
      : `${body.is_active ? 'Aktywować' : 'Dezaktywować'} konto ${user.email}?`;
    if (!window.confirm(change)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(`/users/${user.id}`, { method: 'PATCH', body });
      setMessage('Zapisano zmiany konta.');
      refreshData();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle eyebrow="ADMINISTRATOR" title="Użytkownicy">
        Zarządzaj rolami i dostępem do biblioteki.
      </PageTitle>
      <div className="filters-top">
        <label>
          Znajdź użytkownika
          <input
            placeholder="Imię, nazwisko lub e-mail"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Rola
          <Select
            label="Rola"
            value={role}
            onChange={setRole}
            options={[['', 'Wszystkie role'], ...Object.entries(roleLabels)]}
          />
        </label>
        <label>
          Status
          <Select
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              ['', 'Wszystkie statusy'],
              ['active', 'Aktywny'],
              ['inactive', 'Nieaktywny'],
            ]}
          />
        </label>
      </div>
      <ErrorBox error={error || result.error} reload={result.error ? result.reload : undefined} />
      <Notice>{message}</Notice>
      {result.loading ? (
        <Loading />
      ) : (
        users && (
          <div className="table-scroll">
            <table>
              <caption>Konta użytkowników · {users.length}</caption>
              <thead>
                <tr>
                  <SortHeader label="Użytkownik" columnKey="user" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Rola" columnKey="role" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Status" columnKey="status" sort={sort} onSort={toggleSort} />
                  <SortHeader
                    label="Data rejestracji"
                    columnKey="created_at"
                    sort={sort}
                    onSort={toggleSort}
                  />
                  <th>Dostęp</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    self={user.id === currentUser.id}
                    busy={busy}
                    update={update}
                  />
                ))}
              </tbody>
            </table>
            {!users.length && <p className="empty-state">Nie znaleziono użytkowników.</p>}
          </div>
        )
      )}
      <p className="small muted">
        Nie możesz dezaktywować własnego konta ani odebrać sobie roli administratora.
      </p>
    </>
  );
}