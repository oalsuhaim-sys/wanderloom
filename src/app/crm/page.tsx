'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  CalendarDays,
  Globe2,
  LayoutDashboard,
  Loader2,
  Map,
  Route,
  TrendingUp,
  Users,
} from 'lucide-react';

import { DEMO_CLIENTS, DEMO_EVENTS, DEMO_STATS } from '@/lib/crm-demo';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/supabase-config';

type DashboardStats = {
  clientsTotal: number;
  clientsNew: number;
  tripsCount: number;
  revenue: number;
};

type ClientRow = {
  id: string;
  name: string;
  phone_wa?: string | null;
  status?: string | null;
  created_at?: string | null;
  ref_code?: string | null;
  travel_type?: string | null;
  job_type?: string | null;
};

type EventRow = {
  id: string;
  name: string;
  country?: string | null;
  city?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  impact?: string | null;
  category?: string | null;
  season?: string | null;
};

export default function CRMDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [demo, setDemo] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    clientsTotal: 0,
    clientsNew: 0,
    tripsCount: 0,
    revenue: 0,
  });
  const [recentClients, setRecentClients] = useState<ClientRow[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventRow[]>([]);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const applyDemo = useCallback((reason?: string) => {
    setDemo(true);
    setStats({ ...DEMO_STATS });
    setRecentClients(DEMO_CLIENTS as ClientRow[]);
    setUpcomingEvents(DEMO_EVENTS as EventRow[]);
    if (reason) setError(reason);
    else setError('');
  }, []);

  const loadDashboard = useCallback(async () => {
    setError('');
    setDemo(false);

    if (!supabase) {
      applyDemo();
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [clientsRes, tripsRes, eventsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name, phone_wa, status, created_at, ref_code, travel_type, job_type')
          .order('created_at', { ascending: false }),
        supabase.from('client_trips').select('profit'),
        supabase
          .from('events')
          .select('id, name, country, city, start_date, end_date, impact, category, season')
          .gte('start_date', todayISO)
          .order('start_date', { ascending: true })
          .limit(6),
      ]);

      if (clientsRes.error || tripsRes.error || eventsRes.error) {
        applyDemo(
          clientsRes.error?.message ||
            tripsRes.error?.message ||
            eventsRes.error?.message ||
            'تعذر تحميل البيانات من Supabase.'
        );
        return;
      }

      const clients = (clientsRes.data || []) as ClientRow[];
      const trips = tripsRes.data || [];
      const events = (eventsRes.data || []) as EventRow[];

      const revenue = trips.reduce((s: number, t: { profit?: number | null }) => s + (Number(t?.profit) || 0), 0);

      setStats({
        clientsTotal: clients.length,
        clientsNew: clients.filter((c) => c.status === 'new').length,
        tripsCount: trips.length,
        revenue,
      });
      setRecentClients(clients.slice(0, 8));
      setUpcomingEvents(events);
    } catch (e) {
      applyDemo(e instanceof Error ? e.message : 'تعذر تحميل لوحة التحكم. تحقق من الشبكة وحاول مجدداً.');
    } finally {
      setLoading(false);
    }
  }, [applyDemo, todayISO]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const envOk = isSupabaseConfigured();

  if (loading) {
    return (
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#6B7280', fontWeight: 900 }}>
          <Loader2 size={22} style={{ marginBottom: 10, animation: 'spin 1s linear infinite' }} />
          جارٍ تحميل لوحة التحكم...
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div dir="rtl" style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* شريط وضع Demo */}
      {demo && (
        <div
          style={{
            marginBottom: 14,
            borderRadius: 16,
            padding: '12px 14px',
            background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)',
            border: '1px solid #FDE68A',
            color: '#92400E',
            fontSize: 12,
            fontWeight: 900,
            lineHeight: 1.6,
          }}
        >
          <strong>وضع تجريبي (Demo)</strong> — تعمل لوحة التحكم بدون اتصال ناجح بقاعدة البيانات.
          {!envOk && (
            <>
              {' '}
              أضف <code style={{ background: 'rgba(255,255,255,.6)', padding: '2px 6px', borderRadius: 6 }}>.env.local</code> مع{' '}
              <code style={{ background: 'rgba(255,255,255,.6)', padding: '2px 6px', borderRadius: 6 }}>NEXT_PUBLIC_SUPABASE_URL</code> و{' '}
              <code style={{ background: 'rgba(255,255,255,.6)', padding: '2px 6px', borderRadius: 6 }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
            </>
          )}
          {error && (
            <>
              <br />
              <span style={{ fontWeight: 700, opacity: 0.95 }}>التفاصيل: {error}</span>
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#1C4532' }}>لوحة التحكم</div>
          <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 800, marginTop: 4 }}>
            نظرة عامة على العملاء والرحلات والفعاليات — النشر:{' '}
            <span style={{ color: '#1C4532' }}>wanderloom-travel.vercel.app/crm</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Link
            href="/crm/sessions"
            style={{
              textDecoration: 'none',
              padding: '10px 14px',
              borderRadius: 14,
              background: '#fff',
              color: '#1C4532',
              fontSize: 12,
              fontWeight: 900,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid #E8E4DC',
              boxShadow: '0 1px 4px rgba(0,0,0,.04)',
            }}
          >
            <CalendarClock size={16} /> الجلسات
          </Link>
          <Link
            href="/crm/clients"
            style={{
              textDecoration: 'none',
              padding: '10px 14px',
              borderRadius: 14,
              background: 'linear-gradient(135deg,#8A6B2A,#C9A84C)',
              color: '#1C4532',
              fontSize: 12,
              fontWeight: 900,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid rgba(201,168,76,.55)',
            }}
          >
            <ArrowUpRight size={16} /> إدارة العملاء
          </Link>
        </div>
      </div>

      {/* روابط سريعة */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 10,
          marginBottom: 14,
        }}
      >
        {[
          { href: '/crm', label: 'الرئيسية', icon: LayoutDashboard },
          { href: '/crm/clients', label: 'العملاء', icon: Users },
          { href: '/crm/vault', label: 'بنك الأماكن', icon: Map },
          { href: '/crm/destinations', label: 'دليل الوجهات', icon: Globe2 },
          { href: '/crm/hotels', label: 'الفنادق', icon: Building2 },
          { href: '/crm/events', label: 'الفعاليات', icon: CalendarDays },
          { href: '/crm/sessions', label: 'الجلسات', icon: CalendarClock },
          { href: '/crm/itineraries', label: 'المسارات', icon: Route },
          { href: '/portal/sessions', label: 'بوابة العميل (جلسات)', icon: CalendarClock },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 14,
                background: '#FAFAF8',
                border: '1px solid #F3F0EB',
                color: '#1C4532',
                fontSize: 11,
                fontWeight: 900,
              }}
            >
              <Icon size={15} color="#C9A84C" />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
        {[
          { label: 'عدد العملاء', val: stats.clientsTotal.toLocaleString('ar-SA'), icon: <Users size={18} color="#1C4532" />, tint: '#1C4532' },
          { label: 'عملاء جدد', val: stats.clientsNew.toLocaleString('ar-SA'), icon: <Users size={18} color="#2563EB" />, tint: '#2563EB' },
          { label: 'الرحلات', val: stats.tripsCount.toLocaleString('ar-SA'), icon: <TrendingUp size={18} color="#059669" />, tint: '#059669' },
          { label: 'الإيرادات', val: `${stats.revenue.toLocaleString('ar-SA')} ر.س`, icon: <TrendingUp size={18} color="#C2410C" />, tint: '#C2410C' },
        ].map((s, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 16, padding: 14, boxShadow: '0 1px 6px rgba(0,0,0,.04)', border: '1px solid #F3F0EB' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  background: '#F6F4F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #E8E4DC',
                }}
              >
                {s.icon}
              </div>
              <div style={{ fontSize: 10, fontWeight: 900, color: '#6B7280' }}>{s.label}</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 1000, color: s.tint }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 14, alignItems: 'start' }}>
        <section style={{ background: '#fff', borderRadius: 16, padding: 14, boxShadow: '0 1px 6px rgba(0,0,0,.04)', border: '1px solid #F3F0EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 1000, color: '#1C4532' }}>آخر العملاء</div>
            <Link href="/crm/clients" style={{ fontSize: 11, fontWeight: 900, color: '#1C4532', textDecoration: 'none' }}>
              عرض الكل →
            </Link>
          </div>

          {recentClients.length === 0 ? (
            <div style={{ padding: 14, borderRadius: 14, border: '1px dashed #E5E0D6', color: '#9CA3AF', fontSize: 12, fontWeight: 900 }}>
              لا يوجد عملاء بعد.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentClients.map((c) => (
                <Link
                  key={c.id}
                  href={demo ? '/crm/clients' : `/crm/clients/${c.id}`}
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    padding: '10px 12px',
                    borderRadius: 14,
                    background: '#FAFAF8',
                    border: '1px solid #F3F0EB',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 1000,
                        color: '#1C4532',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.name}
                    </div>
                    <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 800, marginTop: 2 }}>
                      {c.phone_wa ? `📱 ${c.phone_wa}` : ''} {c.travel_type ? `· 🧳 ${c.travel_type}` : ''}{' '}
                      {c.ref_code ? `· 🔑 ${c.ref_code}` : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 900, whiteSpace: 'nowrap' }}>
                    {c.created_at ? new Date(c.created_at).toLocaleDateString('ar-SA') : ''}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section style={{ background: '#fff', borderRadius: 16, padding: 14, boxShadow: '0 1px 6px rgba(0,0,0,.04)', border: '1px solid #F3F0EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarDays size={16} color="#C9A84C" />
              <div style={{ fontSize: 13, fontWeight: 1000, color: '#1C4532' }}>الفعاليات القادمة</div>
            </div>
            <Link href="/crm/events" style={{ fontSize: 11, fontWeight: 900, color: '#1C4532', textDecoration: 'none' }}>
              عرض →
            </Link>
          </div>

          {upcomingEvents.length === 0 ? (
            <div style={{ padding: 14, borderRadius: 14, border: '1px dashed #E5E0D6', color: '#9CA3AF', fontSize: 12, fontWeight: 900 }}>
              لا توجد فعاليات قادمة.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcomingEvents.map((e) => {
                const imp = String(e.impact || '');
                const tint = imp === 'feature' ? '#059669' : imp === 'obstacle' ? '#DC2626' : '#6B7280';
                const bg = imp === 'feature' ? '#D1FAE5' : imp === 'obstacle' ? '#FEE2E2' : '#F3F4F6';
                return (
                  <div key={e.id} style={{ padding: '10px 12px', borderRadius: 14, background: '#FAFAF8', border: '1px solid #F3F0EB' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 1000,
                          color: '#1C4532',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {e.name}
                      </div>
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: bg,
                          color: tint,
                          fontSize: 10,
                          fontWeight: 1000,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {imp || '—'}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 800, marginTop: 4 }}>
                      {e.country ? `🌍 ${e.country}` : ''} {e.city ? `· 📍 ${e.city}` : ''}{' '}
                      {e.start_date ? `· 📅 ${e.start_date}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div style={{ marginTop: 16, textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#D1D5DB', letterSpacing: 4 }}>
        WANDERLOOM CRM
      </div>
    </div>
  );
}
