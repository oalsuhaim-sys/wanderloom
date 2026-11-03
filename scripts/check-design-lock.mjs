#!/usr/bin/env node
/**
 * Design lock guard — runs before every build (local, Vercel, CI).
 * Fails the build if the approved «loom» design was removed or overwritten,
 * e.g. by an AI edit or a deploy from an outdated copy of the repo.
 * To change the design on purpose: update the markers below in the same PR, with owner approval.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(resolve(root, p)) ? readFileSync(resolve(root, p), 'utf8') : null);

const SLOGAN = 'واندرلوم: تفصيل لا تنظيم';
const checks = [
  ['.cursor/rules/design-lock.mdc', null, 'ملف قواعد قفل التصميم لـ Cursor'],
  ['src/app/_components/home/PublicHomeHero.tsx', 'data-wl-hero="loom"', 'واجهة الهيرو (الخط الذهبي بين المعالم)'],
  ['src/app/_components/home/PublicHomePage.tsx', 'LoomDestinations', 'ترتيب أقسام الصفحة الرئيسية'],
  ['src/app/_components/home/PublicHomePage.tsx', 'LoomProcess', 'قسم «كيف نعمل»'],
  ['src/app/_components/home/PublicHomePage.tsx', 'LoomFooter', 'الفوتر الكحلي'],
  ['src/app/_components/home/PublicAboutSection.tsx', 'data-wl-about="loom"', 'قسم «من نحن» الكحلي'],
  ['src/app/_components/home/loom/LoomDestinations.tsx', 'LandmarkIcon', 'أيقونات المعالم'],
  ['src/app/_components/home/loom/BrandMark.tsx', 'wanderloom-mark.png', 'شعار العلامة'],
  ['src/app/_components/home/loom/Wordmark.tsx', 'WANDERLOOM', 'كلمة WANDERLOOM للإنجليزي'],
  ['src/app/_components/home/loom/Wordmark.tsx', 'واندرلوم', 'كلمة واندرلوم للعربي'],
  ['src/components/DestinationAdvisor.tsx', 'AdvisorStepper', 'مستشار الوجهة بالتصميم الجديد'],
  ['src/app/_components/home/InstantDnaSuccess.tsx', 'wl-weave-dark', 'تذكرة النجاح'],
  ['src/app/globals.css', '.wl-weave {', 'خلفية النسيج'],
  ['src/app/globals.css', '.wl-weave-dark {', 'الخلفية الكحلية'],
  ['src/app/globals.css', '.wl-gold-cta {', 'الزر الذهبي'],
  ['src/app/globals.css', '.wl-wordmark {', 'كلمة WANDERLOOM'],
  ['src/app/layout.tsx', 'Tajawal', 'خط Tajawal'],
  ['src/app/layout.tsx', 'Cormorant_Garamond', 'خط Cormorant Garamond'],
  ['src/locales/ar.json', `"heroTitle2": "تفصيل لا تنظيم"`, 'الشعار في عنوان الواجهة'],
  ['src/locales/ar.json', `"footerSlogan": "${SLOGAN}"`, 'الشعار المعتمد في الفوتر'],
  ['public/brand/wanderloom-mark.png', null, 'صورة الشعار'],
];

const failures = [];
for (const [file, marker, label] of checks) {
  const text = read(file);
  if (text === null) failures.push(`✗ ${label} — الملف مفقود: ${file}`);
  else if (marker && !text.includes(marker)) failures.push(`✗ ${label} — تغيّر في: ${file}`);
}

if (failures.length) {
  console.error('\n⛔ قفل التصميم: تم إيقاف البناء لأن التصميم المعتمد تغيّر أو حُذف.');
  console.error('⛔ Design lock: build stopped — the approved Wanderloom design was changed or removed.\n');
  for (const f of failures) console.error('  ' + f);
  console.error('\nالحل: حدّث نسختك من GitHub (git pull origin main) ثم أعد تطبيق تعديلك فوقها.');
  console.error('راجع .cursor/rules/design-lock.mdc — أي تغيير مقصود للتصميم يحتاج موافقة المالك.\n');
  process.exit(1);
}
console.log('✓ Design lock: approved Wanderloom design is intact.');
