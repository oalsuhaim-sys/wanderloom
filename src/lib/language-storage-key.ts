/**
 * localStorage key for the chosen site language. Lives in a plain module (not a 'use client' one)
 * so the root layout — a Server Component — can read the real string for its bootstrap script.
 */
export const LANGUAGE_STORAGE_KEY = 'wanderloom-locale';
