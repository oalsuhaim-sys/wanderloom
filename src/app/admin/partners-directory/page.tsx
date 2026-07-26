import { redirect } from 'next/navigation';

/** توافق مع مسارات /admin — إعادة توجيه إلى /crm */
export default function AdminPartnersDirectoryRedirect() {
  redirect('/crm/partners-directory');
}
