'use client';

import { useEffect, useRef } from 'react';

import { useCrmEmployee } from '@/app/crm/_components/CrmEmployeeProvider';
import { getClientAccessToken } from '@/lib/crm-session-token';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers for OS-level Web Push while the CRM is open.
 * Notifications continue via the service worker even after the app is closed.
 */
export function CrmPushNotifications() {
  const { employee } = useCrmEmployee();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (!window.isSecureContext) return;

    attempted.current = true;

    const run = async () => {
      try {
        const vapidRes = await fetch('/api/crm/push/vapid', { cache: 'no-store' });
        const vapidData = (await vapidRes.json()) as {
          ok?: boolean;
          publicKey?: string;
          configured?: boolean;
        };
        if (!vapidRes.ok || !vapidData.ok || !vapidData.publicKey) {
          console.info('[crm-push] VAPID not configured — skip subscribe');
          return;
        }

        const permission =
          Notification.permission === 'granted'
            ? 'granted'
            : Notification.permission === 'denied'
              ? 'denied'
              : await Notification.requestPermission();

        if (permission !== 'granted') {
          console.info('[crm-push] notification permission:', permission);
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
          });
        }

        const json = subscription.toJSON();
        const endpoint = json.endpoint;
        const p256dh = json.keys?.p256dh;
        const auth = json.keys?.auth;
        if (!endpoint || !p256dh || !auth) return;

        const token = await getClientAccessToken();
        await fetch('/api/crm/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            endpoint,
            keys: { p256dh, auth },
            employeeId: employee?.id != null ? String(employee.id) : null,
          }),
        });
      } catch (err) {
        console.warn('[crm-push] subscribe failed:', err);
      }
    };

    // Slight delay so SW registration from root layout settles first
    const t = window.setTimeout(() => void run(), 1200);
    return () => window.clearTimeout(t);
  }, [employee?.id]);

  return null;
}
