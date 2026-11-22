import { createContext, useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useAuth } from './auth';

const FavoritesContext = createContext(null);
export const useFavorites = () => useContext(FavoritesContext);
export function readFavorites(key) {
  try {
    const values = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(values) ? [...new Set(values.filter(Number.isInteger))] : [];
  } catch { return []; }
}
export default function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const key = 'library-favorites-' + (user?.id || 'guest');
  const [saved, setSaved] = useState({ key, ids: readFavorites(key) });
  const [error, setError] = useState('');
  const ids = saved.key === key ? saved.ids : [];
  useEffect(() => {
    const load = () => setSaved({ key, ids: readFavorites(key) });
    load(); setError('');
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, [key]);
  function toggle(id) {
    const next = ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id];
    try { localStorage.setItem(key, JSON.stringify(next)); setSaved({ key, ids: next }); setError(''); }
    catch { setError('Przeglądarka nie pozwala zapisać ulubionych. Włącz pamięć lokalną.'); }
  }
  return <FavoritesContext.Provider value={{ ids, toggle, error }}>{children}</FavoritesContext.Provider>;
}
export function FavoriteButton({ book, compact = false }) {
  const { user } = useAuth();
  const { ids, toggle } = useFavorites();
  const selected = ids.includes(book.id);
  const label = selected ? 'Usuń z ulubionych' : 'Dodaj do ulubionych';
  const className = compact ? 'favorite-button' : 'button button-outline';
  if (!user) return <Link className={className} to="/logowanie" state={{ from: `/ksiazki/${book.id}` }} aria-label={`${label}: ${book.title}`} title={label}><Heart size={18} />{!compact && label}</Link>;
  return <button className={`${className} ${selected ? 'is-favorite' : ''}`} aria-pressed={selected} aria-label={`${label}: ${book.title}`} title={label} onClick={() => toggle(book.id)}><Heart size={18} fill={selected ? 'currentColor' : 'none'} />{!compact && label}</button>;
}
