import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

const isNativeOrFileRuntime =
  window.location.protocol === 'file:' ||
  window.location.protocol === 'capacitor:' ||
  Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()) ||
  Boolean((window as unknown as { electronAPI?: unknown }).electronAPI);

if (!isNativeOrFileRuntime && 'serviceWorker' in navigator) {
  registerSW({immediate: true});
}

createRoot(document.getElementById('root')!).render(<App />);
