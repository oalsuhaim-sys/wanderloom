"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Handshake, Loader2, Phone, Plus, UserRound } from "lucide-react";

import { CrmSlideOver, CRM_DRAWER_SAVE } from "@/app/crm/_components/CrmSlideOver";
import type {
  CelebrityRecord,
  ExpertRecord,
  LeaderRecord,
} from "@/lib/partner-entities";
import { getClientAccessToken } from "@/lib/crm-session-token";
import {
  CRM_INPUT,
  CRM_PARTNER_AVATAR,
  CRM_PARTNER_CARD,
  partnerInitials,
} from "@/lib/crm-luxury-ui";

type PartnerTab = "leaders" | "experts" | "celebrities";

const TABS: { id: PartnerTab; label: string; badge: string }[] = [
  { id: "leaders", label: "القادة", badge: "🚀 قائد رحلات" },
  { id: "experts", label: "خبراء الوجهات", badge: "🧭 خبير وجهات" },
  { id: "celebrities", label: "المشاهير والمؤثرين", badge: "🌟 مشهور / مؤثر" },
];

function parseTab(raw: string | null): PartnerTab {
  if (raw === "experts" || raw === "celebrities" || raw === "leaders") return raw;
  return "leaders";
}

function statusPillClass(status: string | null) {
  const value = (status ?? "active").toLowerCase();
  if (value === "active" || value === "approved") {
    return "bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold";
  }
  if (value === "inactive") {
    return "bg-gray-50 text-gray-500 px-3 py-1 rounded-full text-xs font-bold";
  }
  if (value === "rejected") {
    return "bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-bold";
  }
  return "bg-yellow-50 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold";
}

function statusLabel(status: string | null) {
  const value = (status ?? "active").toLowerCase();
  if (value === "active" || value === "approved") return "نشط";
  if (value === "pending") return "قيد المراجعة";
  if (value === "rejected") return "مرفوض";
  if (value === "inactive") return "غير نشط";
  return status || "نشط";
}

function isActiveInDirectory(status: string | null) {
  const value = (status ?? "active").toLowerCase();
  return value === "active" || value === "approved";
}

function profileHref(type: PartnerTab, id: string) {
  return `/crm/partners-directory/profile?id=${encodeURIComponent(id)}&type=${type}`;
}

const EMPTY_INFLUENCER_FORM = {
  name: "",
  phone: "",
  platforms: "",
  content_focus: "",
};

