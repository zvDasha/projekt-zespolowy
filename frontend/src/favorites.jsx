import { createContext, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { api } from './api';
import { useAuth } from './auth';

const FavoritesContext = createContext(null);
export const useFavorites = () => useContext(FavoritesContext);

export function readFavorites(key) {
  try {
    const values = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(values) ? [...new Set(values.filter(Number.isInteger))] : [];
  } catch {
    return [];
  }
}

function saveLocalFavorites(key, ids) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* Pamięć lokalna jest opcjonalnym cachem dla API. */
  }
}

export default function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const key = 'library-favorites-' + (user?.id || 'guest');
  const [saved, setSaved] = useState({ key, ids: readFavorites(key) });
  const [error, setError] = useState('');
  const ids = saved.key === key ? saved.ids : [];

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setSaved({ key, ids: readFavorites(key) });
    setError('');
    if (!user) return () => controller.abort();

    api('/favorites/ids', { signal: controller.signal })
      .then((serverIds) => {
        if (!active) return;
        setSaved({ key, ids: serverIds });
        saveLocalFavorites(key, serverIds);
      })
      .catch((err) => {
        if (active && !controller.signal.aborted) setError(err.message);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [key, user?.id]);

  async function toggle(id) {
    const exists = ids.includes(id);
    const next = exists ? ids.filter((value) => value !== id) : [...ids, id];
    setSaved({ key, ids: next });
    saveLocalFavorites(key, next);
    setError('');

    if (!user) return;
    try {
      await api(`/favorites/${id}`, { method: exists ? 'DELETE' : 'POST' });
    } catch (err) {
      setSaved({ key, ids });
      saveLocalFavorites(key, ids);
      setError(err.message);
    }
  }

  return <FavoritesContext.Provider value={{ ids, toggle, error }}>{children}</FavoritesContext.Provider>;
}
export function FavoriteButton({ book, compact = false }) {
  const { user } = useAuth();
  const { ids, toggle } = useFavorites();
  const selected = ids.includes(book.id);
  const label = selected ? 'Usuń z ulubionych' : 'Dodaj do ulubionych';
  const className = compact ? 'favorite-button' : 'button button-outline';
  if (!user)
    return (
      <Link
        className={className}
        to="/logowanie"
        state={{ from: `/ksiazki/${book.id}` }}
        aria-label={`${label}: ${book.title}`}
        title={label}
      >
        <Heart size={18} />
        {!compact && label}
      </Link>
    );
  return (
    <button
      className={`${className} ${selected ? 'is-favorite' : ''}`}
      aria-pressed={selected}
      aria-label={`${label}: ${book.title}`}
      title={label}
      onClick={() => toggle(book.id)}
    >
      <Heart size={18} fill={selected ? 'currentColor' : 'none'} />
      {!compact && label}
    </button>
  );
}
