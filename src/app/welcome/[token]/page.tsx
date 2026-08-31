import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function buildQuerySuffix(
  searchParams: Record<string, string | string[] | undefined> | undefined,
): string {
  if (!searchParams) return '';
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    } else {
      qs.set(key, value);
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** إعادة توجيه /welcome/{segment} → /welcome/vip/{token} أو /welcome/client/{id} (يحافظ على ?flow=) */
export default async function LegacyWelcomeRedirectPage({ params, searchParams }: PageProps) {
  const { token: rawToken } = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const query = buildQuerySuffix(resolvedSearch);
  const segment = decodeURIComponent(String(rawToken ?? '').trim());

  if (!segment) {
    redirect(`/welcome/vip/${query}`);
  }

  if (/^\d+$/.test(segment)) {
    redirect(`/welcome/client/${segment}${query}`);
  }

  redirect(`/welcome/vip/${encodeURIComponent(segment)}${query}`);
}
