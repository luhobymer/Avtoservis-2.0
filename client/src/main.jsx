import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import i18n from './i18n.js'

// Service Worker Registration using vite-plugin-pwa
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Доступна нова версія додатку. Оновити?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('Додаток готовий до роботи офлайн');
  },
});

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
        <BrowserRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
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
