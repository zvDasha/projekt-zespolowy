import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import AuthProvider from './auth';
import FavoritesProvider from './favorites';

// Filtry i pola formularzy reagują od razu na zmianę adresu.
createRoot(document.getElementById('root')).render(
  <BrowserRouter useTransitions={false}>
    <AuthProvider>
      <FavoritesProvider>
        <App />
      </FavoritesProvider>
    </AuthProvider>
  </BrowserRouter>,
);
