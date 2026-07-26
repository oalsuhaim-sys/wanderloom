import { redirect } from 'next/navigation';

type Props = { params: Promise<{ id: string }> };

export default async function AdminExpertProfileRedirect({ params }: Props) {
  const { id } = await params;
  redirect(`/crm/partners-directory/expert/${encodeURIComponent(id)}`);
}
