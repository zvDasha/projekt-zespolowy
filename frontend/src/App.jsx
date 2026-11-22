import { Link, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Catalog from './pages/Catalog';
import BookDetails from './pages/BookDetails';
import Scanner from './pages/Scanner';
import Upcoming from './pages/Upcoming';
import Auth from './pages/Auth';
import Profile from './pages/Profile';
import Reservations from './pages/Reservations';
import Favorites from './pages/Favorites';
import { Protected } from './auth';
import { Dashboard, ManagementLayout, SettingsPage } from './pages/Management';
import ManageBooks from './pages/ManageBooks';
import BookEditor from './pages/BookEditor';
import ImportBooks from './pages/ImportBooks';
import Users from './pages/Users';

export default function App() {
  return <Routes><Route element={<Layout />}>
    <Route index element={<Catalog home />} />
    <Route path="katalog" element={<Catalog key="catalog" />} />
    <Route path="ksiazki/:id" element={<BookDetails />} />
    <Route path="skaner" element={<Scanner />} />
    <Route path="rekomendacje" element={<Upcoming />} />
    <Route path="kluby" element={<Upcoming chat />} />
    <Route path="logowanie" element={<Auth key="login" />} />
    <Route path="rejestracja" element={<Auth key="register" mode="register" />} />
    <Route path="zapomniane-haslo" element={<Auth key="forgot" mode="forgot" />} />
    <Route path="reset-hasla" element={<Auth key="reset" mode="reset" />} />
    <Route element={<Protected />}>
      <Route path="profil" element={<Profile />} />
      <Route path="rezerwacje" element={<Reservations />} />
      <Route path="ulubione" element={<Favorites />} />
    </Route>
    <Route element={<Protected roles={['librarian', 'admin']} />}>
      <Route path="bibliotekarz" element={<ManagementLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="ksiazki" element={<ManageBooks />} />
        <Route path="ksiazki/nowa" element={<BookEditor key="new" />} />
        <Route path="ksiazki/:id" element={<BookEditor />} />
        <Route path="rezerwacje" element={<Reservations staff />} />
        <Route path="import" element={<ImportBooks />} />
      </Route>
    </Route>
    <Route element={<Protected roles={['admin']} />}>
      <Route path="admin" element={<ManagementLayout admin />}>
        <Route index element={<Dashboard admin />} />
        <Route path="uzytkownicy" element={<Users />} />
        <Route path="ustawienia" element={<SettingsPage />} />
      </Route>
    </Route>
    <Route path="*" element={<div className="empty-state"><span className="eyebrow">404 · ZAGUBIONA STRONA</span><h1>Ta historia jeszcze nie istnieje</h1><p>Sprawdź adres albo wróć do naszej biblioteki.</p><Link className="button" to="/">Strona główna</Link></div>} />
  </Route></Routes>;
}
