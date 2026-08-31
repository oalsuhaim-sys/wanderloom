import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ id: string }> | { id: string };
};

/** Legacy /quote/:id → canonical public client brochure */
export default async function QuoteAliasRedirect({ params }: Props) {
  const resolved = await Promise.resolve(params);
  const id = String(resolved?.id ?? '').trim();
  if (!id) redirect('/');
  redirect(`/proposal/${encodeURIComponent(id)}`);
}
