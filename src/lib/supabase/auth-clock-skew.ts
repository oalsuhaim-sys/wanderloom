import type { SupabaseClient } from '@supabase/supabase-js';

function extractErrorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message ?? '';
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return String(error);
}

/** Detect PostgREST / GoTrue "JWT issued at future" (local clock skew). */
export function isJwtClockSkewError(error: unknown): boolean {
  const message = extractErrorMessage(error);
  if (!message) return false;
  return (
    /JWT issued at future/i.test(message) ||
    /issued at future/i.test(message) ||
    /token used before issued/i.test(message)
  );
}

export function isJwtClockSkewMessage(message: string | null | undefined): boolean {
  return isJwtClockSkewError(message ?? '');
}

/**
 * Silent session recovery after clock skew:
 * getSession → refreshSession → brief wait → re-read session.
 */
export async function recoverSupabaseSessionFromClockSkew(
  client: SupabaseClient,
): Promise<boolean> {
  console.warn('Clock skew detected. Refreshing Supabase session...');
  try {
    // Prefer a fresh session read first (cheap); then force refresh so iat aligns.
    await client.auth.getSession();

    const { data: refreshed, error: refreshError } =
      await client.auth.refreshSession();
    if (!refreshError && refreshed.session?.access_token) {
      return true;
    }

    // Local clock may still be slightly ahead — wait then re-read session.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const { data: sessionData } = await client.auth.getSession();
    if (sessionData.session?.access_token) {
      return true;
    }

    if (refreshError) {
      console.warn(
        '[supabase] clock skew refresh failed:',
        refreshError.message,
      );
    }
    return false;
  } catch (err) {
    console.warn('[supabase] clock skew recovery threw:', err);
    return false;
  }
}

/**
 * Run an async operation once; on JWT clock-skew error, refresh session and retry once.
 */
export async function withSupabaseAuthRetry<T>(
  client: SupabaseClient,
  operation: () => Promise<T>,
  getError: (result: T) => unknown,
): Promise<T> {
  const first = await operation();
  if (!isJwtClockSkewError(getError(first))) {
    return first;
  }

  const recovered = await recoverSupabaseSessionFromClockSkew(client);
  if (!recovered) {
    return first;
  }

  return operation();
}

/** True if any of the given errors look like JWT clock skew. */
export function anyJwtClockSkewError(
  ...errors: Array<unknown>
): boolean {
  return errors.some((error) => isJwtClockSkewError(error));
}
