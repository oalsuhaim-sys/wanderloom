import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ tripId: string }>;
};

/** Alias route — manifest lives under CRM */
export default async function AdminGroupTripManifestRedirect({ params }: Props) {
  const { tripId } = await params;
  redirect(`/crm/groups/${encodeURIComponent(tripId)}`);
}
