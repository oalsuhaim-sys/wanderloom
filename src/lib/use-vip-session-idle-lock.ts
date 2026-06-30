'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_IDLE_MS = 7_200_000; // 2 hours

export function useVipSessionIdleLock(active: boolean, idleMs = DEFAULT_IDLE_MS) {
  const [sessionLocked, setSessionLocked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(Date.now());

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleLock = useCallback(() => {
    clearTimer();
    if (!active || sessionLocked) return;
    const elapsed = Date.now() - lastActivityRef.current;
    const remaining = Math.max(idleMs - elapsed, 0);
    timerRef.current = setTimeout(() => setSessionLocked(true), remaining);
  }, [active, clearTimer, idleMs, sessionLocked]);

  const registerActivity = useCallback(() => {
    if (!active || sessionLocked) return;
    lastActivityRef.current = Date.now();
    scheduleLock();
  }, [active, scheduleLock, sessionLocked]);

  const resetSessionLock = useCallback(() => {
    lastActivityRef.current = Date.now();
    setSessionLocked(false);
    scheduleLock();
  }, [scheduleLock]);

  useEffect(() => {
    if (!active) {
      clearTimer();
      return;
    }

    lastActivityRef.current = Date.now();
    scheduleLock();

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'wheel',
    ];

    const onActivity = () => registerActivity();
    for (const event of events) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    return () => {
      clearTimer();
      for (const event of events) {
        window.removeEventListener(event, onActivity);
      }
    };
  }, [active, clearTimer, registerActivity, scheduleLock]);

  return { sessionLocked, setSessionLocked, resetSessionLock, registerActivity };
}
