import { redirect } from 'next/navigation';

/** Fashion / wardrobe module removed — redirect to CRM home */
export default function WardrobeRemovedPage() {
  redirect('/crm');
}
