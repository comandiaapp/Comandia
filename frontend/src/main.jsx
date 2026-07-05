import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ConnectivityProvider } from './context/ConnectivityContext.jsx';
import './index.css';

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
