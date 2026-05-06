'use client';

import { useEffect } from 'react';

const STORAGE_KEY = 'wl-scroll-trip-form';

/** بعد التنقل من صفحة أخرى إلى الرئيسية، ينفّذ تمريراً سلساً إلى قسم نموذج الرحلة. */
export function ScrollToLeadOnMount() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (sessionStorage.getItem(STORAGE_KEY) !== '1') return;
      sessionStorage.removeItem(STORAGE_KEY);
      const id = window.setTimeout(() => {
        document.getElementById('lead')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
      return () => clearTimeout(id);
    } catch {
      /* ignore */
    }
  }, []);

  return null;
}

export function requestScrollToTripForm() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}
