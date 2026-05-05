import type { Session, SessionRegistration } from '@/types/session-tables';

/** بيانات ثابتة للوحة CRM عند غياب Supabase أو فشل الطلبات. */
export const DEMO_STATS = {
  clientsTotal: 12,
  clientsNew: 4,
  tripsCount: 28,
  revenue: 42_500,
} as const;

export const DEMO_CLIENTS = [
  {
    id: 'demo-1',
    name: 'سارة العتيبي',
    phone_wa: '0501234567',
    status: 'new',
    created_at: new Date().toISOString(),
    ref_code: 'WL-DEMO-01',
    travel_type: 'فردي',
    job_type: null,
  },
  {
    id: 'demo-2',
    name: 'عبدالله القحطاني',
    phone_wa: '0555987654',
    status: 'qualified',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    ref_code: 'WL-DEMO-02',
    travel_type: 'مجموعة',
    job_type: null,
  },
  {
    id: 'demo-3',
    name: 'نورة المطيري',
    phone_wa: '0544112233',
    status: 'contacted',
    created_at: new Date(Date.now() - 172800000).toISOString(),
    ref_code: null,
    travel_type: 'فردي',
    job_type: null,
  },
];

export const DEMO_EVENTS = [
  {
    id: 'demo-e1',
    name: 'موسم الرياض',
    country: 'السعودية',
    city: 'الرياض',
    start_date: new Date(Date.now() + 86400000 * 14).toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 86400000 * 21).toISOString().slice(0, 10),
    impact: 'feature',
    category: 'festival',
    season: 'شتاء',
  },
  {
    id: 'demo-e2',
    name: 'ذروة السفر — اليابان',
    country: 'اليابان',
    city: 'طوكيو',
    start_date: new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 86400000 * 37).toISOString().slice(0, 10),
    impact: 'obstacle',
    category: 'peak',
    season: 'ربيع',
  },
];

const DEMO_SESSION_A = '11111111-1111-4111-8111-111111111101';
const DEMO_SESSION_B = '22222222-2222-4222-8222-222222222202';

export function getDemoSessions(): Session[] {
  const d3 = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);
  const d10 = new Date(Date.now() + 86400000 * 10).toISOString().slice(0, 10);
  return [
    {
      id: DEMO_SESSION_A,
      title: 'جلسة تجريبية — تخطيط رحلة اليابان',
      date: d3,
      session_type: 'online',
      price: 0,
      spots: 30,
      description: 'جلسة أونلاين تعريفية بالمسار اليومي في طوكيو وكيوتو.',
      created_at: new Date().toISOString(),
    },
    {
      id: DEMO_SESSION_B,
      title: 'لقاء حضوري — الرياض',
      date: d10,
      session_type: 'inperson',
      price: 99,
      spots: 15,
      description: 'لقاء في الرياض لمراجعة نماذج مسارات حقيقية.',
      location_url: 'https://maps.google.com/?q=Riyadh',
      created_at: new Date().toISOString(),
    },
  ];
}

/** تسجيلات تجريبية مرتبطة بمعرفات الجلسات التجريبية. */
export function getDemoRegistrations(): SessionRegistration[] {
  const now = new Date().toISOString();
  const earlier = new Date(Date.now() - 3600000).toISOString();
  return [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      session_id: DEMO_SESSION_A,
      name: 'فاطمة الدوسري',
      whatsapp: '0500111222',
      created_at: now,
    },
    {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      session_id: DEMO_SESSION_A,
      name: 'خالد الشمري',
      whatsapp: '0555333444',
      created_at: earlier,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      session_id: DEMO_SESSION_B,
      name: 'لينا الحربي',
      whatsapp: '0544999888',
      created_at: now,
    },
  ];
}
