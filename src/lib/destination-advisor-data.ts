import { TRIP_DESTINATIONS, type TripCountryId } from '@/lib/trip-destination-data';

export type SeasonKey = 'winter' | 'spring' | 'summer' | 'autumn';

export type SeasonStatus = 'recommended' | 'not_recommended';

export type SeasonAdvisorData = {
  name: string;
  months: string[];
  avgTemp: string;
  status: SeasonStatus;
  advice: string;
  hiddenEvents: string;
  activities: string[];
  images: string[];
};

export type CountryAdvisorData = {
  name: string;
  seasons: Record<SeasonKey, SeasonAdvisorData>;
};

export const SEASON_KEYS: SeasonKey[] = ['winter', 'spring', 'summer', 'autumn'];

const unsplash = (photoId: string, w = 800) =>
  `https://images.unsplash.com/${photoId}?q=80&w=${w}&auto=format&fit=crop`;

function season(
  name: string,
  months: string[],
  avgTemp: string,
  status: SeasonStatus,
  advice: string,
  hiddenEvents: string,
  activities: string[],
  images: string[],
): SeasonAdvisorData {
  return { name, months, avgTemp, status, advice, hiddenEvents, activities, images };
}

const JAPAN: CountryAdvisorData = {
  name: 'اليابان',
  seasons: {
    autumn: season(
      'الخريف',
      ['أكتوبر', 'نوفمبر', 'ديسمبر'],
      '15°C - 20°C',
      'recommended',
      "الوقت مثالي جداً! ستشهد ظاهرة 'الموميجي' حيث تشتعل أوراق الأشجار باللون الأحمر القرمزي. ننصح بزيارة حدائق كيوتو في المساء حيث الإضاءة المخملية الخاصة.",
      "مهرجان 'Jidai Matsuri' (مهرجان العصور) في كيوتو — استعراض تاريخي مهيب ونادر لا يعرفه أغلب السياح.",
      [
        'التأمل في حدائق السن والتمتع بالكايسيكي الخريفي',
        'زيارة الينابيع الحارة (Onsen) وسط الطبيعة الملونة',
      ],
      [unsplash('photo-1493976040374-85c8e12f0c0e'), unsplash('photo-1545569341-9eb8b30979d9')],
    ),
    winter: season(
      'الشتاء',
      ['ديسمبر', 'يناير', 'فبراير'],
      '2°C - 10°C',
      'recommended',
      'شتاء اليابان هادئ وفاخر: ثلوج هوكايدو، أونسن تحت الثلج، ومأكولات شتوية نادرة في ريokan تقليدية.',
      'مهرجان سابورو للثلج — منحوتات ضخمة وحفلات ضوئية لا تُروَّج للسياح العرب بشكل كافٍ.',
      ['تزلج في نيسيكو', 'حمامات أونسن خارجية في غونا'],
      [unsplash('photo-1540959733332-eab4deabeeaf'), unsplash('photo-1518548419970-58e990b0ffb6')],
    ),
    spring: season(
      'الربيع',
      ['مارس', 'أبريل', 'مايو'],
      '10°C - 18°C',
      'recommended',
      'موسم الساكورا — أيقونة اليابان. ننصح بحجز مبكر لطوكيو وكيوتو؛ الإقامة في ريokan قرب معابد قديمة تمنحك هدوءاً بعيداً عن الحشود.',
      'Hanami ليلي في حديقة أوتشا — تجمعات محلية أكثر من فعاليات السياح.',
      ['نزهات الساكورا عند قلعة أوساكا', 'شاي مايتشا في بيوت تقليدية'],
      [unsplash('photo-1524413300801-aa3dff16511f'), unsplash('photo-1490806843957-31f4d4cdc6b2')],
    ),
    summer: season(
      'الصيف',
      ['يونيو', 'يوليو', 'أغسطس'],
      '30°C - 35°C',
      'not_recommended',
      'لا ننصح كثيراً بهذا الوقت بسبب ارتفاع الرطوبة الشديد وموسم الأمطار (Tsuyu) في بداية الصيف، مما قد يعيق انسيابية الجولات المفتوحة.',
      'استعراضات الألعاب النارية السرية على ضفاف نهر سوميدا (Sumidagawa Fireworks).',
      ['الهروب إلى جبال هوكايدو الباردة', 'حضور مهرجانات الصيف التقليدية (Matsuri) ليلاً'],
      [unsplash('photo-1503894381297-713081b95f65'), unsplash('photo-1478436129477-95df37f7ca0d')],
    ),
  },
};

