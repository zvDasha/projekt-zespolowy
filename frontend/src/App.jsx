import { Link, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';

export default function App() {
  return <Routes><Route element={<Layout />}>
    <Route index element={<><p className="eyebrow">TWOJA BIBLIOTEKA, TWÓJ ŚWIAT</p><h2>Dobra książka czeka na Ciebie</h2><p>Przeglądaj katalog i odkrywaj nowe historie.</p><Link className="button" to="/katalog">Przeglądaj książki</Link></>} />
    <Route path="*" element={<div className="empty-state"><h1>Ta strona jest jeszcze pusta</h1><p>Wróć do naszej biblioteki.</p><Link className="button" to="/">Strona główna</Link></div>} />
  </Route></Routes>;
}
