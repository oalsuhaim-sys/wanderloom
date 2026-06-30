/**
 * قائمة تعبئة ذكية من الوجهة والموسم + مطابقة اختيارية مع travel_wardrobe.
 */

import type { WardrobeMatchRow } from '@/lib/travel-wardrobe-trip';

export type PackingItemDef = {
  id: string;
  label: string;
  sub?: string;
  /** للبحث في اسم/وصف منتجات البوتيك */
  keywords: string[];
};

function normSimple(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

export function tripDestinationBlob(parts: string[]): string {
  return parts.filter(Boolean).join(' ');
}

export function buildSmartPackingList(tripBlob: string, seasons: string[]): PackingItemDef[] {
  const b = tripBlob.toLowerCase();
  const seasonStr = seasons.join(' ');
  const hasWinter =
    /شتاء|winter|ski|ثلج|بارد|تثليج/i.test(seasonStr) || /شتاء|winter|ski|ثلج|بارد/i.test(b);
  const hasSummer =
    /صيف|summer|شاطئ|بحر|حر/i.test(seasonStr) || /صيف|summer|شاطئ|بحر|حرار/i.test(b);
  const isKorea = /كوريا|korea|سيول|seoul|busan|부산|서울|incheon|인천/i.test(tripBlob);
  const isEU =
    /سويسرا|فرنسا|إيطاليا|ايطاليا|اسبانيا|إسبانيا|ألمانيا|النمسا|النرويج|المملكة|لندن|باريس|برلين|zurich|geneva|switzerland|france|italy|spain|germany|austria|norway|uk|london|paris|rome|madrid/i.test(
      tripBlob,
    );
  const isGulf = /الإمارات|الامارات|دبي|ابوظبي|قطر|الدوحة|السعودية|البحرين|الكويت|عمان|مسقط|uae|dubai|qatar|riyadh|bahrain|kuwait|oman|muscat/i.test(
    tripBlob,
  );
  const isTropical = /المالديف|مالديف|maldives|بالي|bali|فوكيت|phuket|سيشيل|seychelles|موريشيوس|mauritius/i.test(tripBlob);

  const items: PackingItemDef[] = [];

  items.push({
    id: 'docs',
    label: 'وثائق السفر',
    sub: 'جواز ساري، وتأشيرة إن لزم، وتأمين السفر',
    keywords: ['جواز', 'passport', 'وثائق', 'تأشيرة'],
  });

  if (isKorea && hasWinter) {
    items.push({
      id: 'kr_adapter',
      label: 'محول كهرباء مناسب (نوع C / F)',
      sub: 'مقابس كوريا 220 فولت — جرّب طبقة محول + شاحن USB',
      keywords: ['محول', 'adapter', 'شاحن', 'كهرب', 'usb'],
    });
    items.push({
      id: 'thermal',
      label: 'ملابس داخلية حرارية وطبقات خفيفة',
      sub: 'الشتاء في كوريا بارد وجاف — طبقات أفضل من معطف ثقيل واحد',
      keywords: ['حراري', 'thermal', 'بيس', 'طبقات', 'سويت', 'هودي'],
    });
    items.push({
      id: 'cream',
      label: 'كريم مرطب وواقي شمس',
      sub: 'الهواء البارد يجف البشرة — SPF مناسب حتى في الشتاء',
      keywords: ['مرطب', 'كريم', 'واقي', 'spf', 'عناية'],
    });
    items.push({
      id: 'kr_cashless',
      label: 'بطاقة دفع وبعض الكاش الاحتياطي',
      sub: 'كوريا تعتمد كثيراً على التطبيقات والبطاقات',
      keywords: ['محفظة', 'كاش', 'بطاقة'],
    });
  } else if (hasWinter && (isEU || isGulf)) {
    items.push({
      id: 'eu_adapter',
      label: 'محول كهرباء متعدد الأنواع (C / E / F)',
      keywords: ['محول', 'adapter', 'شاحن', 'كهرب'],
    });
    items.push({
      id: 'layers',
      label: 'ملابس بطبقات وقفازات ووشاح',
      keywords: ['طبقات', 'قفاز', 'وشاح', 'سويت', 'جاكيت'],
    });
    items.push({
      id: 'lip_balm',
      label: 'مرطب شفاه وحماية للبشرة من الجفاف',
      keywords: ['مرطب', 'شفاه', 'كريم', 'عناية'],
    });
  } else if (hasWinter) {
    items.push({
      id: 'w_adapter',
      label: 'محول كهرباء للوجهة',
      keywords: ['محول', 'adapter', 'شاحن'],
    });
    items.push({
      id: 'w_warm',
      label: 'ملابس دافئة وطبقات',
      keywords: ['ملابس', 'حراري', 'جاكيت', 'سويت'],
    });
    items.push({
      id: 'w_skin',
      label: 'كريم مرطب وواقي شمس',
      keywords: ['مرطب', 'كريم', 'spf', 'واقي'],
    });
  }

  if (hasSummer || isTropical) {
    items.push({
      id: 'sun',
      label: 'واقي شمس عالي + نظارة شمس وهات',
      keywords: ['واقي', 'spf', 'نظارة', 'شمس', 'hat'],
    });
    items.push({
      id: 'swim',
      label: 'ملابس سباحة وفوطة خفيفة',
      keywords: ['سباحة', 'swim', 'بيكيني', 'شورت', 'فوطة'],
    });
    items.push({
      id: 'hydration',
      label: 'زجاجة ماء قابلة لإعادة التعبئة',
      keywords: ['ماء', 'زجاجة', 'ترطيب'],
    });
  }

  if (isGulf && hasSummer) {
    items.push({
      id: 'gulf_light',
      label: 'ملابس قطنية فضفاضة وغطاء رأس',
      keywords: ['قطن', 'فضفاض', 'خفيف', 'قبعة'],
    });
  }

  items.push({
    id: 'shoes',
    label: 'حذاء مريح للمشي + شاحن متنقل',
    sub: 'مناسب لطبيعة برنامجك',
    keywords: ['حذاء', 'شاحن', 'باور', 'power bank'],
  });

  // إزالة التكرار حسب id
  const seen = new Set<string>();
  return items.filter((x) => {
    if (seen.has(x.id)) return false;
    seen.add(x.id);
    return true;
  });
}

export function findWardrobeForPackingItem(rows: WardrobeMatchRow[], keywords: string[]): WardrobeMatchRow | null {
  if (!rows.length || !keywords.length) return null;
  for (const row of rows) {
    const hay = normSimple(`${row.name} ${row.description || ''}`);
    for (const kw of keywords) {
      const k = normSimple(kw);
      if (k.length >= 2 && hay.includes(k)) return row;
    }
  }
  return null;
}
