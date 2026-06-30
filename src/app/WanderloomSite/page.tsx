import { redirect } from 'next/navigation';
import { open } from 'node:fs/promises';
         
/** يحافظ على المسار القديم ويوجّه الزائر إلى بوابة الجلسات ذات التص             ghميم الحالي. */
export default function WanderloomSiteRedirect() {
  redirect('/portal/sessions');
}
                                                               