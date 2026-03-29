import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import i18n from './i18n.js'

// Service Worker Registration using vite-plugin-pwa
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true);
  },
  onOfflineReady() {
    console.log('Додаток готовий до роботи офлайн');
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    try {
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
    } catch (_) {
      void _;
    }
  },
});

if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

// Network status monitoring
window.addEventListener('online', () => {
  console.log('Мережеве з\'єднання відновлено');
  document.dispatchEvent(new Event('networkStatusChange'));
});

window.addEventListener('offline', () => {
  console.warn('Втрачено мережеве з\'єднання');
  document.dispatchEvent(new Event('networkStatusChange'));
});

i18n.init().then(() => {
  const root = createRoot(document.getElementById('root'));
  try {
    root.render(
      <StrictMode>
        <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </HashRouter>
      </StrictMode>
    );
    console.log('Application mounted successfully');
  } catch (error) {
    console.error('Error rendering app:', error);
    root.render(
      <div style={{padding: '20px', color: 'red'}}>
        <h1>Critical Error</h1>
        <p>{(error || {}).toString()}</p>
      </div>
    );
  }
});
