import { createContext, useContext, useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { api, getToken } from './api';
import { ErrorBox, Loading } from './components/UI';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());
  const [error, setError] = useState('');
  function logout() {
    sessionStorage.removeItem('library-token');
    setUser(null); setError(''); setLoading(false);
  }
  async function restore() {
    if (!getToken()) return;
    setLoading(true); setError('');
    try { setUser(await api('/auth/me')); }
    catch (error) { if (getToken()) setError(error.message); }
    finally { setLoading(false); }
  }
  async function login(token) {
    sessionStorage.setItem('library-token', token);
    try { const profile = await api('/auth/me'); setUser(profile); setError(''); return profile; }
    catch (error) { logout(); throw error; }
  }
  useEffect(() => {
    restore();
    window.addEventListener('library:unauthorized', logout);
    return () => window.removeEventListener('library:unauthorized', logout);
  }, []);
  return <AuthContext.Provider value={{ user, setUser, loading, error, login, logout, restore }}>{children}</AuthContext.Provider>;
}

export function Protected({ roles }) {
  const { user, loading, error, restore } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} reload={restore} />;
  if (!user) return <Navigate to="/logowanie" state={{ from: location.pathname + location.search }} replace />;
  if (roles && !roles.includes(user.role)) return <div className="empty-state"><h1>Brak dostępu</h1><p>Twoje konto nie ma uprawnień do tego panelu.</p><Link className="button" to="/">Wróć do biblioteki</Link></div>;
  return <Outlet />;
}
