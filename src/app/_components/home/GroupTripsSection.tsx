'use client';

import { useState } from 'react';
import { Loader2, Users, X } from 'lucide-react';

import { submitGroupTripLead } from '@/app/actions/submitGroupTripLead';
import { ar } from '@/messages/ar';

const h = ar.home;

const PACKAGES = [
  {
    title: h.groupTripJapanTitle,
    blurb: h.groupTripJapanBlurb,
    ring: 'ring-[#c9a84c]/35',
    chip: 'bg-[#1c4532]/15 text-[#1c4532]',
  },
  {
    title: h.groupTripKoreaTitle,
    blurb: h.groupTripKoreaBlurb,
    ring: 'ring-sky-300/40',
    chip: 'bg-sky-50 text-sky-900',
  },
  {
    title: h.groupTripEuropeTitle,
    blurb: h.groupTripEuropeBlurb,
    ring: 'ring-violet-300/40',
    chip: 'bg-violet-50 text-violet-900',
  },
] as const;

export function GroupTripsSection() {
  const [open, setOpen] = useState<(typeof PACKAGES)[number] | null>(null);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [groupSize, setGroupSize] = useState('8');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  function closeModal() {
    if (submitting) return;
    setOpen(null);
    setMsg(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!open) return;
    const gs = parseInt(groupSize, 10);
    if (!name.trim() || !whatsapp.trim()) {
      setMsg({ type: 'err', text: ar.errors.trip.namePhone });
      return;
    }
    if (!Number.isFinite(gs) || gs < 1) {
      setMsg({ type: 'err', text: ar.errors.groupTrip.invalidSize });
      return;
    }

    setSubmitting(true);
    setMsg(null);
    const res = await submitGroupTripLead({
      full_name: name.trim(),
      phone_wa: whatsapp.trim(),
      group_size: gs,
      trip_label: open.title,
    });
    setSubmitting(false);

    if (!res.ok) {
      setMsg({ type: 'err', text: res.error ?? ar.errors.session.genericRegistration });
      return;
    }

    setMsg({ type: 'ok', text: res.message ?? ar.success.groupTripRegistered });
    setTimeout(() => {
      closeModal();
      setName('');
      setWhatsapp('');
      setGroupSize('8');
      setMsg(null);
    }, 2200);
  }

  return (
    <>
      <p className="mx-auto mt-6 max-w-2xl text-center text-sm font-bold leading-relaxed text-[#3d4a42] sm:text-base">
        {h.groupsCardsHint}
      </p>

      <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PACKAGES.map((pkg) => (
          <article
            key={pkg.title}
            className={`flex flex-col rounded-[1.75rem] border border-stone-200/90 bg-white p-6 shadow-[0_12px_40px_rgba(20,34,28,0.08)] ring-1 ${pkg.ring}`}
          >
            <span className={`w-fit rounded-full px-3 py-1 text-[10px] font-black ${pkg.chip}`}>
              <Users className="mb-0.5 mr-1 inline h-3.5 w-3.5 align-middle" aria-hidden />
              مجموعة
            </span>
            <h3 className="mt-4 text-lg font-black leading-snug text-[#0f1e16]">{pkg.title}</h3>
            <p className="mt-3 flex-1 text-sm font-bold leading-relaxed text-[#4a5650]">{pkg.blurb}</p>
            <button
              type="button"
              onClick={() => {
                setOpen(pkg);
                setName('');
                setWhatsapp('');
                setGroupSize('8');
                setMsg(null);
              }}
              className="mt-6 w-full rounded-2xl bg-[#1c4532] py-3.5 text-sm font-black text-[#f0e4c4] shadow-md transition hover:bg-[#163a30]"
            >
              {h.groupRegisterCta}
            </button>
          </article>
        ))}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[340] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="group-trip-modal-title"
          onClick={() => closeModal()}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-[#c9a84c]/30 bg-[#071612] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 id="group-trip-modal-title" className="text-sm font-black text-[#d4b87a]">
                  {h.groupModalTitle}
                </h3>
                <p className="mt-1 text-xs font-bold text-white/45">
                  {h.groupModalTrip}: {open.title}
                </p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={closeModal}
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/15 disabled:opacity-50"
                aria-label={h.groupModalClose}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="mt-5 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-black text-white/80">{h.groupNameLabel}</label>
                <input
                  required
                  className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2.5 text-sm font-bold text-white outline-none ring-[#c9a84c] placeholder:text-white/30 focus:ring-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={h.groupNamePlaceholder}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-black text-white/80">{h.groupWaLabel}</label>
                <input
                  required
                  type="tel"
                  dir="ltr"
                  className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2.5 text-sm font-bold text-white outline-none ring-[#c9a84c] placeholder:text-white/30 focus:ring-2"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder={h.groupWaPlaceholder}
                  autoComplete="tel"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-black text-white/80">{h.groupSizeLabel}</label>
                <input
                  required
                  type="number"
                  min={1}
                  max={199}
                  className="w-full rounded-xl border border-white/12 bg-black/30 px-3 py-2.5 text-sm font-bold text-white outline-none ring-[#c9a84c] focus:ring-2"
                  value={groupSize}
                  onChange={(e) => setGroupSize(e.target.value)}
                />
              </div>

              {msg ? (
                <div
                  className={`rounded-xl border px-3 py-2 text-xs font-black ${
                    msg.type === 'ok'
                      ? 'border-emerald-400/40 bg-emerald-950/50 text-emerald-100'
                      : 'border-red-400/40 bg-red-950/50 text-red-100'
                  }`}
                >
                  {msg.text}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#7a5f28] to-[#d4b87a] py-3 text-sm font-black text-[#0a1814] disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {h.groupSubmit}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
