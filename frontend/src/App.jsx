import { Link, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Catalog from './pages/Catalog';
import BookDetails from './pages/BookDetails';
import Scanner from './pages/Scanner';
import Upcoming from './pages/Upcoming';

export default function App() {
  return <Routes><Route element={<Layout />}>
    <Route index element={<Catalog home />} />
    <Route path="katalog" element={<Catalog key="catalog" />} />
    <Route path="ksiazki/:id" element={<BookDetails />} />
    <Route path="skaner" element={<Scanner />} />
    <Route path="rekomendacje" element={<Upcoming />} />
    <Route path="kluby" element={<Upcoming chat />} />
    <Route path="*" element={<div className="empty-state"><h1>Ta strona jest jeszcze pusta</h1><p>Wróć do naszej biblioteki.</p><Link className="button" to="/">Strona główna</Link></div>} />
  </Route></Routes>;
}
