'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const PWA_INSTALLED_KEY = 'wanderloom_pwa_installed';

export const PWA_TOAST_ALREADY_INSTALLED =
  '✔️ النظام مثبت لديك بالفعل على هذا الجهاز.';

export const PWA_TOAST_IOS =
  "📱 أجهزة آبل: يرجى الضغط على أيقونة المشاركة (Share) ثم 'إضافة للشاشة الرئيسية'.";

export const PWA_TOAST_BROWSER_MENU =
  "💡 لتثبيت النظام: يرجى اختيار 'تثبيت التطبيق' (Install App) من قائمة المتصفح العلوية (⋮).";

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isPwaMarkedInstalled(): boolean {
  if (isStandaloneDisplay()) return true;
  try {
    return sessionStorage.getItem(PWA_INSTALLED_KEY) === '1';
  } catch {
    return false;
  }
}

export function resolvePwaFallbackToastMessage(): string {
  if (isPwaMarkedInstalled()) {
    return PWA_TOAST_ALREADY_INSTALLED;
  }
  if (isIosDevice()) {
    return PWA_TOAST_IOS;
  }
  return PWA_TOAST_BROWSER_MENU;
}

/**
 * Native PWA install — captures `beforeinstallprompt`; button stays visible always
 * (hidden only when already running as installed standalone app).
 */
export function usePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isStandaloneDisplay()) {
      setIsStandalone(true);
      return;
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setDeferredPrompt(null);
      try {
        sessionStorage.setItem(PWA_INSTALLED_KEY, '1');
      } catch {
        /* ignore */
      }
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showFallbackToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    setShowToast(true);
    toastTimerRef.current = setTimeout(() => {
      setShowToast(false);
      toastTimerRef.current = null;
    }, 5000);
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (deferredPrompt) {
      setBusy(true);
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setDeferredPrompt(null);
          try {
            sessionStorage.setItem(PWA_INSTALLED_KEY, '1');
          } catch {
            /* ignore */
          }
        }
      } finally {
        setDeferredPrompt(null);
        setBusy(false);
      }
      return;
    }

    showFallbackToast(resolvePwaFallbackToastMessage());
  }, [deferredPrompt, showFallbackToast]);

  return {
    isStandalone,
    busy,
    showToast,
    toastMessage,
    handleInstallClick,
  };
}
