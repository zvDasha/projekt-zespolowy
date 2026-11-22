import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import AuthProvider from './auth';
import FavoritesProvider from './favorites';

createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><FavoritesProvider><App /></FavoritesProvider></AuthProvider></BrowserRouter>);