const KOREA: CountryAdvisorData = {
  name: 'كوريا الجنوبية',
  seasons: {
    spring: season(
      'الربيع',
      ['مارس', 'أبريل', 'مايو'],
      '12°C - 20°C',
      'recommended',
      'أفضل وقت لاستكشاف سيول وبوسان: أزهار الكرز، مقاهي حي هونغداي، وطقس معتدل مثالي للتجول.',
      'مهرجان Jinhae Gunhangje — أكبر احتفال بالكرز في كوريا، أقل ازدحاماً إذا زرته في الصباح الباكر.',
      ['جولة تصوير في Bukchon Hanok', 'تذوق باربكيو كوري في أسواق ليلية'],
      [unsplash('photo-1534274988756-4c6bd1eeec4f'), unsplash('photo-1517154429939-022a2f2b3b0e')],
    ),
    autumn: season(
      'الخريف',
      ['سبتمبر', 'أكتوبر', 'نوفمبر'],
      '10°C - 18°C',
      'recommended',
      'خريف كوريا ساحر: ألوان الخريف في جبال سوراك، وهدوء نسبي في المعابد بعد موسم الصيف.',
      'مهرجان الأضواء في جزيرة نامي — تجربة فنية موسمية بعيدة عن دليل السياح التقليدي.',
      ['تلفريك سوراكسان', 'استكشاف قرية Bukchon التاريخية'],
      [unsplash('photo-1534274988756-4c6bd1eeec4f'), unsplash('photo-1559827260-dc66d52bef19')],
    ),
    winter: season(
      'الشتاء',
      ['ديسمبر', 'يناير', 'فبراير'],
      '-5°C - 5°C',
      'recommended',
      'شتاء ثلجي في Pyeongchang ومنتجعات التزلج؛ سيول دافئة بالمقاهي والأسواق الشتوية.',
      'مهرجان هوانغشي للثلج — منحوتات جليدية ليلية في مقاطعة غير شائعة للسياح الخليجيين.',
      ['تزلج في Alpensia', 'حمامات jjimjilbang فاخرة'],
      [unsplash('photo-1517154421773-0529f29ea451'), unsplash('photo-1578662996442-48f60103fc96')],
    ),
    summer: season(
      'الصيف',
      ['يونيو', 'يوليو', 'أغسطس'],
      '25°C - 32°C',
      'not_recommended',
      'رطوبة عالية وموسم الأمطار؛ الجولات الخارجية الطويلة قد تكون مرهقة. ننصح بالداخل أو الجزر إن اضطررت للسفر.',
      'مهرجان Boryeong Mud — تجربة طينية فريدة على الساحل الغربي.',
      ['الهروب إلى جزيرة جيجو', 'مقاهي مكيّفة في Gangnam'],
      [unsplash('photo-1534274988756-4c6bd1eeec4f'), unsplash('photo-1517154429939-022a2f2b3b0e', 700)],
    ),
  },
};

