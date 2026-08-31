import 'server-only';

/**
 * Re-export welcome notification helpers.
 * Prefer importing from `@/lib/welcome-notifications` in server code.
 */
export {
  buildPaymentWelcomeMessage,
  sendWelcomeNotification,
  type WelcomeCustomerData,
  type WelcomeNotificationResult,
  type WelcomeTripData,
} from '@/lib/welcome-notifications';
