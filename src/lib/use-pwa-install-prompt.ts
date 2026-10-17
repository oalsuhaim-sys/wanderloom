'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const PWA_INSTALLED_KEY = 'wanderloom_pwa_installed';

export const PWA_TOAST_ALREADY_INSTALLED =
  'النظام مثبت بالفعل على جهازك وهو جاهز للاستخدام.';

export const PWA_TOAST_IOS =
  'لتثبيت تطبيق Wanderloom على جهازك: اضغط أيقونة المشاركة ثم «إضافة إلى الشاشة الرئيسية».';

export const PWA_TOAST_BROWSER_MENU =
  'لتثبيت تطبيق Wanderloom على جهازك: من خيارات المتصفح (⋮) اختر «إضافة إلى الشاشة الرئيسية» أو «تثبيت التطبيق».';

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

function subscribeStandaloneDisplay(onStoreChange: () => void) {
  const mq = window.matchMedia('(display-mode: standalone)');
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

/**
 * Native PWA install — captures `beforeinstallprompt` and keeps one listener for the app.
 */
export function usePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  /** Prefer external store over setState-in-effect so SSR/hydration stays correct. */
  const isStandalone = useSyncExternalStore(
    subscribeStandaloneDisplay,
    isStandaloneDisplay,
    () => false
  );
  const [acceptedInstall, setAcceptedInstall] = useState(false);
  const [sessionInstalled, setSessionInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSessionInstalled(isPwaMarkedInstalled());
  }, []);

  useEffect(() => {
    if (isStandalone) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setAcceptedInstall(true);
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
  }, [isStandalone]);

  const showFallbackToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    setShowToast(true);
    toastTimerRef.current = setTimeout(() => {
      setShowToast(false);
      toastTimerRef.current = null;
    }, 5000);
  }, []);

  const isInstalled = isStandalone || acceptedInstall || sessionInstalled;

  const handleInstallClick = useCallback(async () => {
    if (isInstalled) {
      showFallbackToast(PWA_TOAST_ALREADY_INSTALLED);
      return;
    }

    if (deferredPrompt) {
      setBusy(true);
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setAcceptedInstall(true);
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
  }, [deferredPrompt, isInstalled, showFallbackToast]);

  return {
    isStandalone,
    isInstalled,
    busy,
    showToast,
    toastMessage,
    handleInstallClick,
  };
}