const CHINA: CountryAdvisorData = {
  name: 'الصين',
  seasons: {
    spring: season(
      'الربيع',
      ['مارس', 'أبريل', 'مايو'],
      '15°C - 22°C',
      'recommended',
      'ربيع معتدل في بكين وشانغهاي — مثالي للسور الصيني والأحياء التاريخية قبل حر الصيف.',
      'مهرجان مياه الخوخ في بكين — احتفال محلي نادر خارج أدلة السفر السريعة.',
      ['المشي على السور في Mutianyu', 'جولة Bund ليلاً في شانغهاي'],
      [unsplash('photo-1508804185872-d7badad00f7d'), unsplash('photo-1547981609-4a802e047f66')],
    ),
    autumn: season(
      'الخريف',
      ['سبتمبر', 'أكتوبر', 'نوفمبر'],
      '12°C - 20°C',
      'recommended',
      '«الذهبي الأسبوع» قد يزدحم داخلياً، لكن سبتمبر–أكتوبر ما زالا مثاليين للصين مع طقس صافٍ وسماء زرقاء.',
      'مهرجان منتصف الخريف في سوزو — فوانيس تقليدية على قنوات قديمة.',
      ['تصوير في Zhangjiajie', 'شاي في حدائق هانغتشو'],
      [unsplash('photo-1508804185872-d7badad00f7d', 800), unsplash('photo-1599571234901-858081934b90')],
    ),
    winter: season(
      'الشتاء',
      ['ديسمبر', 'يناير', 'فبراير'],
      '0°C - 8°C',
      'not_recommended',
      'بكين باردة وجافة؛ التلوث قد يؤثر على الرؤية. ننصح بالجنوب (غوانزو) أو التأجيل للربيع.',
      'مهرجان الجليد في هاربين — منحوتات ضخمة إن قررت الشتاء.',
      ['Harbin Ice Festival', 'أسواق شتوية في شنغهاي'],
      [unsplash('photo-1547981609-4a802e047f66'), unsplash('photo-1529928521614-6f02c1fd9848')],
    ),
    summer: season(
      'الصيف',
      ['يونيو', 'يوليو', 'أغسطس'],
      '28°C - 35°C',
      'not_recommended',
      'حرارة ورطوبة شديدة مع أمطار موسمية في الجنوب — قد تعيق الرحلات الطويلة في الهواء الطلق.',
      'مهرجان Qixi في قرى مائية نائية — طقوس محلية نادرة.',
      ['جزر هاينان كملاذ', 'متاحف مكيّفة في بكين'],
      [unsplash('photo-1529928521614-6f02c1fd9848'), unsplash('photo-1508804185872-d7badad00f7d', 700)],
    ),
  },
};

const FRANCE_EUROPE: CountryAdvisorData = {
  name: 'فرنسا · أوروبا',
  seasons: {
    spring: season(
      'الربيع',
      ['مارس', 'أبريل', 'مايو'],
      '12°C - 20°C',
      'recommended',
      'باريس في الربيع أسطورية: حدائق Luxembourg، مقاهي التراس، وإقليم بروفانس قبل حر الصيف.',
      'Foire du Trône — أقدم مهرجان في باريس، بعيد عن مسارات Eiffel السياحية.',
      ['نزهة Seine', 'تذوق جبن في قرى نورماندي'],
      [unsplash('photo-1502602898657-3e91760cbb34'), unsplash('photo-1499856877139-5e3620c0a0e0')],
    ),
    summer: season(
      'الصيف',
      ['يونيو', 'يوليو', 'أغسطس'],
      '20°C - 28°C',
      'recommended',
      'الريفيرا الفرنسية وباريس الصيفية — مع حجز مبكر للفنادق البوتيكية. أغسطس قد يكون مزدحماً في المدن الساحلية.',
      'Fête de la Musique — حفلات مجانية في أحياء باريسية لا تظهر في الخرائط السياحية.',
      ['Nice وMonaco يومياً', 'متحف Orsay في الصباح الباكر'],
      [unsplash('photo-1506187330437-2aa3a3a8b572'), unsplash('photo-1431274666673-af4c0e35ea75')],
    ),
    autumn: season(
      'الخريف',
      ['سبتمبر', 'أكتوبر', 'نوفمبر'],
      '10°C - 18°C',
      'recommended',
      'خريف أوروبا الذهبي: بورdeaux للنبيذ، Loire للقلاع، وباريس بألوان هادئة.',
      'Nuit Blanche في باريس — فن معاصر ليلي في أحياء مغلقة عادةً.',
      ['عناقيد العنب في بورdeaux', 'جولة Loire Valley'],
      [unsplash('photo-1499856877139-5e3620c0a0e0'), unsplash('photo-1524396309943-e03f5249f802')],
    ),
    winter: season(
      'الشتاء',
      ['ديسمبر', 'يناير', 'فبراير'],
      '3°C - 10°C',
      'recommended',
      'شتاء ألبي في Chamonix، وباريس الرومانسية مع أسواق عيد الميلاد — تجربة فاخرة هادئة.',
      'Marché de Noël في Strasbourg — أقدم سوق عيد ميلاد في أوروبا.',
      ['تزلج في Alpes', 'شوكولاتة ساخنة في Saint-Germain'],
      [unsplash('photo-1511739001486-6b10f789a963'), unsplash('photo-1483728642387-6bc3bb38baf6')],
    ),
  },
};

