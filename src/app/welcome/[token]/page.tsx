import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ token: string }>;
};

/** إعادة توجيه /welcome/{segment} → /welcome/vip/{token} أو /welcome/client/{id} */
export default async function LegacyWelcomeRedirectPage({ params }: PageProps) {
  const { token: rawToken } = await params;
  const segment = decodeURIComponent(String(rawToken ?? '').trim());

  if (!segment) {
    redirect('/welcome/vip/');
  }

  if (/^\d+$/.test(segment)) {
    redirect(`/welcome/client/${segment}`);
  }

  redirect(`/welcome/vip/${encodeURIComponent(segment)}`);
}
