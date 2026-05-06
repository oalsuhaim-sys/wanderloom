import { redirect } from 'next/navigation';

/** يحافظ على المسار القديم ويوجّه الزائر إلى بوابة الجلسات ذات التصميم الحالي. */
export default function WanderloomSiteRedirect() {
  redirect('/portal/sessions');
}
