/**
 * Interest → day themes for DNA quotes. Each theme knows how to recognise matching places in the
 * bank and how to talk about the day in warm, marketing Arabic (used as-is, or as the base Claude
 * rewrites). Keys are the raw values saved by «سجّل رحلتك» / DNA (anime, kpop, nature …).
 */

export type DayTheme = {
  key: string;
  /** Arabic label shown to the client. */
  label: string;
  /** Match words for places (name / name_en / sub_tag / tip / category). */
  keywords: string[];
  /** Preferred place categories (places.category codes). */
  categories: string[];
  title: (city: string) => string;
  pitch: (city: string) => string;
};

const T = (t: DayTheme) => t;

export const DAY_THEMES: Record<string, DayTheme> = {
  anime: T({
    key: 'anime',
    label: 'الأنمي وثقافة البوب',
    keywords: ['anime', 'manga', 'ghibli', 'pokemon', 'character', 'figure', 'arcade', 'akihabara', 'nakano', 'webtoon', 'kakao', 'line friends', 'game', 'cartoon', 'أنمي', 'مانغا'],
    categories: ['s', 'o', 'd'],
    title: (c) => `${c} بعين عاشق الأنمي`,
    pitch: (c) => `يوم يعيدك لشخصياتك المفضلة: متاجر وزوايا مخفية في ${c} يعرفها عشّاق الأنمي فقط، بإيقاع مريح بين محطة وأخرى.`,
  }),
  kpop: T({
    key: 'kpop',
    label: 'الكيبوب والكدراما',
    keywords: ['bts', 'k-pop', 'kpop', 'hybe', 'sm town', 'smtown', 'jyp', 'yg ', 'idol', 'drama', 'k-drama', 'hallyu', 'hongdae', 'coex', 'starfield', 'gangnam', 'filming', 'كيبوب', 'دراما'],
    categories: ['o', 's', 'l', 'c'],
    title: (c) => `${c} على إيقاع الكيبوب`,
    pitch: (c) => `تمشي في الأماكن التي شاهدتها في المسلسلات والكليبات، وتعيش أجواء الهاليو في ${c} كما يعيشها أهلها.`,
  }),
  nature: T({
    key: 'nature',
    label: 'الطبيعة والمناظر',
    keywords: ['park', 'mountain', 'beach', 'forest', 'garden', 'lake', 'island', 'valley', 'trail', 'falls', 'waterfall', 'river', 'nature', 'maple', 'arboretum', 'cliff', 'coast', 'حديقة', 'جبل', 'شاطئ', 'غابة', 'بحيرة'],
    categories: ['l', 'o'],
    title: (c) => `${c} بين الطبيعة والهدوء`,
    pitch: (c) => `يوم تتنفّس فيه: مشاهد طبيعية وإطلالات مفتوحة حول ${c}، بلا ازدحام ولا استعجال.`,
  }),
  shopping: T({
    key: 'shopping',
    label: 'التسوق والموضة',
    keywords: ['mall', 'market', 'shop', 'store', 'outlet', 'boutique', 'department', 'myeongdong', 'garosu', 'sinsa', 'hyundai', 'lotte', 'shinsegae', 'dongdaemun', 'ginza', 'omotesando', 'تسوق', 'سوق', 'مول'],
    categories: ['s'],
    title: (c) => `${c} للتسوق بذوق`,
    pitch: (c) => `اخترنا لك شوارع وبوتيكات ${c} التي تستحق وقتك، من العلامات الكبيرة إلى المتاجر المستقلة التي لا يعرفها السيّاح.`,
  }),
  seasonal_festivals: T({
    key: 'seasonal_festivals',
    label: 'الفعاليات الموسمية',
    keywords: ['festival', 'light', 'lantern', 'autumn', 'maple', 'christmas', 'illumination', 'season', 'event', 'مهرجان', 'موسم'],
    categories: ['o', 'l'],
    title: (c) => `${c} في موسمها`,
    pitch: (c) => `يوم مصمّم حول ما يحدث في ${c} وقت زيارتك تحديداً: أجواء الموسم وفعالياته التي لا تتكرر.`,
  }),
  adventure_local: T({
    key: 'adventure_local',
    label: 'التجارب المحلية',
    keywords: ['tour', 'experience', 'cruise', 'cable', 'zip', 'ski', 'surf', 'hike', 'local', 'village', 'street food', 'market', 'rail bike', 'sky', 'تجربة', 'جولة'],
    categories: ['d', 'o', 'l'],
    title: (c) => `${c} كما يعيشها أهلها`,
    pitch: (c) => `تجارب حقيقية بعيدة عن البرامج المكررة: أنشطة محلية في ${c} تخرج منها بقصة تحكيها.`,
  }),
  workshops_crafts: T({
    key: 'workshops_crafts',
    label: 'الورش والحرف',
    keywords: ['workshop', 'class', 'craft', 'pottery', 'hanbok', 'cooking', 'kimchi', 'ceramic', 'calligraphy', 'perfume', 'diy', 'making', 'ورشة', 'حرف'],
    categories: ['d', 'o'],
    title: (c) => `${c} بيديك`,
    pitch: (c) => `يوم تصنع فيه ذكرى بيدك: ورشة خاصة في ${c} مع حِرفي محلي، وتأخذ ما صنعته معك.`,
  }),
  history: T({
    key: 'history',
    label: 'التاريخ والحضارة',
    keywords: ['palace', 'temple', 'museum', 'hanok', 'fortress', 'shrine', 'heritage', 'castle', 'gate', 'old town', 'قصر', 'معبد', 'متحف'],
    categories: ['l'],
    title: (c) => `حكايات ${c} القديمة`,
    pitch: (c) => `تمشي بين قصور ${c} وأزقتها التاريخية في أهدأ أوقاتها، مع تفاصيل تجعل المكان يحكي لك قصته.`,
  }),
  spa_wellness: T({
    key: 'spa_wellness',
    label: 'الاستجمام',
    keywords: ['spa', 'sauna', 'jjimjilbang', 'onsen', 'wellness', 'massage', 'bath', 'سبا'],
    categories: ['d'],
    title: (c) => `${c} على مهل`,
    pitch: (c) => `يوم للراحة: سبا وطقوس استرخاء في ${c} تعيد لك طاقتك قبل المرحلة القادمة.`,
  }),
  photo_tours: T({
    key: 'photo_tours',
    label: 'التصوير والإطلالات',
    keywords: ['view', 'tower', 'observatory', 'sunset', 'skyline', 'rooftop', 'photo', 'sky', 'lookout', 'إطلالة', 'برج'],
    categories: ['l', 'o'],
    title: (c) => `${c} من أجمل زواياها`,
    pitch: (c) => `جولة بأفضل إطلالات ${c} في أجمل ساعات الضوء، لصور تبقى معك بعد الرحلة.`,
  }),
  food: T({
    key: 'food',
    label: 'تجارب الأكل',
    keywords: ['restaurant', 'food', 'market', 'bbq', 'street food', 'dining', 'bakery', 'مطعم', 'أكل'],
    categories: ['r', 'c'],
    title: (c) => `${c} بنكهتها`,
    pitch: (c) => `يوم يُقاس بالنكهات: أطباق ${c} الأصيلة في أماكن مختارة بعناية تناسب ذوقك.`,
  }),
};

