import React from 'react';
import ReactDOM from 'react-dom/client';
import { GlobalStyles } from '@contentful/f36-components';
import App from './App';

const container = document.getElementById('root')!;
const root = ReactDOM.createRoot(container);

// When running locally (dev) outside Contentful iframe, SDK won't initialize.
// Only render the app when embedded in Contentful (inside iframe).
if (import.meta.env.DEV && window.self === window.top) {
  root.render(
    <React.StrictMode>
      <GlobalStyles />
      <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
        <h2>Contento</h2>
        <p>This app runs inside Contentful. Open it from the Apps menu in your space.</p>
        <p>For local development, use the Contentful CLI to serve this app.</p>
      </div>
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <GlobalStyles />
      <App />
    </React.StrictMode>
  );
}
