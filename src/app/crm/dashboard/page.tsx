import { redirect } from 'next/navigation';

/** عنوان لوحة القيادة الموحّدة أصبح /crm — إبقاء المسار للتوافق مع الروابط القديمة والشريط الجانبي. */
export default function DashboardLegacyRedirectPage() {
  redirect('/crm');
}
