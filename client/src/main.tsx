import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { wakeApi } from './lib/api';

void wakeApi();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    window.setTimeout(() => {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }, 2500);
  });
}

createRoot(document.getElementById('root')!).render(<App />);