function buildStandardCountry(name: string, profile: 'temperate' | 'mediterranean' | 'tropical' | 'cold'): CountryAdvisorData {
  const rec = (s: string) => s;
  const profiles = {
    temperate: {
      spring: ['مارس', 'أبريل', 'مايو'] as string[],
      summer: ['يونيو', 'يوليو', 'أغسطس'] as string[],
      autumn: ['سبتمبر', 'أكتوبر', 'نوفمبر'] as string[],
      winter: ['ديسمبر', 'يناير', 'فبراير'] as string[],
      temps: { spring: '12°C - 20°C', summer: '22°C - 30°C', autumn: '10°C - 18°C', winter: '0°C - 8°C' },
      rec: { spring: 'recommended' as const, summer: 'recommended' as const, autumn: 'recommended' as const, winter: 'not_recommended' as const },
    },
    mediterranean: {
      spring: ['مارس', 'أبريل', 'مايو'],
      summer: ['يونيو', 'يوليو', 'أغسطس'],
      autumn: ['سبتمبر', 'أكتوبر', 'نوفمبر'],
      winter: ['ديسمبر', 'يناير', 'فبراير'],
      temps: { spring: '15°C - 22°C', summer: '28°C - 35°C', autumn: '18°C - 25°C', winter: '8°C - 15°C' },
      rec: { spring: 'recommended', summer: 'not_recommended', autumn: 'recommended', winter: 'recommended' },
    },
    tropical: {
      spring: ['مارس', 'أبريل', 'مايو'],
      summer: ['يونيو', 'يوليو', 'أغسطس'],
      autumn: ['سبتمبر', 'أكتوبر', 'نوفمبر'],
      winter: ['ديسمبر', 'يناير', 'فبراير'],
      temps: { spring: '22°C - 28°C', summer: '26°C - 32°C', autumn: '24°C - 30°C', winter: '20°C - 26°C' },
      rec: { spring: 'recommended', summer: 'recommended', autumn: 'recommended', winter: 'recommended' },
    },
    cold: {
      spring: ['مارس', 'أبريل', 'مايو'],
      summer: ['يونيو', 'يوليو', 'أغسطس'],
      autumn: ['سبتمبر', 'أكتوبر', 'نوفمبر'],
      winter: ['ديسمبر', 'يناير', 'فبراير'],
      temps: { spring: '5°C - 12°C', summer: '15°C - 22°C', autumn: '5°C - 12°C', winter: '-5°C - 2°C' },
      rec: { spring: 'recommended', summer: 'recommended', autumn: 'recommended', winter: 'recommended' },
    },
  }[profile];

  const img = 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800&auto=format&fit=crop';
  const imgAlt = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=800&auto=format&fit=crop';
  return {
    name,
    seasons: {
      spring: season(
        'الربيع',
        profiles.spring,
        profiles.temps.spring,
        profiles.rec.spring,
        rec(`ربيع ${name} مناسب للتجول والثقافة — طقس معتدل وإقامات بوتيكية متاحة مع حجز مبكر.`),
        `فعاليات محلية موسمية في ${name} — نكشف لك التفاصيل عند بناء مسارك الخاص.`,
        [`استكشاف المدن الرئيسية في ${name}`, 'تجارب طهو محلية موسمية'],
        [img, imgAlt],
      ),
      summer: season(
        'الصيف',
        profiles.summer,
        profiles.temps.summer,
        profiles.rec.summer,
        profiles.rec.summer === 'not_recommended'
          ? `صيف ${name} قد يكون حاراً أو مزدحماً — ننصح بجدولة أنشطة الصباح الباكر أو التأجيل للربيع/الخريف.`
          : `صيف ${name} مثالي للساحل والتجارب الخارجية مع تنسيق VIP من فريقنا.`,
        `أسرار صيفية في ${name} لا تظهر في نتائج البحث السريعة.`,
        [`جولات خاصة في ${name}`, 'إقامات منتجعات منتقاة'],
        [img, 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=700&auto=format&fit=crop'],
      ),
      autumn: season(
        'الخريف',
        profiles.autumn,
        profiles.temps.autumn,
        profiles.rec.autumn,
        rec(`خريف ${name} — ألوان طبيعية هادئة وتجربة فاخرة بعيداً عن ذروة الصيف.`),
        `مهرجانات خريفية محلية في ${name}.`,
        ['تصوير طبيعي', 'تذوق موسمي'],
        [img, imgAlt],
      ),
      winter: season(
        'الشتاء',
        profiles.winter,
        profiles.temps.winter,
        profiles.rec.winter,
        profiles.rec.winter === 'not_recommended'
          ? `شتاء ${name} قد يكون بارداً أو رطباً — ننسّق لك بدائل داخلية فاخرة أو مواسم بديلة.`
          : `شتاء ${name} — فرصة للتزلج، الأسواق، والإقامات الدافئة.`,
        `فعاليات شتوية حصرية في ${name}.`,
        ['تزلج أو أسواق', 'مطاعم حائزة على نجوم'],
        [
          'https://images.unsplash.com/photo-1511739001486-6b10f789a963?q=80&w=800&auto=format&fit=crop',
          'https://images.unsplash.com/photo-1483728642387-6bc3bb38baf6?q=80&w=800&auto=format&fit=crop',
        ],
      ),
    },
  };
}

const DEEP_OVERRIDES: Partial<Record<TripCountryId, CountryAdvisorData>> = {
  japan: JAPAN,
  korea: KOREA,
  china: CHINA,
  france: FRANCE_EUROPE,
};

const PROFILE_BY_COUNTRY: Record<TripCountryId, 'temperate' | 'mediterranean' | 'tropical' | 'cold'> = {
  japan: 'temperate',
  korea: 'temperate',
  china: 'temperate',
  canada: 'cold',
  south_africa: 'temperate',
  germany: 'temperate',
  spain: 'mediterranean',
  italy: 'mediterranean',
  france: 'temperate',
  uk: 'temperate',
  usa: 'temperate',
  portugal: 'mediterranean',
  belgium: 'temperate',
  netherlands: 'temperate',
  czech: 'temperate',
  poland: 'temperate',
  austria: 'temperate',
  sweden: 'cold',
  russia: 'cold',
  hungary: 'temperate',
  switzerland: 'cold',
};

export function getCountryAdvisorData(countryId: TripCountryId): CountryAdvisorData {
  const deep = DEEP_OVERRIDES[countryId];
  if (deep) return deep;
  const meta = TRIP_DESTINATIONS.find((c) => c.id === countryId);
  const name = meta?.labelAr ?? countryId;
  return buildStandardCountry(name, PROFILE_BY_COUNTRY[countryId] ?? 'temperate');
}

export const ADVISOR_COUNTRY_IDS = TRIP_DESTINATIONS.map((c) => c.id) as TripCountryId[];

export const SEASON_LABELS: Record<SeasonKey, string> = {
  winter: 'شتاء',
  spring: 'ربيع',
  summer: 'صيف',
  autumn: 'خريف',
};
