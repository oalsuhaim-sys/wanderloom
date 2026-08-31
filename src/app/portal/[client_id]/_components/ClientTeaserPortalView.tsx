'use client';

import {
  Compass,
  Headphones,
  Luggage,
  Sparkles,
  Wallet,
  AlertCircle,
  Dna,
} from 'lucide-react';

import { TripCountdown } from '@/app/portal/[client_id]/_components/TripCountdown';
import {
  formatInvoiceAmount,
  INVOICE_TYPE_LABEL,
} from '@/lib/crm-invoices';
import {
  groupMemberPortalBadge,
  paymentDeadlineBadgeLabel,
} from '@/lib/group-members';
import {
  TEASER_CARDS,
  type ClientTeaserPendingInvoice,
  type ClientTeaserPortalData,
} from '@/lib/client-teaser-portal';

const PANEL =
  'rounded-[1.75rem] border border-[#d4af37]/20 bg-gradient-to-b from-[#121816]/95 to-[#0a0d0b]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-8';

const FADE =
  'animate-[portalFadeIn_0.8s_ease-out_both]';

type ClientTeaserPortalViewProps = {
  data: ClientTeaserPortalData;
};

export function ClientTeaserPortalView({ data }: ClientTeaserPortalViewProps) {
  const { ledger } = data;
  const pendingInvoices =
    data.pendingInvoices?.length
      ? data.pendingInvoices
      : data.pendingInvoice
        ? [data.pendingInvoice]
        : [];

  return (
    <div
      dir="rtl"
      lang="ar"
      className="min-h-dvh bg-[#070908] text-white"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 90% 55% at 50% -15%, rgba(212,175,55,0.14), transparent 55%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(28,69,50,0.25), transparent)',
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes portalFadeIn {
              from { opacity: 0; transform: translateY(12px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `,
        }}
      />

      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <header className={`mb-10 text-center ${FADE}`}>
          <p className="text-[10px] font-black uppercase tracking-[0.45em] text-[#d4af37]/80">
            Wanderloom · Private Portal
          </p>
          <h1 className="mt-3 text-2xl font-black text-white sm:text-3xl">
            أهلاً {data.clientName}
          </h1>
          <p className="mt-2 text-sm font-semibold text-white/50">
            بوابتك التشويقية لـ{' '}
            <span className="text-[#d4af37]">{data.tripTitle}</span>
          </p>
        </header>

        {data.groupMember ? (
          <GroupMemberStatusBanner member={data.groupMember} />
        ) : null}

        {pendingInvoices.length > 0 ? (
          <section
            className={`${PANEL} ${FADE} mb-6 border-amber-400/40 bg-gradient-to-b from-amber-950/50 via-amber-950/25 to-[#121816]/95 shadow-[0_0_60px_rgba(245,158,11,0.12)]`}
            style={{ animationDelay: '0.05s' }}
            aria-label="فواتير بانتظار السداد"
          >
            <div className="mb-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-300/80">
                Payment Due
              </p>
              <h2 className="mt-2 text-xl font-black text-amber-50">
                🧾 فواتير بانتظار السداد
              </h2>
              <p className="mt-2 text-xs font-semibold text-amber-200/70">
                {data.paymentDueOnly
                  ? 'أكمل السداد الآمن لتفعيل بوابتك الكاملة ومتابعة تجهيز رحلتك.'
                  : 'لديك دفعة أو أكثر بانتظار التحويل — اضغط للسداد عبر بوابة الدفع الآمنة.'}
              </p>
            </div>
            <div className="space-y-3">
              {pendingInvoices.map((invoice) => (
                <PendingInvoiceCard key={invoice.id} invoice={invoice} />
              ))}
            </div>
          </section>
        ) : null}

        {!data.paymentDueOnly && !data.onboardingCompleted ? (
          <section
            className={`${PANEL} ${FADE} mb-6 border-[#d4af37]/30`}
            style={{ animationDelay: '0.08s' }}
            aria-label="نموذج التعارف"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#d4af37]/15 ring-1 ring-[#d4af37]/30">
                <Dna className="h-5 w-5 text-[#d4af37]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-white">نموذج التعارف VIP</p>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-white/55">
                  شاركنا تفضيلاتك السياحية لننسج لك تجربةً تشبهك — دقيقة واحدة من وقتك تفتح
                  عالماً من التفاصيل المدروسة.
                </p>
                <a
                  href={data.dnaWelcomeUrl}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#d4af37] px-4 py-3 text-xs font-black text-[#0a0d0b] shadow-[0_8px_30px_rgba(212,175,55,0.2)] transition hover:brightness-110 sm:w-auto"
                >
                  املأ نموذج التعارف ✨
                </a>
              </div>
            </div>
          </section>
        ) : null}

        {!data.paymentDueOnly && !data.groupStatusOnly ? (
          <>
        {/* Countdown */}
        <section
          className={`${PANEL} ${FADE} mb-6`}
          style={{ animationDelay: '0.1s' }}
          aria-label="العداد التنازلي"
        >
          <div className="mb-4 flex items-center justify-center gap-2 text-[#d4af37]/70">
            <Sparkles className="h-4 w-4" aria-hidden />
            <span className="text-[11px] font-black tracking-wide">العداد التنازلي</span>
          </div>
          <TripCountdown startDate={data.startDate} />
        </section>

        {/* Financial mini-ledger */}
        <section
          className={`${PANEL} ${FADE} mb-8`}
          style={{ animationDelay: '0.2s' }}
          aria-label="الملخص المالي"
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d4af37]/15 ring-1 ring-[#d4af37]/30">
              <Wallet className="h-4 w-4 text-[#d4af37]" aria-hidden />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#d4af37]/70">
                Financial Snapshot
              </p>
              <h2 className="text-sm font-black text-white">الملخص المالي</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MiniStat label="إجمالي الرحلة" value={ledger.totalCost} tone="gold" />
            <MiniStat label="المدفوع" value={ledger.paidAmount} tone="emerald" />
            <MiniStat label="المتبقي" value={ledger.remainingBalance} tone="amber" />
          </div>

          <p className="mt-4 text-center text-[11px] font-bold leading-relaxed text-white/50">
            إجمالي تكلفة الرحلة: {formatInvoiceAmount(ledger.totalCost)}
            <span className="mx-2 text-white/20">|</span>
            المدفوع: {formatInvoiceAmount(ledger.paidAmount)}
            <span className="mx-2 text-white/20">|</span>
            المتبقي: {formatInvoiceAmount(ledger.remainingBalance)}
          </p>
        </section>

        {/* Teaser cards */}
        <section aria-label="بطاقات التشويق">
          <div className={`mb-4 text-center ${FADE}`} style={{ animationDelay: '0.25s' }}>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#d4af37]/70">
              Teasers
            </p>
            <h2 className="mt-1 text-lg font-black text-white">لمحات قبل الانطلاق</h2>
            <p className="mt-1 text-xs font-semibold text-white/40">
              أسرار صغيرة… دون كشف المسار الكامل
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {TEASER_CARDS.map((card, index) => (
              <article
                key={card.id}
                className={`${PANEL} ${FADE} flex flex-col transition duration-300 hover:-translate-y-1 hover:border-[#d4af37]/40 hover:shadow-[0_20px_50px_rgba(212,175,55,0.12)]`}
                style={{ animationDelay: `${0.3 + index * 0.1}s` }}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#d4af37]/25 bg-[#d4af37]/10">
                  <TeaserIcon name={card.icon} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d4af37]/65">
                  {card.titleEn}
                </p>
                <h3 className="mt-1 text-base font-black text-white">{card.title}</h3>
                <p className="mt-3 flex-1 text-xs font-semibold leading-relaxed text-white/60">
                  {card.body}
                </p>
                {'hasSpotify' in card && card.hasSpotify ? (
                  <a
                    href={data.spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-[#d4af37]/35 bg-[#d4af37]/10 px-4 py-2.5 text-xs font-black text-[#d4af37] transition hover:bg-[#d4af37]/20"
                  >
                    <Headphones className="h-3.5 w-3.5" aria-hidden />
                    استمع على Spotify
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </section>
          </>
        ) : (
          <section
            className={`${PANEL} ${FADE} mb-8`}
            style={{ animationDelay: '0.15s' }}
            aria-label="الملخص المالي"
          >
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d4af37]/15 ring-1 ring-[#d4af37]/30">
                <Wallet className="h-4 w-4 text-[#d4af37]" aria-hidden />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#d4af37]/70">
                  Payment Summary
                </p>
                <h2 className="text-sm font-black text-white">ملخص الدفعة المطلوبة</h2>
              </div>
            </div>
            <MiniStat
              label="المبلغ المطلوب الآن"
              value={pendingInvoices[0]?.amount ?? ledger.totalCost}
              tone="amber"
            />
          </section>
        )}

        <footer className={`mt-12 text-center ${FADE}`} style={{ animationDelay: '0.6s' }}>
          <p className="text-[10px] font-semibold text-white/30">
            Wanderloom · صُممت لك وحدك
          </p>
        </footer>
      </div>
    </div>
  );
}

function GroupMemberStatusBanner({
  member,
}: {
  member: NonNullable<ClientTeaserPortalData['groupMember']>;
}) {
  const badge = groupMemberPortalBadge(member.status);
  const deadlineBadge =
    member.status === 'confirmed_seat'
      ? paymentDeadlineBadgeLabel(member.paymentDeadline)
      : null;
  const toneClass =
    badge.tone === 'green'
      ? 'border-emerald-400/40 bg-gradient-to-b from-emerald-950/55 via-emerald-950/25 to-[#121816]/95 text-emerald-50'
      : badge.tone === 'orange'
        ? 'border-orange-400/40 bg-gradient-to-b from-orange-950/55 via-orange-950/20 to-[#121816]/95 text-orange-50'
        : badge.tone === 'rose'
          ? 'border-rose-400/35 bg-gradient-to-b from-rose-950/50 via-rose-950/20 to-[#121816]/95 text-rose-50'
          : badge.tone === 'amber'
            ? 'border-amber-400/40 bg-gradient-to-b from-amber-950/50 via-amber-950/20 to-[#121816]/95 text-amber-50'
            : 'border-[#d4af37]/30 bg-gradient-to-b from-[#121816]/95 to-[#0a0d0b]/95 text-white';

  const pillClass =
    badge.tone === 'green'
      ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/30'
      : badge.tone === 'orange'
        ? 'bg-orange-500/20 text-orange-200 ring-orange-400/30'
        : badge.tone === 'rose'
          ? 'bg-rose-500/20 text-rose-200 ring-rose-400/30'
          : badge.tone === 'amber'
            ? 'bg-amber-500/20 text-amber-200 ring-amber-400/30'
            : 'bg-[#d4af37]/15 text-[#d4af37] ring-[#d4af37]/30';

  return (
    <section
      className={`${PANEL} ${FADE} mb-6 ${toneClass}`}
      style={{ animationDelay: '0.03s' }}
      aria-label="حالة انضمام المجموعة"
    >
      <div className="text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] opacity-70">
          Group Trip Status
        </p>
        <span
          className={`mt-3 inline-flex items-center rounded-full px-4 py-1.5 text-sm font-black ring-1 ${pillClass}`}
        >
          {badge.label}
        </span>
        {badge.detail ? (
          <p className="mt-3 text-xs font-semibold leading-relaxed opacity-80">{badge.detail}</p>
        ) : null}
        {deadlineBadge ? (
          <span
            className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black ring-1 ${
              deadlineBadge.tone === 'slate'
                ? 'bg-white/10 text-white/80 ring-white/20'
                : deadlineBadge.tone === 'amber'
                  ? 'bg-amber-500/20 text-amber-100 ring-amber-400/30'
                  : 'bg-rose-500/20 text-rose-100 ring-rose-400/30'
            }`}
          >
            {deadlineBadge.label}
          </span>
        ) : null}
        {member.tripTitle ? (
          <p className="mt-2 text-[11px] font-bold opacity-60">الرحلة: {member.tripTitle}</p>
        ) : null}
      </div>
    </section>
  );
}

function PendingInvoiceCard({ invoice }: { invoice: ClientTeaserPendingInvoice }) {
  return (
    <article className="rounded-2xl border border-amber-400/25 bg-black/25 p-4 ring-1 ring-amber-400/10">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-400/30">
          <AlertCircle className="h-5 w-5 text-amber-300" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-amber-50">
            {INVOICE_TYPE_LABEL[invoice.type]}
          </p>
          <p className="mt-1 text-lg font-black text-[#d4af37]" dir="ltr">
            {formatInvoiceAmount(invoice.amount)}
          </p>
          <a
            href={invoice.url}
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#d4af37] px-4 py-3.5 text-sm font-black text-[#0a0d0b] shadow-[0_8px_30px_rgba(212,175,55,0.25)] transition hover:brightness-110"
          >
            اضغط للسداد
          </a>
        </div>
      </div>
    </article>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'gold' | 'emerald' | 'amber';
}) {
  const tones = {
    gold: 'border-[#d4af37]/25 bg-[#d4af37]/10 text-[#d4af37]',
    emerald: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <p className="text-[10px] font-bold opacity-70">{label}</p>
      <p className="mt-1 text-base font-black" dir="ltr">
        {formatInvoiceAmount(value)}
      </p>
    </div>
  );
}

function TeaserIcon({ name }: { name: 'compass' | 'headphones' | 'suitcase' }) {
  const className = 'h-6 w-6 text-[#d4af37]';
  if (name === 'compass') return <Compass className={className} aria-hidden />;
  if (name === 'headphones') return <Headphones className={className} aria-hidden />;
  return <Luggage className={className} aria-hidden />;
}
