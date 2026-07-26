'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  Copy,
  Crown,
  Languages,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plane,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';

import {
  EXPERT_ACTIVITY_STRENGTH_OPTIONS,
  EXPERT_ROUTING_STYLE_OPTIONS,
  LEADER_PREFERRED_STYLE_OPTIONS,
  LEADER_SPECIAL_SKILL_OPTIONS,
  isPartnerDnaRawFilled,
  parsePartnerDnaProfile,
  partnerDnaDisplayEntries,
  partnerDnaSharePath,
  partnerTypeLabel,
  type PartnerDnaProfile,
  type PartnerDnaType,
} from '@/lib/partner-dna';
import { whatsAppHrefWithText } from '@/lib/client-intake-pipeline';
import { CRM_DESTINATIONS_GUIDE } from '@/lib/crm-destinations-guide-data';
import { LeaderAvailability } from '@/components/LeaderAvailability';
import { SmartWallet } from '@/components/SmartWallet';
import {
  ExpertAssignmentsPanel,
  type ExpertAssignedQuotation,
} from '@/components/ExpertAssignmentsPanel';

type ProfileState = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string | null;
  languages: string[];
  experienceYears: number | null;
  destinations: string | null;
  specialtyRegions: string | null;
  platforms: string | null;
  contentFocus: string | null;
  profileUrl: string | null;
  dna: PartnerDnaProfile;
};

type MatchingGroupTrip = {
  id: string;
  title: string;
  destination: string | null;
  dates: string | null;
  assignedExpertId: string | null;
};

const FIELD =
  'w-full rounded-xl border border-[#D4AF37]/25 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/25';

function parseType(raw: string | null): PartnerDnaType | null {
  if (raw === 'leaders' || raw === 'experts' || raw === 'celebrities') return raw;
  if (raw === 'leader') return 'leaders';
  if (raw === 'expert') return 'experts';
  if (raw === 'celebrity') return 'celebrities';
  return null;
}