/** Free-text / Arabic interest → theme key. */
const INTEREST_ALIASES: Array<[RegExp, string]> = [
  [/anime|أنمي|انمي|مانغا/i, 'anime'],
  [/kpop|k-pop|كيبوب|دراما|drama/i, 'kpop'],
  [/nature|طبيع|مناظر/i, 'nature'],
  [/shop|تسوق|موضة/i, 'shopping'],
  [/festival|مهرجان|فعاليات|موسم/i, 'seasonal_festivals'],
  [/adventure|مغامر|تجارب محلية|local/i, 'adventure_local'],
  [/workshop|craft|ورش|حرف/i, 'workshops_crafts'],
  [/history|تاريخ|حضار|ثقاف|cultur/i, 'history'],
  [/spa|wellness|سبا|استجمام|استرخاء/i, 'spa_wellness'],
  [/photo|تصوير/i, 'photo_tours'],
  [/food|مطاعم|طعام|أكل|مأكول/i, 'food'],
];

export function themesForInterests(interests: string[]): DayTheme[] {
  const keys: string[] = [];
  for (const raw of interests) {
    const k = String(raw ?? '').trim();
    if (!k) continue;
    const key = DAY_THEMES[k] ? k : INTEREST_ALIASES.find(([re]) => re.test(k))?.[1];
    if (key && !keys.includes(key)) keys.push(key);
  }
  if (!keys.length) keys.push('history', 'nature', 'food');
  return keys.map((k) => DAY_THEMES[k]!);
}

/** Arabic label for any interest value (for the client page and the CRM). */
export function interestLabelAr(raw: string): string {
  const k = String(raw ?? '').trim();
  const key = DAY_THEMES[k] ? k : INTEREST_ALIASES.find(([re]) => re.test(k))?.[1];
  return key ? DAY_THEMES[key]!.label : k;
}

/** Sensory stop title by place category — the real place name stays hidden from the client. */
export function sensoryStopTitle(category: string, theme: DayTheme, slot: number): string {
  switch (category) {
    case 'c':
      return slot === 0 ? 'قهوة الصباح في زاوية هادئة' : 'استراحة قهوة مختصة';
    case 'r':
      return slot >= 3 ? 'عشاء مختار بعناية' : 'غداء بنكهة محلية';
    case 's':
      return theme.key === 'shopping' ? 'شارع البوتيكات المختار' : 'جولة تسوق خفيفة';
    case 'l':
      return theme.key === 'nature' ? 'إطلالة طبيعية مفتوحة' : theme.key === 'history' ? 'معلم يحكي تاريخ المدينة' : 'معلم المدينة الأبرز';
    case 'd':
      return theme.key === 'workshops_crafts' ? 'ورشة خاصة مع حِرفي محلي' : theme.key === 'spa_wellness' ? 'جلسة استرخاء' : 'تجربة خاصة';
    case 'f':
      return 'نشاط ممتع للعائلة';
    case 'h':
      return 'وصول وراحة في الفندق';
    default:
      return theme.key === 'kpop' ? 'محطة لعشّاق الكيبوب' : theme.key === 'anime' ? 'محطة لعشّاق الأنمي' : 'محطة مختارة لك';
  }
}
