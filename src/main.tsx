import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// The default fonts ship with the site itself (SIL Open Font License), so they work offline
// and without any third-party requests. Other fonts in the Theme Closet load from Google Fonts.
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-400-italic.css';
import '@fontsource/pinyon-script/latin-400.css';
import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/homemade-apple/latin-400.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// Installable as an app (PWA). The service worker only caches the app shell, never your data.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
