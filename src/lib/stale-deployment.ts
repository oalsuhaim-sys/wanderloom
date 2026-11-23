/**
 * After a new deploy, a page opened earlier still calls the old Server Action ids, and Next.js answers
 * «Server Action "…" was not found on the server». Reloading the page fixes it.
 */
export function isStaleDeploymentError(err: unknown): boolean {
  if (!err) return false;
  const name = err instanceof Error ? err.name : '';
  const message = err instanceof Error ? err.message : String(err);
  return (
    name === 'UnrecognizedActionError' ||
    /Server Action .* was not found on the server|failed-to-find-server-action/i.test(message)
  );
}

export const STALE_DEPLOYMENT_MESSAGE = 'تم تحديث النظام أثناء فتح الصفحة — حدّث الصفحة لإكمال العمل.';