function splitTags(raw: string | null): string[] {
  return String(raw ?? '')
    .split(/[,،·]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function PartnerProfileInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id')?.trim() ?? '';
  const type = parseType(searchParams.get('type'));

  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [itineraries, setItineraries] = useState<
    Array<{
      id: string;
      title: string;
      destination: string | null;
      status: string | null;
      dates: string | null;
    }>
  >([]);
  const [quotations, setQuotations] = useState<ExpertAssignedQuotation[]>([]);
  const [matchingGroupTrips, setMatchingGroupTrips] = useState<
    MatchingGroupTrip[]
  >([]);
  const [assigningTripId, setAssigningTripId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editLanguages, setEditLanguages] = useState('');
  const [editExperience, setEditExperience] = useState('');
  const [editDestinations, setEditDestinations] = useState('');
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editPlatforms, setEditPlatforms] = useState('');
  const [editContentFocus, setEditContentFocus] = useState('');
  const [editProfileUrl, setEditProfileUrl] = useState('');
  const [editTripStyle, setEditTripStyle] = useState('');
  const [editStrengths, setEditStrengths] = useState('');
  const [editCompetitiveAdvantage, setEditCompetitiveAdvantage] = useState('');
  const [editAgencyRequirements, setEditAgencyRequirements] = useState('');
  const [editRoutingStyles, setEditRoutingStyles] = useState<string[]>([]);
  const [editSpecialSkills, setEditSpecialSkills] = useState<string[]>([]);
  const [editPreferredStyles, setEditPreferredStyles] = useState<string[]>([]);
  const [editActivityStrengths, setEditActivityStrengths] = useState<string[]>([]);

  const dnaLink = useMemo(() => {
    if (typeof window === 'undefined' || !id || !type) return '';
    return `${window.location.origin}${partnerDnaSharePath(type, id)}`;
  }, [id, type]);

  const apiBase = useMemo(() => {
    if (!type || !id) return '';
    if (type === 'leaders') return `/api/crm/leaders/${encodeURIComponent(id)}`;
    if (type === 'experts') return `/api/crm/experts/${encodeURIComponent(id)}`;
    return `/api/crm/celebrities/${encodeURIComponent(id)}`;
  }, [type, id]);

  const load = useCallback(async () => {
    if (!id || !type) {
      setError('معرّف الشريك أو النوع غير صالح.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiBase);
      const payload = (await res.json()) as {
        ok?: boolean;
        leader?: Record<string, unknown>;
        expert?: Record<string, unknown>;
        celebrity?: Record<string, unknown>;
        itineraries?: Array<{
          id: string;
          title: string;
          destination: string | null;
          status: string | null;
          dates: string | null;
        }>;
        quotations?: ExpertAssignedQuotation[];
        matchingGroupTrips?: MatchingGroupTrip[];
        error?: string;
      };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || 'تعذر التحميل');
      }

      const row =
        type === 'leaders'
          ? payload.leader
          : type === 'experts'
            ? payload.expert
            : payload.celebrity;

      if (!row) throw new Error('الشريك غير موجود');

      setItineraries(
        type === 'experts' && Array.isArray(payload.itineraries)
          ? payload.itineraries
          : [],
      );
      setQuotations(
        type === 'experts' && Array.isArray(payload.quotations)
          ? payload.quotations
          : [],
      );
      setMatchingGroupTrips(
        type === 'experts' && Array.isArray(payload.matchingGroupTrips)
          ? payload.matchingGroupTrips
          : [],
      );

      // مصدر البصمة: partnerDna / dnaProfile من CRM، مع تأكيد عبر /api/partners/dna
      let dnaSource: unknown =
        row.partnerDna ?? row.dnaProfile ?? row.dna_profile ?? {};

      try {
        const dnaQs = new URLSearchParams({ id, type });
        const dnaRes = await fetch(`/api/partners/dna?${dnaQs.toString()}`);
        const dnaPayload = (await dnaRes.json()) as {
          ok?: boolean;
          partner?: { dnaProfile?: PartnerDnaProfile };
        };
        if (dnaRes.ok && dnaPayload.ok && dnaPayload.partner?.dnaProfile) {
          dnaSource = dnaPayload.partner.dnaProfile;
        }
      } catch {
        /* احتفظ بمصدر CRM */
      }

      const dna = parsePartnerDnaProfile(dnaSource);

      const next: ProfileState = {
        id: String(row.id),
        name: String(row.name ?? ''),
        phone: row.phone != null ? String(row.phone) : null,
        email: row.email != null ? String(row.email) : null,
        status: row.status != null ? String(row.status) : null,
        languages: Array.isArray(row.languages)
          ? (row.languages as string[])
          : [],
        experienceYears:
          row.experienceYears != null && Number.isFinite(Number(row.experienceYears))
            ? Number(row.experienceYears)
            : null,
        destinations: row.destinations != null ? String(row.destinations) : null,
        specialtyRegions:
          row.specialtyRegions != null ? String(row.specialtyRegions) : null,
        platforms: row.platforms != null ? String(row.platforms) : null,
        contentFocus: row.contentFocus != null ? String(row.contentFocus) : null,
        profileUrl: row.profileUrl != null ? String(row.profileUrl) : null,
        dna,
      };

      setProfile(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التحميل');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [apiBase, id, type]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const openEdit = () => {
    if (!profile) return;
    setEditName(profile.name);
    setEditPhone(profile.phone ?? '');
    setEditEmail(profile.email ?? '');
    setEditLanguages(profile.languages.join('، '));
    setEditExperience(
      profile.experienceYears != null ? String(profile.experienceYears) : '',
    );
    setEditDestinations(profile.destinations ?? '');
    setEditSpecialty(
      profile.specialtyRegions ||
        profile.dna.approvedDestinations.join('، ') ||
        '',
    );
    setEditPlatforms(profile.platforms ?? '');
    setEditContentFocus(profile.contentFocus ?? '');
    setEditProfileUrl(profile.profileUrl ?? '');
    setEditTripStyle(profile.dna.tripStyle ?? '');
    setEditStrengths(profile.dna.strengths ?? '');
    setEditCompetitiveAdvantage(profile.dna.competitiveAdvantage ?? '');
    setEditAgencyRequirements(profile.dna.agencyRequirements ?? '');
    setEditRoutingStyles(profile.dna.routingStyles ?? []);
    setEditSpecialSkills(profile.dna.specialSkills ?? []);
    setEditPreferredStyles(profile.dna.preferredStyles ?? []);
    setEditActivityStrengths(profile.dna.activityStrengths ?? []);
    setEditOpen(true);
    setNotice(null);
  };

  const handleSaveEdit = async () => {
    if (!apiBase || !type) return;
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const approvedFromSpecialty = splitTags(editSpecialty);
      const approvedFromDestinations = splitTags(editDestinations);
      const dnaProfile: PartnerDnaProfile = {
        ...profile!.dna,
        tripStyle: editTripStyle.trim(),
        strengths: editStrengths.trim(),
        competitiveAdvantage: editCompetitiveAdvantage.trim(),
        agencyRequirements: editAgencyRequirements.trim(),
        routingStyles: editRoutingStyles,
        specialSkills: editSpecialSkills,
        preferredStyles: editPreferredStyles,
        activityStrengths: editActivityStrengths,
        approvedDestinations:
          type === 'experts'
            ? approvedFromSpecialty
            : type === 'leaders'
              ? approvedFromDestinations.length
                ? approvedFromDestinations
                : profile!.dna.approvedDestinations
              : profile!.dna.approvedDestinations,
      };

      const body: Record<string, unknown> = {
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        dnaProfile,
        dna_profile: dnaProfile,
      };
      if (type === 'leaders') {
        body.languages = editLanguages;
        body.experienceYears = editExperience.trim()
          ? Number(editExperience)
          : null;
        body.destinations = editDestinations.trim();
      } else if (type === 'experts') {
        body.specialtyRegions = editSpecialty.trim();
        body.specialty_regions = editSpecialty.trim();
      } else {
        body.platforms = editPlatforms.trim();
        body.contentFocus = editContentFocus.trim();
        body.profileUrl = editProfileUrl.trim();
      }

      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || 'تعذر الحفظ');
      }
      setEditOpen(false);
      setNotice('تم تحديث بيانات الشريك.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!apiBase || !type) return;
    if (
      !window.confirm(
        'هل أنت متأكد من حذف هذا الشريك نهائياً؟ لا يمكن التراجع عن هذا الإجراء.',
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(apiBase, { method: 'DELETE' });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || 'تعذر الحذف');
      }
      router.push(`/crm/partners-directory?tab=${type}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الحذف');
      setDeleting(false);
    }
  };

  const handleCopyDna = async () => {
    if (!dnaLink) return;
    try {
      await navigator.clipboard.writeText(dnaLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('تعذر نسخ الرابط');
    }
  };

  const handleSendWhatsApp = () => {
    if (!profile) return;
    const expertPhone = String(profile.phone ?? '').trim();
    if (!expertPhone) {
      toast.error('أضف رقم واتساب للشريك أولاً من تعديل الملف');
      return;
    }
    const linkToSend = String(dnaLink ?? '').trim();
    if (!linkToSend) {
      toast.error('رابط البصمة غير جاهز بعد');
      return;
    }

    try {
      const displayName = String(profile.name ?? '').trim() || 'شريكنا الكريم';
      const message = [
        `مرحباً ${displayName}!`,
        'نرجو منك تعبئة "بصمة الشريك" الخاصة بك لتحديد أسلوب عملك وتخصصك عبر هذا الرابط:',
        linkToSend,
      ].join('\n');

      const waUrl = whatsAppHrefWithText(expertPhone, message);
      const opened = window.open(waUrl, '_blank', 'noopener,noreferrer');
      if (!opened) {
        toast.error('تعذر فتح الواتساب — اسمح بالنوافذ المنبثقة ثم أعد المحاولة.');
        return;
      }
      toast.success('جاري تحويلك إلى الواتساب...');
    } catch (error) {
      console.error('WhatsApp redirect failed:', error);
      toast.error('حدث خطأ أثناء محاولة فتح الواتساب.');
    }
  };

  const handleAssignExpert = async (tripId: string) => {
    if (!id) return;
    setAssigningTripId(tripId);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/crm/itineraries/${encodeURIComponent(tripId)}/expert`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expert_id: id }),
        },
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'تعذر تكليف الخبير');
      }
      setNotice('تم تكليف الخبير بالرحلة الجماعية بنجاح.');
      setMatchingGroupTrips((current) =>
        current.map((trip) =>
          trip.id === tripId ? { ...trip, assignedExpertId: id } : trip,
        ),
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تكليف الخبير');
    } finally {
      setAssigningTripId(null);
    }
  };

  const toggleEditSpecialty = (destination: string) => {
    const current = splitTags(editSpecialty);
    const next = current.includes(destination)
      ? current.filter((item) => item !== destination)
      : [...current, destination];
    setEditSpecialty(next.join('، '));
  };

  const toggleTagList = (
    current: string[],
    value: string,
    setter: (next: string[]) => void,
  ) => {
    setter(
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm font-bold text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        جاري تحميل الملف…
      </div>
    );
  }

  if (!profile || !type) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center" dir="rtl">
        <p className="font-bold text-rose-800">{error || 'غير موجود'}</p>
        <Link
          href="/crm/partners-directory"
          className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#1E2720]"
        >
          <ArrowRight className="h-4 w-4" />
          دليل الشركاء
        </Link>
      </div>
    );
  }

  const roleLabel = partnerTypeLabel(type);
  const approvedDestinations = Array.from(
    new Set([
      ...profile.dna.approvedDestinations,
      ...splitTags(
        type === 'experts' ? profile.specialtyRegions : profile.destinations,
      ),
    ]),
  );
  const dnaEntries = partnerDnaDisplayEntries(profile.dna);
  const cardClass =
    'rounded-2xl border border-slate-100 bg-white p-6 shadow-sm';

  return (
    <div className="min-h-screen bg-[#F7F8F6] p-4 sm:p-6 lg:p-8" dir="rtl">
      <Toaster position="top-center" />
      <Link
        href={`/crm/partners-directory?tab=${type}`}
        className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-slate-900"
      >
        <ArrowRight className="h-4 w-4" />
        دليل الشركاء
      </Link>

      {notice ? (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row">
        <main className="min-w-0 flex-1 space-y-6">
          <section className={cardClass}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#153326] text-[#D4AF37]">
                    <UserRound className="h-6 w-6" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-slate-900">
                      {profile.name}
                    </h1>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-800 ring-1 ring-amber-200">
                        {roleLabel}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-800 ring-1 ring-emerald-200">
                        {profile.status === 'active' ? 'نشط' : profile.status || '—'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-slate-600">
                  {profile.phone ? (
                    <span className="inline-flex items-center gap-1.5" dir="ltr">
                      <Phone className="h-3.5 w-3.5" />
                      {profile.phone}
                    </span>
                  ) : null}
                  {profile.email ? (
                    <span className="inline-flex items-center gap-1.5" dir="ltr">
                      <Mail className="h-3.5 w-3.5" />
                      {profile.email}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={openEdit}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-200"
                >
                  <Pencil className="h-4 w-4" />
                  تعديل
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-rose-500 ring-1 ring-rose-100 transition hover:bg-rose-50 disabled:opacity-50"
                  aria-label="حذف الشريك"
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </section>

          {type === 'leaders' ? (
            <LeaderAvailability leaderId={profile.id} />
          ) : null}

          {type === 'leaders' || type === 'experts' ? (
            <SmartWallet
              partnerId={profile.id}
              partnerType={type === 'leaders' ? 'leader' : 'expert'}
            />
          ) : null}

          {(type === 'leaders' || type === 'celebrities') ? (
            <section className={cardClass}>
              <h2 className="mb-5 text-base font-black text-slate-900">
                تفاصيل الشريك
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {type === 'leaders' ? (
                  <>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="inline-flex items-center gap-2 text-xs font-bold text-slate-500">
                        <Languages className="h-4 w-4 text-amber-600" />
                        اللغات
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {profile.languages.length ? (
                          profile.languages.map((language) => (
                            <span key={language} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                              {language}
                            </span>
                          ))
                        ) : <span className="text-sm text-slate-400">—</span>}
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-bold text-slate-500">سنوات الخبرة</p>
                      <p className="mt-3 text-xl font-black text-slate-900">
                        {profile.experienceYears != null
                          ? `${profile.experienceYears} سنوات`
                          : '—'}
                      </p>
                    </div>
                  </>
                ) : null}
                {type === 'celebrities' ? (
                  <>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-bold text-slate-500">المنصات</p>
                      <p className="mt-2 text-sm font-bold text-slate-900">{profile.platforms || '—'}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-bold text-slate-500">تركيز المحتوى</p>
                      <p className="mt-2 text-sm font-bold text-slate-900">{profile.contentFocus || '—'}</p>
                    </div>
                  </>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className={cardClass}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="inline-flex items-center gap-2 text-base font-black text-slate-900">
                  <Sparkles className="h-5 w-5 text-amber-600" />
                  بصمة الشريك
                </h2>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  أسلوب العمل والتخصص والميزة التنافسية
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleCopyDna()}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-black text-amber-900 transition hover:bg-amber-100"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  {copied
                    ? 'تم النسخ'
                    : isPartnerDnaRawFilled(profile.dna)
                      ? 'نسخ الرابط مجدداً'
                      : 'نسخ رابط تعبئة البصمة'}
                </button>
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#25D366] bg-white px-4 py-2.5 text-xs font-black text-[#25D366] transition hover:bg-[#25D366] hover:text-white"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 fill-current"
                    aria-hidden
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-1.99.522.531-1.938-.235-.375a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.85 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  إرسال عبر الواتساب
                </button>
              </div>
            </div>

            {dnaEntries.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {dnaEntries.map((entry) => (
                  <div key={entry.key} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <strong className="block text-xs font-black text-slate-600">
                      {entry.label}
                    </strong>
                    {Array.isArray(entry.value) ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {entry.value.map((value) => (
                          <span
                            key={value}
                            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                              type === 'experts'
                                ? 'border-sky-200 bg-sky-50 text-sky-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {value}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-800">
                        {entry.value}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-5 text-center">
                <p className="text-sm font-bold text-slate-700">
                  لم تُعبَّأ البصمة بعد
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  انسخ الرابط أو أرسله مباشرة عبر واتساب ليحدد أسلوبه ووجهاته ونقاط قوته.
                </p>
                {dnaLink ? (
                  <p className="mt-3 break-all rounded-lg bg-white px-3 py-2 text-[10px] text-slate-500" dir="ltr">
                    {dnaLink}
                  </p>
                ) : null}
              </div>
            )}
          </section>

          {type === 'experts' ? (
            <section className={cardClass}>
              <div className="mb-4">
                <h2 className="inline-flex items-center gap-2 text-base font-black text-slate-900">
                  <Sparkles className="h-5 w-5 text-amber-600" />
                  الرحلات الجماعية المتوافقة
                </h2>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  مطابقة ذكية بين وجهات بصمة الخبير والرحلات الجماعية النشطة
                </p>
              </div>
              {matchingGroupTrips.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {matchingGroupTrips.map((trip) => {
                    const assignedToCurrentExpert =
                      trip.assignedExpertId === profile.id;
                    const assignedElsewhere =
                      Boolean(trip.assignedExpertId) && !assignedToCurrentExpert;
                    return (
                      <article
                        key={trip.id}
                        className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4"
                      >
                        <Link
                          href={`/crm/itineraries/${encodeURIComponent(trip.id)}/edit`}
                          className="font-black text-slate-900 transition hover:text-emerald-800"
                        >
                          {trip.title}
                        </Link>
                        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
                          <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                          {trip.destination || 'وجهة غير محددة'}
                        </p>
                        {trip.dates ? (
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {trip.dates}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void handleAssignExpert(trip.id)}
                          disabled={
                            assigningTripId === trip.id ||
                            assignedToCurrentExpert
                          }
                          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#153326] px-3 py-2.5 text-xs font-black text-white transition hover:bg-[#204834] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {assigningTripId === trip.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserRound className="h-3.5 w-3.5" />
                          )}
                          {assignedToCurrentExpert
                            ? 'مكلّف بهذه الرحلة'
                            : assignedElsewhere
                              ? 'إعادة تكليف لهذا الخبير'
                              : 'تكليف الخبير'}
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">
                  لا توجد رحلات جماعية نشطة متوافقة مع وجهات الخبير حالياً.
                </div>
              )}
            </section>
          ) : null}

          {type === 'experts' ? (
            <section className={cardClass}>
              <ExpertAssignmentsPanel
                itineraries={itineraries}
                quotations={quotations}
              />
            </section>
          ) : null}
        </main>

        <aside className="space-y-6 lg:w-80 lg:shrink-0">
          <div className="space-y-6 lg:sticky lg:top-6">
            <section className={cardClass}>
              <h2 className="mb-4 text-base font-black text-slate-900">
                إحصائيات سريعة
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3">
                  <span className="inline-flex items-center gap-2 text-slate-600">
                    <CircleDollarSign className="h-4 w-4 text-amber-600" />
                    إجمالي العمولات
                  </span>
                  <span className="font-black text-emerald-700" dir="ltr">0 ر.س</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3">
                  <span className="inline-flex items-center gap-2 text-slate-600">
                    <Star className="h-4 w-4 text-amber-500" />
                    تقييم الشريك
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-800 ring-1 ring-amber-200">
                    <Crown className="h-3 w-3" />
                    VIP
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-3">
                  <span className="inline-flex items-center gap-2 text-slate-600">
                    <Plane className="h-4 w-4 text-amber-600" />
                    الرحلات المستلمة
                  </span>
                  <span className="font-black text-slate-900">{itineraries.length}</span>
                </div>
              </div>
            </section>
            <section className="overflow-hidden rounded-2xl bg-gradient-to-bl from-[#132C21] to-[#0D1E17] p-6 text-white shadow-lg">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#D4AF37]">
                Partner Status
              </p>
              <h3 className="mt-2 text-lg font-black">{roleLabel}</h3>
              <p className="mt-2 text-xs font-semibold leading-6 text-white/60">
                {approvedDestinations.length} وجهات معتمدة · {dnaEntries.length ? 'البصمة مكتملة' : 'بانتظار البصمة'}
              </p>
            </section>
          </div>
        </aside>
      </div>

      {editOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
            dir="rtl"
          >
            <div className="mb-5 flex items-center justify-between sticky top-0 z-10 -mx-6 -mt-6 border-b border-slate-100 bg-white px-6 py-4">
              <h3 className="text-lg font-black text-[#1E2720]">تعديل بيانات الشريك</h3>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-bold text-slate-600">الاسم</span>
                  <input
                    className={FIELD}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-600">الهاتف</span>
                  <input
                    className={FIELD}
                    dir="ltr"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-600">البريد</span>
                  <input
                    className={FIELD}
                    dir="ltr"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </label>
              </div>

              {type === 'leaders' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">
                      اللغات (مفصولة بفاصلة)
                    </span>
                    <input
                      className={FIELD}
                      value={editLanguages}
                      onChange={(e) => setEditLanguages(e.target.value)}
                      placeholder="عربي، إنجليزي"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">سنوات الخبرة</span>
                    <input
                      className={FIELD}
                      type="number"
                      min={0}
                      value={editExperience}
                      onChange={(e) => setEditExperience(e.target.value)}
                    />
                  </label>
                </div>
              ) : null}

              {type === 'leaders' ? (
                <>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">الوجهات</span>
                    <input
                      className={FIELD}
                      value={editDestinations}
                      onChange={(e) => setEditDestinations(e.target.value)}
                      placeholder="كوريا، اليابان…"
                    />
                  </label>
                  <fieldset className="space-y-2">
                    <legend className="text-xs font-bold text-slate-600">
                      المهارات الخاصة
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {LEADER_SPECIAL_SKILL_OPTIONS.map((skill) => {
                        const selected = editSpecialSkills.includes(skill);
                        return (
                          <button
                            key={skill}
                            type="button"
                            aria-pressed={selected}
                            onClick={() =>
                              toggleTagList(
                                editSpecialSkills,
                                skill,
                                setEditSpecialSkills,
                              )
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                              selected
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                : 'border-slate-200 bg-white text-slate-600'
                            }`}
                          >
                            {skill}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <fieldset className="space-y-2">
                    <legend className="text-xs font-bold text-slate-600">
                      أنماط الرحلات المفضلة
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {LEADER_PREFERRED_STYLE_OPTIONS.map((style) => {
                        const selected = editPreferredStyles.includes(style);
                        return (
                          <button
                            key={style}
                            type="button"
                            aria-pressed={selected}
                            onClick={() =>
                              toggleTagList(
                                editPreferredStyles,
                                style,
                                setEditPreferredStyles,
                              )
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                              selected
                                ? 'border-amber-300 bg-amber-50 text-amber-900'
                                : 'border-slate-200 bg-white text-slate-600'
                            }`}
                          >
                            {style}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                </>
              ) : null}

              {type === 'experts' ? (
                <>
                  <fieldset className="space-y-2">
                    <legend className="text-xs font-bold text-slate-600">
                      الوجهات المعتمدة
                    </legend>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {CRM_DESTINATIONS_GUIDE.map((country) => {
                        const selected = splitTags(editSpecialty).includes(
                          country.labelAr,
                        );
                        return (
                          <button
                            key={country.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleEditSpecialty(country.labelAr)}
                            className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                              selected
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300'
                            }`}
                          >
                            {selected ? '✓ ' : ''}
                            {country.labelAr}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <fieldset className="space-y-2">
                    <legend className="text-xs font-bold text-slate-600">
                      أسلوب تصميم المسارات
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {EXPERT_ROUTING_STYLE_OPTIONS.map((style) => {
                        const selected = editRoutingStyles.includes(style);
                        return (
                          <button
                            key={style}
                            type="button"
                            aria-pressed={selected}
                            onClick={() =>
                              toggleTagList(
                                editRoutingStyles,
                                style,
                                setEditRoutingStyles,
                              )
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                              selected
                                ? 'border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#725A2D]'
                                : 'border-slate-200 bg-white text-slate-600'
                            }`}
                          >
                            {style}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <fieldset className="space-y-2">
                    <legend className="text-xs font-bold text-slate-600">
                      نقاط قوة الفعاليات
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {EXPERT_ACTIVITY_STRENGTH_OPTIONS.map((item) => {
                        const selected = editActivityStrengths.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            aria-pressed={selected}
                            onClick={() =>
                              toggleTagList(
                                editActivityStrengths,
                                item,
                                setEditActivityStrengths,
                              )
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                              selected
                                ? 'border-sky-300 bg-sky-50 text-sky-900'
                                : 'border-slate-200 bg-white text-slate-600'
                            }`}
                          >
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                </>
              ) : null}

              {type === 'celebrities' ? (
                <>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">المنصات</span>
                    <input
                      className={FIELD}
                      value={editPlatforms}
                      onChange={(e) => setEditPlatforms(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">تركيز المحتوى</span>
                    <input
                      className={FIELD}
                      value={editContentFocus}
                      onChange={(e) => setEditContentFocus(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">رابط الملف</span>
                    <input
                      className={FIELD}
                      dir="ltr"
                      value={editProfileUrl}
                      onChange={(e) => setEditProfileUrl(e.target.value)}
                    />
                  </label>
                </>
              ) : null}

              {(type === 'leaders' || type === 'experts') ? (
                <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                  <p className="text-xs font-black text-slate-700">بصمة الشريك</p>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">
                      أسلوب إدارة / تصميم الرحلات
                    </span>
                    <textarea
                      className={`${FIELD} min-h-20`}
                      value={editTripStyle}
                      onChange={(e) => setEditTripStyle(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">نقاط القوة</span>
                    <textarea
                      className={`${FIELD} min-h-20`}
                      value={editStrengths}
                      onChange={(e) => setEditStrengths(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">
                      الميزة التنافسية
                    </span>
                    <textarea
                      className={`${FIELD} min-h-20`}
                      value={editCompetitiveAdvantage}
                      onChange={(e) => setEditCompetitiveAdvantage(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-bold text-slate-600">
                      متطلبات من الشركة
                    </span>
                    <textarea
                      className={`${FIELD} min-h-20`}
                      value={editAgencyRequirements}
                      onChange={(e) => setEditAgencyRequirements(e.target.value)}
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex gap-2 sticky bottom-0 -mx-6 -mb-6 border-t border-slate-100 bg-white px-6 py-4">
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={saving || !editName.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1E2720] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                حفظ التعديلات
              </button>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function PartnerProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#B5914F]" />
        </div>
      }
    >
      <PartnerProfileInner />
    </Suspense>
  );
}
