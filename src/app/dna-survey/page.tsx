import { redirect } from 'next/navigation';

type DnaSurveyPageProps = {
  searchParams: Promise<{ client_id?: string | string[] }>;
};

/**
 * Public DNA survey entry — redirects to the SSOT welcome DNA form.
 * Supports: /dna-survey?client_id={clients.id}
 */
export default async function DnaSurveyPage({ searchParams }: DnaSurveyPageProps) {
  const params = await searchParams;
  const raw = params.client_id;
  const clientId = String(Array.isArray(raw) ? raw[0] : raw ?? '').trim();

  if (!clientId || (!/^\d+$/.test(clientId) && !/^[0-9a-f-]{36}$/i.test(clientId))) {
    redirect('/');
  }

  redirect(`/welcome/${encodeURIComponent(clientId)}`);
}
