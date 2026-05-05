import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/supabase-config';

export default async function Home() {
  const configured = isSupabaseConfigured();
  let clients: { name: string; status: string | null; phone_wa: string | null }[] | null = null;
  let dbError: string | null = null;

  if (supabase) {
    const { data, error } = await supabase.from('clients').select('name, status, phone_wa').order('created_at');
    if (error) dbError = error.message;
    else clients = data ?? [];
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', padding: 32, fontFamily: 'system-ui, sans-serif', background: '#F6F4F0' }}>
      <header
        style={{
          maxWidth: 720,
          margin: '0 auto 28px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ color: '#1C4532', fontSize: 26, fontWeight: 900, margin: 0 }}>Wanderloom</h1>
          <p style={{ color: '#6B7280', fontSize: 13, fontWeight: 700, marginTop: 6 }}>الموقع الرئيسي</p>
        </div>
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Link
            href="/crm"
            style={{
              textDecoration: 'none',
              padding: '10px 16px',
              borderRadius: 14,
              background: 'linear-gradient(135deg,#8A6B2A,#C9A84C)',
              color: '#1C4532',
              fontSize: 13,
              fontWeight: 900,
              border: '1px solid rgba(201,168,76,.55)',
            }}
          >
            لوحة CRM
          </Link>
          <Link
            href="/portal/sessions"
            style={{
              textDecoration: 'none',
              padding: '10px 16px',
              borderRadius: 14,
              background: '#fff',
              color: '#1C4532',
              fontSize: 13,
              fontWeight: 900,
              border: '1px solid #E8E4DC',
            }}
          >
            جلسات العملاء
          </Link>
          <Link
            href="/portal"
            style={{
              textDecoration: 'none',
              padding: '10px 16px',
              borderRadius: 14,
              background: '#fff',
              color: '#1C4532',
              fontSize: 13,
              fontWeight: 900,
              border: '1px solid #E8E4DC',
            }}
          >
            بوابة المسار
          </Link>
        </nav>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto' }}>
        {!configured && (
          <div
            style={{
              marginBottom: 20,
              padding: 14,
              borderRadius: 16,
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              color: '#92400E',
              fontSize: 13,
              fontWeight: 800,
              lineHeight: 1.65,
            }}
          >
            لم يُضبط Supabase بعد. يمكنك فتح{' '}
            <Link href="/crm" style={{ color: '#1C4532', fontWeight: 900 }}>
              /crm
            </Link>{' '}
            لتجربة الوضع التجريبي، أو أنشئ ملف <code style={{ background: 'rgba(255,255,255,.7)', padding: '2px 6px', borderRadius: 6 }}>.env.local</code> انظر{' '}
            <code style={{ background: 'rgba(255,255,255,.7)', padding: '2px 6px', borderRadius: 6 }}>.env.example</code>.
          </div>
        )}

        {!supabase && (
          <p style={{ color: '#6B7280', fontSize: 14, fontWeight: 700 }}>
            التطبيق يعمل بدون عميل Supabase — استخدم رابط لوحة CRM أعلاه للمعاينة.
          </p>
        )}

        {supabase && dbError && (
          <div style={{ padding: 16, background: '#FEF2F2', borderRadius: 12, color: '#991B1B', fontWeight: 800, marginBottom: 16 }}>
            خطأ قاعدة البيانات: {dbError}
          </div>
        )}

        {supabase && !dbError && clients && (
          <>
            <p style={{ color: '#6B7280', fontWeight: 800, marginBottom: 16 }}>
              متصل بـ Supabase — {clients.length} عميل في الجدول.
            </p>
            {clients.map((c, i) => (
              <div
                key={i}
                style={{
                  padding: '12px 16px',
                  margin: '8px 0',
                  background: '#fff',
                  borderRadius: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  border: '1px solid #F3F0EB',
                }}
              >
                <span style={{ fontWeight: 800, color: '#1C4532' }}>{c.name}</span>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>{c.status}</span>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
