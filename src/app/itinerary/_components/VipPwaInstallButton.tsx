'use client';

import { useEffect, useState } from 'react';
import { Download, Smartphone } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type Props = {
  className?: string;
  label?: string;
};

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export default function VipPwaInstallButton({
  className = '',
  label = 'تثبيت التطبيق',
}: Props) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplay()) {
      setInstalled(true);
      return;
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || !deferredPrompt) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setInstalled(true);
      }
    } finally {
      setDeferredPrompt(null);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleInstall()}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-[#cda04c]/45 bg-[#1E2720] px-4 py-2 text-xs font-bold text-[#cda04c] shadow-[0_4px_20px_rgba(205,160,76,0.18)] transition hover:border-[#cda04c]/70 hover:bg-[#252f28] sm:text-sm ${className}`}
    >
      <Smartphone className="h-4 w-4 shrink-0" aria-hidden />
      <span>{label}</span>
      <Download className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
    </button>
  );
}