export default function PartnersDirectoryClient() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<PartnerTab>(() =>
    parseTab(searchParams.get("tab")),
  );
  const [search, setSearch] = useState("");

  const [leaders, setLeaders] = useState<LeaderRecord[]>([]);
  const [experts, setExperts] = useState<ExpertRecord[]>([]);
  const [celebrities, setCelebrities] = useState<CelebrityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [influencerForm, setInfluencerForm] = useState(EMPTY_INFLUENCER_FORM);
  const [savingInfluencer, setSavingInfluencer] = useState(false);
  const [influencerError, setInfluencerError] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const accessToken = await getClientAccessToken();
      const authenticatedRequest = {
        cache: "no-store" as const,
        headers: { Authorization: `Bearer ${accessToken}` },
      };
      const [leadersRes, expertsRes, celebritiesRes] = await Promise.all([
        fetch("/api/crm/leaders", authenticatedRequest),
        fetch("/api/crm/experts", authenticatedRequest),
        fetch("/api/crm/celebrities", authenticatedRequest),
      ]);

      const [leadersPayload, expertsPayload, celebritiesPayload] = await Promise.all([
        leadersRes.json() as Promise<{ ok?: boolean; rows?: LeaderRecord[]; error?: string }>,
        expertsRes.json() as Promise<{ ok?: boolean; rows?: ExpertRecord[]; error?: string }>,
        celebritiesRes.json() as Promise<{
          ok?: boolean;
          rows?: CelebrityRecord[];
          error?: string;
        }>,
      ]);

      const errors: string[] = [];
      if (!leadersRes.ok || !leadersPayload.ok) {
        errors.push(leadersPayload.error || "تعذر تحميل القادة");
        setLeaders([]);
      } else {
        setLeaders(Array.isArray(leadersPayload.rows) ? leadersPayload.rows : []);
      }
      if (!expertsRes.ok || !expertsPayload.ok) {
        errors.push(expertsPayload.error || "تعذر تحميل الخبراء");
        setExperts([]);
      } else {
        setExperts(Array.isArray(expertsPayload.rows) ? expertsPayload.rows : []);
      }
      if (!celebritiesRes.ok || !celebritiesPayload.ok) {
        errors.push(celebritiesPayload.error || "تعذر تحميل المشاهير");
        setCelebrities([]);
      } else {
        setCelebrities(
          Array.isArray(celebritiesPayload.rows) ? celebritiesPayload.rows : [],
        );
      }
      setError(errors.length ? errors.join(" · ") : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch_failed");
      setLeaders([]);
      setExperts([]);
      setCelebrities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openAddInfluencer = () => {
    setInfluencerForm(EMPTY_INFLUENCER_FORM);
    setInfluencerError(null);
    setDrawerOpen(true);
  };

  const closeAddInfluencer = () => {
    if (savingInfluencer) return;
    setDrawerOpen(false);
    setInfluencerError(null);
  };

  const handleSaveInfluencer = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = influencerForm.name.trim();
    if (!name) {
      setInfluencerError("اسم المؤثر مطلوب.");
      return;
    }

    setSavingInfluencer(true);
    setInfluencerError(null);
    try {
      const res = await fetch("/api/crm/celebrities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: influencerForm.phone.trim() || null,
          platforms: influencerForm.platforms.trim() || null,
          content_focus: influencerForm.content_focus.trim() || null,
        }),
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        row?: CelebrityRecord;
        error?: string;
      };
      if (!res.ok || !payload.ok || !payload.row) {
        throw new Error(payload.error || "تعذر إضافة المؤثر");
      }

      setCelebrities((prev) => [payload.row!, ...prev]);
      setDrawerOpen(false);
      setInfluencerForm(EMPTY_INFLUENCER_FORM);
    } catch (err) {
      setInfluencerError(err instanceof Error ? err.message : "تعذر إضافة المؤثر");
    } finally {
      setSavingInfluencer(false);
    }
  };

  const q = search.trim().toLowerCase();

  const filteredLeaders = useMemo(() => {
    const base = leaders.filter((row) => isActiveInDirectory(row.status));
    if (!q) return base;
    return base.filter((row) =>
      [row.name, row.phone, row.email, row.destinations, row.languages.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [leaders, q]);

  const filteredExperts = useMemo(() => {
    const base = experts.filter((row) => isActiveInDirectory(row.status));
    if (!q) return base;
    return base.filter((row) =>
      [row.name, row.phone, row.email, row.specialtyRegions]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [experts, q]);

  const filteredCelebrities = useMemo(() => {
    const base = celebrities.filter((row) => isActiveInDirectory(row.status));
    if (!q) return base;
    return base.filter((row) =>
      [row.name, row.platforms, row.contentFocus, row.profileUrl, row.phone]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [celebrities, q]);

  const roleBadge = TABS.find((t) => t.id === activeTab)?.badge ?? "";

  return (
    <div className="min-h-full bg-[#F9F9F6] font-sans" dir="rtl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#C5A059]">
            Partners Network
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-extrabold text-[#1A3B2A]">
            <Handshake className="h-8 w-8 text-[#C5A059]" aria-hidden />
            شبكة الشركاء
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            بطاقات تعريف الشركاء النشطين — الطلبات الجديدة تُراجع في رادار الشركاء
          </p>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث في الدليل…"
          className={`${CRM_INPUT} h-11 min-w-[220px]`}
        />
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-colors duration-300 ${
                activeTab === tab.id
                  ? "bg-[#1A3B2A] text-[#C5A059] shadow-sm"
                  : "bg-white text-gray-600 ring-1 ring-gray-100 hover:bg-white hover:text-[#1A3B2A]"
              }`}
            >
              {tab.badge}
            </button>
          ))}
        </div>

        {activeTab === "celebrities" ? (
          <button
            type="button"
            onClick={openAddInfluencer}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1A3B2A] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#152e21]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            إضافة مؤثر جديد +
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-900">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center p-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#C5A059]" />
        </div>
      ) : activeTab === "leaders" ? (
        filteredLeaders.length === 0 ? (
          <EmptyState message="لا يوجد قادة نشطون بعد." hint="اقبل طلبات من رادار الشركاء." />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredLeaders.map((row) => (
              <PartnerCard
                key={row.id}
                name={row.name}
                roleBadge={roleBadge}
                phone={row.phone}
                status={row.status}
                subtitle={
                  row.languages.length > 0
                    ? row.languages.join(" · ")
                    : row.destinations || undefined
                }
                href={profileHref("leaders", row.id)}
              />
            ))}
          </div>
        )
      ) : activeTab === "experts" ? (
        filteredExperts.length === 0 ? (
          <EmptyState message="لا يوجد خبراء نشطون بعد." hint="اقبل طلبات من رادار الشركاء." />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredExperts.map((row) => (
              <PartnerCard
                key={row.id}
                name={row.name}
                roleBadge={roleBadge}
                phone={row.phone}
                status={row.status}
                subtitle={row.specialtyRegions || undefined}
                href={profileHref("experts", row.id)}
              />
            ))}
          </div>
        )
      ) : filteredCelebrities.length === 0 ? (
        <EmptyState
          message="لا يوجد مشاهير أو مؤثرون بعد."
          hint="أضف مؤثراً يدوياً عبر زر «إضافة مؤثر جديد»."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCelebrities.map((row) => (
            <PartnerCard
              key={row.id}
              name={row.name}
              roleBadge={roleBadge}
              phone={row.phone}
              status={row.status}
              subtitle={row.platforms || row.contentFocus || undefined}
              href={profileHref("celebrities", row.id)}
            />
          ))}
        </div>
      )}

      <CrmSlideOver
        open={drawerOpen}
        onClose={closeAddInfluencer}
        busy={savingInfluencer}
        title="إضافة مؤثر جديد"
        subtitle="يُحفظ مباشرة بحالة نشط — بدون رادار."
        labelledBy="add-influencer-title"
        footer={
          <div className="flex gap-2">
            <button
              type="submit"
              form="add-influencer-form"
              disabled={savingInfluencer}
              className={CRM_DRAWER_SAVE}
            >
              {savingInfluencer ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  جاري الحفظ…
                </span>
              ) : (
                "حفظ المؤثر"
              )}
            </button>
            <button
              type="button"
              onClick={closeAddInfluencer}
              disabled={savingInfluencer}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
            >
              إلغاء
            </button>
          </div>
        }
      >
        <form
          id="add-influencer-form"
          onSubmit={(e) => void handleSaveInfluencer(e)}
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#1A3B2A]/80">
              اسم المؤثر *
            </span>
            <input
              value={influencerForm.name}
              onChange={(e) =>
                setInfluencerForm((f) => ({ ...f, name: e.target.value }))
              }
              required
              className={CRM_INPUT}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#1A3B2A]/80">
              رقم التواصل
            </span>
            <input
              value={influencerForm.phone}
              onChange={(e) =>
                setInfluencerForm((f) => ({ ...f, phone: e.target.value }))
              }
              className={CRM_INPUT}
              dir="ltr"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#1A3B2A]/80">المنصات</span>
            <input
              value={influencerForm.platforms}
              onChange={(e) =>
                setInfluencerForm((f) => ({ ...f, platforms: e.target.value }))
              }
              className={CRM_INPUT}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#1A3B2A]/80">
              نوع المحتوى
            </span>
            <input
              value={influencerForm.content_focus}
              onChange={(e) =>
                setInfluencerForm((f) => ({ ...f, content_focus: e.target.value }))
              }
              className={CRM_INPUT}
            />
          </label>

          {influencerError ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800">
              {influencerError}
            </p>
          ) : null}
        </form>
      </CrmSlideOver>
    </div>
  );
}

function PartnerCard({
  name,
  roleBadge,
  phone,
  status,
  subtitle,
  href,
}: {
  name: string;
  roleBadge: string;
  phone: string | null;
  status: string | null;
  subtitle?: string;
  href: string;
}) {
  return (
    <article className={CRM_PARTNER_CARD}>
      <div className="flex items-start gap-4">
        <div className={CRM_PARTNER_AVATAR} aria-hidden>
          {partnerInitials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="truncate text-lg font-extrabold text-[#1A3B2A]">{name}</h2>
            <span className={`shrink-0 ${statusPillClass(status)}`}>{statusLabel(status)}</span>
          </div>
          <span className="mt-2 inline-flex rounded-full border border-[#C5A059]/25 bg-[#F9F9F6] px-2.5 py-1 text-[10px] font-black text-[#1A3B2A]">
            {roleBadge}
          </span>
        </div>
      </div>

      {subtitle ? (
        <p className="mt-4 line-clamp-2 text-xs font-semibold text-[#C5A059]">{subtitle}</p>
      ) : null}

      <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
        <Phone className="h-4 w-4 shrink-0 text-[#C5A059]" aria-hidden />
        <span dir="ltr" className="truncate font-medium text-[#1A3B2A]">
          {phone || "—"}
        </span>
      </div>

      <div className="mt-auto pt-5">
        <Link
          href={href}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1A3B2A] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#152e21]"
        >
          <UserRound className="h-3.5 w-3.5 text-[#C5A059]" aria-hidden />
          إدارة الملف
        </Link>
      </div>
    </article>
  );
}

function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
      <p className="font-bold text-[#1A3B2A]">{message}</p>
      {hint ? <p className="mt-2 text-sm text-gray-500">{hint}</p> : null}
    </div>
  );
}
