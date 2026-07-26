'use client';

import { useEffect } from 'react';

/** يسجّل Service Worker الأساسي — شرط ظهور زر التثبيت على التابلت */
export function PwaServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await reg.update().catch(() => undefined);
      } catch (err) {
        console.warn('[pwa] service worker registration failed:', err);
      }
    };

    // بعد تحميل الصفحة مباشرة — يزيد فرص beforeinstallprompt على التابلت
    if (document.readyState === 'complete') {
      void register();
    } else {
      window.addEventListener('load', () => void register(), { once: true });
    }
  }, []);

  return null;
}
