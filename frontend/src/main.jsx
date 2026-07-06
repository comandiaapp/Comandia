import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ConnectivityProvider } from './context/ConnectivityContext.jsx';
import { localDb } from './db/database.js';
import './index.css';

async function iniciar() {
  // La base local se abre antes de montar React para que el primer render ya
  // pueda leer cache offline; si falla, la app arranca igual en modo online.
  try {
    await localDb.init();
  } catch (err) {
    console.warn('No se pudo inicializar la base de datos local:', err);
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ThemeProvider>
        <ConnectivityProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ConnectivityProvider>
      </ThemeProvider>
    </React.StrictMode>
  );
}

iniciar();
