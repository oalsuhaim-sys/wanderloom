'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  Compass,
  Copy,
  Crown,
  Languages,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plane,
  Sparkles,
  Star,
  Trash2,
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
import { getClientAccessToken } from '@/lib/crm-session-token';
import { useCountries } from '@/hooks/useCountries';
import {
  CRM_BTN_PRIMARY,
  CRM_INPUT,
  partnerInitials,
} from '@/lib/crm-luxury-ui';
import { LeaderAvailability } from '@/components/LeaderAvailability';
import { SmartWallet } from '@/components/SmartWallet';
import {
  ExpertAssignmentsPanel,
  type ExpertAssignedQuotation,
} from '@/components/ExpertAssignmentsPanel';
import EditExpertModal from '@/app/crm/partners-directory/_components/EditExpertModal';
import EditLeaderModal from '@/app/crm/partners-directory/_components/EditLeaderModal';
import {
  DEFAULT_PARTNER_COMMISSION_RATE,
  resolveCommissionRate,
} from '@/lib/partner-commission';

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
  referralCode: string | null;
  commissionRate: number;
  dna: PartnerDnaProfile;
};

type MatchingGroupTrip = {
  id: string;
  title: string;
  destination: string | null;
  dates: string | null;
  assignedExpertId: string | null;
  source?: 'group_trip' | 'itinerary';
};

const FIELD = CRM_INPUT;

const CARD =
  'mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]';

const CARD_TITLE =
  'mb-4 border-b border-slate-100 pb-3 text-lg font-bold text-slate-800 dark:border-[#2D3F3A] dark:text-gray-100';

const TAG =
  'rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700 dark:border-[#D4AF37]/30 dark:bg-[#1A2421] dark:text-[#D4AF37]';

const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white shadow-sm transition-all hover:bg-slate-800 dark:border dark:border-[#D4AF37]/50 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37] hover:dark:bg-[#D4AF37]/30';

const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-200 dark:hover:bg-[#2A3834]';

const KV_LABEL = 'text-sm text-slate-500 dark:text-slate-400';
const KV_VALUE = 'text-base font-medium text-slate-900 dark:text-white';

const CHIP_IDLE =
  'rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300';
const CHIP_ACTIVE =
  'rounded-full border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition dark:border-[#D4AF37]/50 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]';

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

function sanitizeReferralCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9_-]/g, '');
}

function PartnerProfileInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { countries: destinationCountries } = useCountries();
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
  const [commissionOpen, setCommissionOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditingReferral, setIsEditingReferral] = useState(false);
  const [customReferralCode, setCustomReferralCode] = useState('');

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
  const [editReferralCode, setEditReferralCode] = useState('');
  const [editCommissionRate, setEditCommissionRate] = useState(
    DEFAULT_PARTNER_COMMISSION_RATE,
  );
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
        referralCode:
          row.referralCode != null
            ? String(row.referralCode)
            : row.referral_code != null
              ? String(row.referral_code)
              : null,
        commissionRate: resolveCommissionRate(
          row.commissionRate ?? row.commission_rate,
        ),
        dna,
      };

      setProfile(next);
      setCustomReferralCode(next.referralCode ?? '');
      setIsEditingReferral(false);
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
    setEditReferralCode(profile.referralCode ?? '');
    setEditCommissionRate(resolveCommissionRate(profile.commissionRate));
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
        body.referral_code = editReferralCode.trim() || null;
        body.commission_rate = resolveCommissionRate(editCommissionRate);
      } else if (type === 'experts') {
        body.specialtyRegions = editSpecialty.trim();
        body.specialty_regions = editSpecialty.trim();
        body.referral_code = editReferralCode.trim() || null;
        body.commission_rate = resolveCommissionRate(editCommissionRate);
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

  const handleCopyReferralCode = async () => {
    const code = String(profile?.referralCode ?? '').trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success('تم نسخ الكود!');
    } catch {
      toast.error('تعذر نسخ كود الإحالة');
    }
  };

  const openReferralEditor = () => {
    setCustomReferralCode(profile?.referralCode ?? '');
    setIsEditingReferral(true);
  };

  const cancelReferralEditor = () => {
    setCustomReferralCode(profile?.referralCode ?? '');
    setIsEditingReferral(false);
  };

  const handleSaveCustomCode = async () => {
    if (!apiBase || !type || (type !== 'leaders' && type !== 'experts')) return;
    const cleanCode = sanitizeReferralCode(customReferralCode);
    if (!cleanCode) {
      toast.error('يرجى إدخال كود إحالة صالح');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiBase, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referral_code: cleanCode,
          commission_rate: resolveCommissionRate(
            profile?.commissionRate ?? DEFAULT_PARTNER_COMMISSION_RATE,
          ),
        }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        error?: string;
        leader?: { referralCode?: string | null; commissionRate?: number };
        expert?: { referralCode?: string | null; commissionRate?: number };
      };
      if (!res.ok || !payload.ok) {
        throw new Error(
          payload.error || 'الكود مستخدم بالفعل أو حدث خطأ أثناء الحفظ',
        );
      }

      const updated =
        type === 'leaders'
          ? payload.leader
          : type === 'experts'
            ? payload.expert
            : null;
      const nextCode =
        String(updated?.referralCode ?? cleanCode).trim() || cleanCode;
      const nextRate = resolveCommissionRate(
        updated?.commissionRate ??
          profile?.commissionRate ??
          DEFAULT_PARTNER_COMMISSION_RATE,
      );

      setProfile((current) =>
        current
          ? { ...current, referralCode: nextCode, commissionRate: nextRate }
          : current,
      );
      setCustomReferralCode(nextCode);
      setIsEditingReferral(false);
      toast.success('تم تحديث كود الإحالة بنجاح!');
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'الكود مستخدم بالفعل أو حدث خطأ أثناء الحفظ',
      );
    } finally {
      setSaving(false);
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
      <div className="flex min-h-[40vh] items-center justify-center gap-2 bg-[#F9FAFB] text-sm font-medium text-slate-500 dark:bg-[#1A2421] dark:text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400 dark:text-[#D4AF37]" />
        جاري تحميل الملف…
      </div>
    );
  }

  if (!profile || !type) {
    return (
      <div
        className="mx-auto min-h-[40vh] max-w-lg bg-[#F9FAFB] p-8 text-center dark:bg-[#1A2421]"
        dir="rtl"
      >
        <p className="font-bold text-rose-700 dark:text-rose-400">
          {error || 'غير موجود'}
        </p>
        <Link
          href="/crm/partners-directory"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-[#D4AF37]"
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
  const headerTags =
    approvedDestinations.length > 0
      ? approvedDestinations
      : type === 'celebrities'
        ? splitTags(profile.platforms || profile.contentFocus)
        : type === 'leaders'
          ? profile.languages
          : [];
  const dnaEntries = partnerDnaDisplayEntries(profile.dna);
  const statusText =
    profile.status === 'active' || profile.status === 'approved'
      ? 'نشط'
      : profile.status || '—';

  return (
    <div
      className="min-h-full bg-[#F9FAFB] p-4 font-sans dark:bg-[#1A2421] sm:p-6 lg:p-8"
      dir="rtl"
    >
      <Link
        href={`/crm/partners-directory?tab=${type}`}
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-gray-300 dark:hover:text-[#D4AF37]"
      >
        <ArrowRight className="h-4 w-4" />
        دليل الشركاء
      </Link>

      {notice ? (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      {/* VIP Cover + Profile Header */}
      <div className="mb-6 overflow-hidden rounded-2xl">
        <div className="relative h-48 w-full rounded-t-2xl bg-gradient-to-r from-slate-900 to-slate-800 dark:from-[#22302C] dark:to-[#1A2421]">
          <div className="absolute left-6 top-6 flex flex-wrap gap-2 sm:left-8">
            <button type="button" onClick={openEdit} className={BTN_PRIMARY}>
              <Pencil className="h-4 w-4" />
              تعديل الملف
            </button>
            {type === 'leaders' ? (
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    try {
                      const accessToken = await getClientAccessToken();
                      const res = await fetch('/api/crm/leaders/calendar-link', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${accessToken}`,
                        },
                        body: JSON.stringify({ leader_id: profile.id }),
                      });
                      const payload = (await res.json()) as {
                        ok?: boolean;
                        url?: string;
                        error?: string;
                      };
                      if (!res.ok || !payload.ok || !payload.url) {
                        throw new Error(payload.error || 'تعذر إنشاء الرابط');
                      }
                      await navigator.clipboard.writeText(payload.url);
                      toast.success('تم نسخ رابط التفرغ 🔗');
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : 'تعذر نسخ الرابط',
                      );
                    }
                  })();
                }}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white/90 transition hover:bg-white/20"
              >
                <Link2 className="h-3.5 w-3.5" />
                نسخ رابط التفرغ
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/90 transition hover:bg-rose-500/20 hover:text-rose-200 disabled:opacity-50"
              aria-label="حذف الشريك"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="absolute -bottom-12 right-6 sm:right-8">
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#F9FAFB] bg-white text-2xl font-bold text-slate-800 shadow-lg dark:border-[#1A2421] dark:bg-[#22302C] dark:text-[#D4AF37]"
              aria-hidden
            >
              {partnerInitials(profile.name)}
            </div>
          </div>
        </div>

        <div className="rounded-b-2xl border-x border-b border-slate-200 bg-white px-6 pb-6 pt-16 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {profile.name}
              </h1>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 dark:text-slate-400">
                <span>{roleLabel}</span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span
                  className={
                    statusText === 'نشط'
                      ? 'font-medium text-emerald-600 dark:text-emerald-400'
                      : undefined
                  }
                >
                  {statusText}
                </span>
                {profile.phone ? (
                  <>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="inline-flex items-center gap-1.5" dir="ltr">
                      <Phone className="h-3.5 w-3.5" />
                      {profile.phone}
                    </span>
                  </>
                ) : null}
                {profile.email ? (
                  <>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="inline-flex items-center gap-1.5" dir="ltr">
                      <Mail className="h-3.5 w-3.5" />
                      {profile.email}
                    </span>
                  </>
                ) : null}
              </p>

              {headerTags.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {headerTags.map((tag) => (
                    <span key={tag} className={TAG}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-0 lg:flex-row lg:gap-6">
        <main className="min-w-0 flex-1">
          {type === 'leaders' ? <LeaderAvailability leaderId={profile.id} /> : null}

          {type === 'leaders' || type === 'experts' ? (
            <div className="mb-6 space-y-3">
              <SmartWallet
                partnerId={profile.id}
                partnerType={type === 'leaders' ? 'leader' : 'expert'}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]">
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-gray-100">
                    نسبة العمولة من هامش الربح
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">
                    {resolveCommissionRate(profile.commissionRate)}% · الافتراضي{' '}
                    {DEFAULT_PARTNER_COMMISSION_RATE}%
                    {profile.referralCode ? ` · كود: ${profile.referralCode}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCommissionOpen(true)}
                  className={BTN_SECONDARY}
                >
                  <CircleDollarSign className="h-4 w-4 text-[#D4AF37]" aria-hidden />
                  تعديل العمولة
                </button>
              </div>
            </div>
          ) : null}

          {type === 'leaders' || type === 'celebrities' ? (
            <section className={CARD}>
              <h2 className={CARD_TITLE}>تفاصيل الشريك</h2>
              <div className="grid gap-6 sm:grid-cols-2">
                {type === 'leaders' ? (
                  <>
                    <div>
                      <p className={`mb-2 inline-flex items-center gap-2 ${KV_LABEL}`}>
                        <Languages className="h-4 w-4" />
                        اللغات
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {profile.languages.length ? (
                          profile.languages.map((language) => (
                            <span key={language} className={TAG}>
                              {language}
                            </span>
                          ))
                        ) : (
                          <span className={KV_VALUE}>—</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className={`mb-1 ${KV_LABEL}`}>سنوات الخبرة</p>
                      <p className={KV_VALUE}>
                        {profile.experienceYears != null
                          ? `${profile.experienceYears} سنوات`
                          : '—'}
                      </p>
                    </div>
                  </>
                ) : null}
                {type === 'celebrities' ? (
                  <>
                    <div>
                      <p className={`mb-1 ${KV_LABEL}`}>المنصات</p>
                      <p className={KV_VALUE}>{profile.platforms || '—'}</p>
                    </div>
                    <div>
                      <p className={`mb-1 ${KV_LABEL}`}>تركيز المحتوى</p>
                      <p className={KV_VALUE}>{profile.contentFocus || '—'}</p>
                    </div>
                    {profile.profileUrl ? (
                      <div className="sm:col-span-2">
                        <p className={`mb-1 ${KV_LABEL}`}>رابط الملف</p>
                        <a
                          href={profile.profileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`${KV_VALUE} break-all text-[#D4AF37] hover:underline`}
                          dir="ltr"
                        >
                          {profile.profileUrl}
                        </a>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className={CARD}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-[#2D3F3A]">
              <div>
                <h2 className="inline-flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-gray-100">
                  <Sparkles className="h-5 w-5 text-slate-400 dark:text-[#D4AF37]" />
                  بصمة الشريك
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  أسلوب العمل والتخصص والميزة التنافسية
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopyDna()}
                  className={BTN_SECONDARY}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied
                    ? 'تم النسخ'
                    : isPartnerDnaRawFilled(profile.dna)
                      ? 'نسخ الرابط مجدداً'
                      : 'نسخ رابط تعبئة البصمة'}
                </button>
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className={BTN_PRIMARY}
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
                  <div
                    key={entry.key}
                    className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-[#2D3F3A] dark:bg-[#1A2421]/60"
                  >
                    <strong className={KV_LABEL}>{entry.label}</strong>
                    {Array.isArray(entry.value) ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {entry.value.map((value) => (
                          <span key={value} className={TAG}>
                            {value}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className={`mt-2 whitespace-pre-wrap leading-7 ${KV_VALUE}`}>
                        {entry.value}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-5 text-center dark:border-[#2D3F3A] dark:bg-[#1A2421]/40">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  لم تُعبَّأ البصمة بعد
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  انسخ الرابط أو أرسله مباشرة عبر واتساب ليحدد أسلوبه ووجهاته ونقاط قوته.
                </p>
                {dnaLink ? (
                  <p
                    className="mt-3 break-all rounded-lg border border-slate-100 bg-white px-3 py-2 text-[10px] text-slate-500 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-slate-400"
                    dir="ltr"
                  >
                    {dnaLink}
                  </p>
                ) : null}
              </div>
            )}
          </section>

          {type === 'experts' ? (
            <section className={CARD}>
              <div className="mb-4 border-b border-slate-100 pb-3 dark:border-[#2D3F3A]">
                <h2 className="inline-flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-gray-100">
                  <Compass className="h-5 w-5 text-slate-400 dark:text-[#D4AF37]" />
                  الرحلات الجماعية المتوافقة
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  مطابقة ذكية بين وجهات بصمة الخبير والرحلات الجماعية النشطة
                </p>
              </div>
              {matchingGroupTrips.length ? (
                <div className="flex flex-col gap-3">
                  {matchingGroupTrips.map((trip) => {
                    const isCatalogue = trip.source === 'group_trip';
                    const assignedToCurrentExpert =
                      !isCatalogue && trip.assignedExpertId === profile.id;
                    const assignedElsewhere =
                      !isCatalogue &&
                      Boolean(trip.assignedExpertId) &&
                      !assignedToCurrentExpert;
                    const detailsHref = isCatalogue
                      ? `/crm/groups/${encodeURIComponent(trip.id)}`
                      : `/crm/itineraries/${encodeURIComponent(trip.id)}/edit`;

                    return (
                      <article
                        key={`${trip.source ?? 'trip'}-${trip.id}`}
                        className="mb-0 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-[#2D3F3A] dark:bg-[#22302C]"
                      >
                        <div className="flex min-w-0 flex-col gap-1">
                          <Link
                            href={detailsHref}
                            className="truncate text-sm font-bold text-slate-900 transition hover:text-slate-700 dark:text-white dark:hover:text-[#D4AF37]"
                          >
                            {trip.title}
                          </Link>
                          <p className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span className="truncate">
                              {trip.destination || 'وجهة غير محددة'}
                            </span>
                          </p>
                          {trip.dates ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {trip.dates}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          {isCatalogue ? (
                            <Link
                              href={detailsHref}
                              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-transform hover:-translate-y-0.5 dark:border dark:border-[#D4AF37]/50 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]"
                            >
                              التفاصيل
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleAssignExpert(trip.id)}
                              disabled={
                                assigningTripId === trip.id ||
                                assignedToCurrentExpert
                              }
                              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 dark:border dark:border-[#D4AF37]/50 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]"
                            >
                              {assigningTripId === trip.id ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  جاري التعيين…
                                </span>
                              ) : assignedToCurrentExpert ? (
                                'مكلّف بهذه الرحلة'
                              ) : assignedElsewhere ? (
                                'إعادة تكليف لهذا الخبير'
                              ) : (
                                'تعيين الخبير'
                              )}
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-slate-50 p-8 text-center dark:border-[#2D3F3A] dark:bg-[#1A2421]/50">
                  <Compass
                    className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600"
                    aria-hidden
                  />
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    لا توجد رحلات جماعية نشطة متوافقة مع وجهات الخبير حالياً.
                  </p>
                </div>
              )}
            </section>
          ) : null}

          {type === 'experts' ? (
            <section className={CARD}>
              <ExpertAssignmentsPanel
                itineraries={itineraries}
                quotations={quotations}
              />
            </section>
          ) : null}
        </main>

        <aside className="lg:w-80 lg:shrink-0">
          <div className="space-y-0 lg:sticky lg:top-6">
            <section className={CARD}>
              <h2 className={CARD_TITLE}>إحصائيات سريعة</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 dark:border-[#2D3F3A] dark:bg-[#1A2421]/60">
                  <span className={`inline-flex items-center gap-2 ${KV_LABEL}`}>
                    <CircleDollarSign className="h-4 w-4" />
                    إجمالي العمولات
                  </span>
                  <span className={KV_VALUE} dir="ltr">
                    0 ر.س
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 dark:border-[#2D3F3A] dark:bg-[#1A2421]/60">
                  <span className={`inline-flex items-center gap-2 ${KV_LABEL}`}>
                    <Star className="h-4 w-4" />
                    تقييم الشريك
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-800 dark:border-[#D4AF37]/30 dark:bg-[#1A2421] dark:text-[#D4AF37]">
                    <Crown className="h-3 w-3" />
                    VIP
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 dark:border-[#2D3F3A] dark:bg-[#1A2421]/60">
                  <span className={`inline-flex items-center gap-2 ${KV_LABEL}`}>
                    <Plane className="h-4 w-4" />
                    الرحلات المستلمة
                  </span>
                  <span className={KV_VALUE}>{itineraries.length}</span>
                </div>
              </div>
            </section>

            {(type === 'leaders' || type === 'experts') ? (
              <section className="mb-6 space-y-2 rounded-2xl border border-slate-200/80 bg-white p-3.5 text-right shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      isEditingReferral ? cancelReferralEditor() : openReferralEditor()
                    }
                    className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-bold text-slate-400 transition-all hover:text-amber-600"
                  >
                    <span>✏️</span>
                    <span>{isEditingReferral ? 'إلغاء' : 'تعديل الكود'}</span>
                  </button>

                  <h4 className="inline-flex items-center gap-1 text-xs font-extrabold text-slate-800">
                    <span>🎁</span>
                    <span>كود الإحالة الخاص بك</span>
                  </h4>
                </div>

                {isEditingReferral ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-1.5" dir="ltr">
                      <input
                        type="text"
                        value={customReferralCode}
                        onChange={(e) => setCustomReferralCode(e.target.value)}
                        placeholder="أدخل الكود الخاص بك"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-center font-mono text-xs font-bold uppercase text-slate-900 outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSaveCustomCode()}
                        disabled={saving}
                        className="flex-shrink-0 cursor-pointer rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {saving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        ) : (
                          'حفظ'
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {profile.referralCode ? (
                      <div
                        className="flex items-center justify-between rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2 font-mono text-xs font-bold text-amber-950"
                        dir="ltr"
                      >
                        <button
                          type="button"
                          onClick={() => void handleCopyReferralCode()}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1 font-sans text-[11px] font-bold text-white shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-all hover:bg-amber-600"
                        >
                          <span>📋</span>
                          <span>نسخ</span>
                        </button>
                        <span className="tracking-wide text-xs">
                          {profile.referralCode}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={openReferralEditor}
                        className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-xl bg-amber-500 py-2 text-xs font-bold text-white transition-all hover:bg-amber-600"
                      >
                        <span>➕</span>
                        <span>إضافة كود إحالة</span>
                      </button>
                    )}

                    <p className="text-center text-[10px] font-medium text-slate-400">
                      احصل على {resolveCommissionRate(profile.commissionRate)}% عمولة من
                      الفائدة لكل حجز عبر هذا الكود
                    </p>
                  </div>
                )}
              </section>
            ) : null}

            <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 p-6 text-white shadow-sm dark:border-[#D4AF37]/30 dark:bg-[#22302C]">
              <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/50 dark:text-[#D4AF37]/80">
                Partner Status
              </p>
              <h3 className="mt-2 text-lg font-semibold dark:text-gray-100">
                {roleLabel}
              </h3>
              <p className="mt-2 text-xs font-medium leading-6 text-white/60 dark:text-gray-300">
                {approvedDestinations.length} وجهات معتمدة ·{' '}
                {dnaEntries.length ? 'البصمة مكتملة' : 'بانتظار البصمة'}
              </p>
            </section>
          </div>
        </aside>
      </div>

      {editOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden dark:bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="partner-edit-title"
          onClick={() => setEditOpen(false)}
        >
          <div
            className="relative my-auto flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-[#2D3F3A] dark:bg-[#1A2421]"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-6 py-4 dark:border-[#2D3F3A] dark:bg-[#1A2421]">
              <h3
                id="partner-edit-title"
                className="text-lg font-semibold text-slate-900 dark:text-gray-100"
              >
                تعديل بيانات الشريك
              </h3>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-[#22302C]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className={KV_LABEL}>الاسم</span>
                  <input
                    className={FIELD}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className={KV_LABEL}>الهاتف</span>
                  <input
                    className={FIELD}
                    dir="ltr"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className={KV_LABEL}>البريد</span>
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
                    <span className={KV_LABEL}>اللغات (مفصولة بفاصلة)</span>
                    <input
                      className={FIELD}
                      value={editLanguages}
                      onChange={(e) => setEditLanguages(e.target.value)}
                      placeholder="عربي، إنجليزي"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className={KV_LABEL}>سنوات الخبرة</span>
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
                    <span className={KV_LABEL}>الوجهات</span>
                    <input
                      className={FIELD}
                      value={editDestinations}
                      onChange={(e) => setEditDestinations(e.target.value)}
                      placeholder="كوريا، اليابان…"
                    />
                  </label>
                  <fieldset className="space-y-2">
                    <legend className={KV_LABEL}>المهارات الخاصة</legend>
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
                            className={selected ? CHIP_ACTIVE : CHIP_IDLE}
                          >
                            {skill}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <fieldset className="space-y-2">
                    <legend className={KV_LABEL}>أنماط الرحلات المفضلة</legend>
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
                            className={selected ? CHIP_ACTIVE : CHIP_IDLE}
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
                    <legend className={KV_LABEL}>الوجهات المعتمدة</legend>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                      {destinationCountries.map((country) => {
                        const selected = splitTags(editSpecialty).includes(
                          country.name,
                        );
                        return (
                          <button
                            key={country.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleEditSpecialty(country.name)}
                            className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                              selected
                                ? 'border-slate-900 bg-slate-900 text-white dark:border-[#D4AF37]/50 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300'
                            }`}
                          >
                            {selected ? '✓ ' : ''}
                            {country.flag ? `${country.flag} ` : ''}
                            {country.name}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <fieldset className="space-y-2">
                    <legend className={KV_LABEL}>أسلوب تصميم المسارات</legend>
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
                            className={selected ? CHIP_ACTIVE : CHIP_IDLE}
                          >
                            {style}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <fieldset className="space-y-2">
                    <legend className={KV_LABEL}>نقاط قوة الفعاليات</legend>
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
                            className={selected ? CHIP_ACTIVE : CHIP_IDLE}
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
                    <span className={KV_LABEL}>المنصات</span>
                    <input
                      className={FIELD}
                      value={editPlatforms}
                      onChange={(e) => setEditPlatforms(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className={KV_LABEL}>تركيز المحتوى</span>
                    <input
                      className={FIELD}
                      value={editContentFocus}
                      onChange={(e) => setEditContentFocus(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className={KV_LABEL}>رابط الملف</span>
                    <input
                      className={FIELD}
                      dir="ltr"
                      value={editProfileUrl}
                      onChange={(e) => setEditProfileUrl(e.target.value)}
                    />
                  </label>
                </>
              ) : null}

              {type === 'leaders' || type === 'experts' ? (
                <div className="space-y-4 rounded-2xl border border-amber-100 bg-amber-50/50 p-4 dark:border-[#D4AF37]/25 dark:bg-[#D4AF37]/5">
                  <p className="text-sm font-bold text-slate-800 dark:text-gray-100">
                    العمولة والإحالة
                  </p>
                  <div className="space-y-1 text-right">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
                      كود الإحالة{' '}
                      <span className="font-normal text-slate-400">(اختياري)</span>
                    </label>
                    <input
                      type="text"
                      value={editReferralCode}
                      onChange={(e) => setEditReferralCode(e.target.value)}
                      className={`${FIELD} text-left`}
                      dir="ltr"
                      placeholder="REF-CODE"
                    />
                  </div>
                  <div className="space-y-1 text-right">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400">
                      نسبة العمولة (من الفائدة/الربح)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={editCommissionRate}
                        onChange={(e) =>
                          setEditCommissionRate(Number(e.target.value))
                        }
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-right text-sm font-bold text-slate-800 outline-none transition focus:border-amber-500 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-100"
                        dir="rtl"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        % من الفائدة
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500">
                      الافتراضي {DEFAULT_PARTNER_COMMISSION_RATE}% من هامش الربح (السعر −
                      التكلفة)
                    </p>
                  </div>
                </div>
              ) : null}

              {type === 'leaders' || type === 'experts' ? (
                <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-[#2D3F3A] dark:bg-[#1A2421]/50">
                  <p className="text-sm font-bold text-slate-800 dark:text-gray-100">
                    بصمة الشريك
                  </p>
                  <label className="block space-y-1.5">
                    <span className={KV_LABEL}>أسلوب إدارة / تصميم الرحلات</span>
                    <textarea
                      className={`${FIELD} min-h-20`}
                      value={editTripStyle}
                      onChange={(e) => setEditTripStyle(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className={KV_LABEL}>نقاط القوة</span>
                    <textarea
                      className={`${FIELD} min-h-20`}
                      value={editStrengths}
                      onChange={(e) => setEditStrengths(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className={KV_LABEL}>الميزة التنافسية</span>
                    <textarea
                      className={`${FIELD} min-h-20`}
                      value={editCompetitiveAdvantage}
                      onChange={(e) => setEditCompetitiveAdvantage(e.target.value)}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className={KV_LABEL}>متطلبات من الشركة</span>
                    <textarea
                      className={`${FIELD} min-h-20`}
                      value={editAgencyRequirements}
                      onChange={(e) => setEditAgencyRequirements(e.target.value)}
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="sticky bottom-0 flex shrink-0 gap-2 border-t border-slate-100 bg-white px-6 py-4 dark:border-[#2D3F3A] dark:bg-[#1A2421]">
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={saving || !editName.trim()}
                className={`${CRM_BTN_PRIMARY} flex-1 disabled:opacity-60`}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                حفظ التعديلات
              </button>
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className={BTN_SECONDARY}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {type === 'experts' && apiBase ? (
        <EditExpertModal
          open={commissionOpen}
          profile={profile}
          apiBase={apiBase}
          onClose={() => setCommissionOpen(false)}
          onSaved={() => void load()}
        />
      ) : null}

      {type === 'leaders' && apiBase ? (
        <EditLeaderModal
          open={commissionOpen}
          profile={profile}
          apiBase={apiBase}
          onClose={() => setCommissionOpen(false)}
          onSaved={() => void load()}
        />
      ) : null}
    </div>
  );
}

export default function PartnerProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400 dark:text-[#D4AF37]" />
        </div>
      }
    >
      <PartnerProfileInner />
    </Suspense>
  );
}
