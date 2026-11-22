import { Link } from 'react-router-dom';
import { AlertCircle, BookOpen, LoaderCircle } from 'lucide-react';

export function Loading() { return <div className="loading" role="status"><LoaderCircle className="spin" size={22} /> Wczytywanie…</div>; }
export function Notice({ children, error = false }) { return children ? <div className={`notice ${error ? 'notice-error' : ''}`} role={error ? 'alert' : 'status'}><AlertCircle size={18} /><div>{children}</div></div> : null; }
export function ErrorBox({ error, reload }) { return error ? <Notice error><span>{error}</span>{reload && <button className="text-button" onClick={reload}>Spróbuj ponownie</button>}</Notice> : null; }
export function Empty({ title, children }) { return <div className="empty-state"><BookOpen size={36} strokeWidth={1.3} /><h2>{title}</h2><p>{children}</p><Link className="button button-outline" to="/katalog">Przeglądaj katalog</Link></div>; }
export function PageTitle({ eyebrow, title, children, action }) { return <div className="page-title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{children && <p>{children}</p>}</div>{action}</div>; }
export const dateLabel = value => value ? new Date(value.endsWith('Z') || /[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z').toLocaleDateString('pl-PL') : '—';
export const statusLabels = { pending: 'Oczekuje na odbiór', confirmed: 'Wypożyczona', returned: 'Zwrócona', cancelled: 'Anulowana', available: 'Dostępny', reserved: 'Zarezerwowany', borrowed: 'Wypożyczony' };
export function Status({ status }) { return <span className={`status status-${status}`}>{statusLabels[status] || status}</span>; }
