"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Compass,
  Handshake,
  Loader2,
  Radar,
  Rocket,
  UserRound,
  X,
} from "lucide-react";

import {
  ExpertAssignmentsPanel,
  type ExpertAssignedItinerary,
  type ExpertAssignedQuotation,
} from "@/components/ExpertAssignmentsPanel";
import { toast } from "@/lib/crm-toast";
import type { PartnerApplication } from "@/lib/partners";
import { PARTNER_KIND_EMOJI, PARTNER_KIND_LABELS, partnerKindLabel } from "@/lib/partners";

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type ExpertAssignments = {
  itineraries: ExpertAssignedItinerary[];
  quotations: ExpertAssignedQuotation[];
};

const FILTER_PILL_ACTIVE =
  "rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-4 py-2 text-xs font-bold text-[#b8952d] shadow-sm transition-colors";

const FILTER_PILL_INACTIVE =
  "rounded-xl border border-slate-200/80 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200";

function isExpertEntityId(value: string | number): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value),
  );
}

function partnerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "؟";
  if (parts.length === 1) return parts[0]!.slice(0, 1);
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`;
}

function statusBadgeClass(status: string): string {
  if (status === "pending") {
    return "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-900/50";
  }
  if (status === "approved") {
    return "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-900/50";
  }
  return "bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-900/50";
}

function statusLabel(status: string): string {
  if (status === "pending") return "قيد المراجعة";
  if (status === "approved") return "مقبول";
  return "مرفوض";
}

function RoleIcon({
  kind,
  className = "h-5 w-5",
}: {
  kind: PartnerApplication["partner_kind"];
  className?: string;
}) {
  if (kind === "leader") return <Rocket className={className} aria-hidden />;
  if (kind === "expert") return <Compass className={className} aria-hidden />;
  return <UserRound className={className} aria-hidden />;
}

function PartnerRadarCard({
  app,
  actingId,
  expanded,
  detailsOpen,
  loadingExpert,
  expertError,
  expertData,
  onToggleDetails,
  onToggleExpert,
  onApprove,
  onReject,
}: {
  app: PartnerApplication;
  actingId: string | number | null;
  expanded: boolean;
  detailsOpen: boolean;
  loadingExpert: boolean;
  expertError?: string;
  expertData?: ExpertAssignments;
  onToggleDetails: () => void;
  onToggleExpert: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const busy = actingId === app.id;
  const canShowExpert = app.partner_kind === "expert" && isExpertEntityId(app.id);

  return (
    <article className="mb-4 flex w-full flex-col flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-[#2D3F3A] dark:bg-[#22302C] md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-[#D4AF37]"
          aria-hidden
        >
          {app.name?.trim() ? (
            <span className="text-sm font-bold">{partnerInitials(app.name)}</span>
          ) : (
            <RoleIcon kind={app.partner_kind} />
          )}
        </div>

        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-slate-900 dark:text-gray-100">
            {app.name}
          </h2>
          <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400" dir="ltr">
            {[app.phone, app.email].filter(Boolean).join(" · ") || "—"}
          </p>
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <RoleIcon kind={app.partner_kind} className="h-3.5 w-3.5" />
            {partnerKindLabel(app.partner_kind)}
          </span>
        </div>
      </div>

      <span
        className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(app.status)}`}
      >
        {statusLabel(app.status)}
      </span>

      <div className="mt-4 flex w-full items-center gap-2 md:mt-0 md:w-auto">
        <button
          type="button"
          onClick={onToggleDetails}
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:border dark:border-[#D4AF37]/50 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37] dark:hover:bg-[#D4AF37]/30 md:w-auto"
        >
          {detailsOpen ? "إخفاء التفاصيل" : "مراجعة الطلب"}
        </button>

        {app.status === "pending" ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onApprove}
              title="قبول"
              aria-label="قبول الطلب"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Check className="h-4 w-4" aria-hidden />
              )}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onReject}
              title="رفض"
              aria-label="رفض الطلب"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </>
        ) : null}
      </div>

      {detailsOpen ? (
        <div className="w-full basis-full border-t border-slate-100 pt-4 dark:border-[#2D3F3A]">
          <div className="grid gap-2 text-sm text-slate-600 dark:text-gray-300 sm:grid-cols-2">
            {app.preferred_destinations ? (
              <p>
                <span className="font-medium text-slate-500 dark:text-slate-400">الوجهات: </span>
                {app.preferred_destinations}
              </p>
            ) : null}
            {app.languages ? (
              <p>
                <span className="font-medium text-slate-500 dark:text-slate-400">اللغات: </span>
                {app.languages}
              </p>
            ) : null}
            {app.experience_years != null ? (
              <p>
                <span className="font-medium text-slate-500 dark:text-slate-400">الخبرة: </span>
                {app.experience_years} سنة
              </p>
            ) : null}
            {!app.preferred_destinations && !app.languages && app.experience_years == null ? (
              <p className="text-slate-400 dark:text-slate-500">لا توجد تفاصيل إضافية في الطلب.</p>
            ) : null}
          </div>

          {canShowExpert ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={onToggleExpert}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-300"
                aria-expanded={expanded}
              >
                المهام المرتبطة بالخبير
                <ChevronDown
                  className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`}
                />
              </button>

              {expanded ? (
                <div className="mt-3">
                  {loadingExpert ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 p-6 text-xs font-medium text-slate-500 dark:bg-[#1A2421] dark:text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400 dark:text-[#D4AF37]" />
                      جاري تحميل المهام…
                    </div>
                  ) : expertError ? (
                    <p className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                      {expertError}
                    </p>
                  ) : expertData ? (
                    <ExpertAssignmentsPanel
                      itineraries={expertData.itineraries}
                      quotations={expertData.quotations}
                      compact
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export default function PartnerRadarPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<PartnerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<"all" | "leader" | "expert">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [actingId, setActingId] = useState<string | number | null>(null);
  const [expandedExpertId, setExpandedExpertId] = useState<string | null>(null);
  const [detailsOpenId, setDetailsOpenId] = useState<string | null>(null);
  const [loadingExpertId, setLoadingExpertId] = useState<string | null>(null);
  const [expertAssignments, setExpertAssignments] = useState<
    Record<string, ExpertAssignments>
  >({});
  const [expertAssignmentErrors, setExpertAssignmentErrors] = useState<
    Record<string, string>
  >({});

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/crm/partner-applications");
      const payload = (await res.json()) as {
        ok?: boolean;
        applications?: PartnerApplication[];
        error?: string;
      };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || `status_${res.status}`);
      }
      setApplications(Array.isArray(payload.applications) ? payload.applications : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch_failed");
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchApplications();
  }, [fetchApplications]);

  const filtered = useMemo(() => {
    return applications.filter((app) => {
      if (app.partner_kind === "celebrity") return false;
      if (kindFilter !== "all" && app.partner_kind !== kindFilter) return false;
      if (statusFilter !== "all" && app.status !== statusFilter) return false;
      return true;
    });
  }, [applications, kindFilter, statusFilter]);

  const counts = useMemo(() => {
    const relevant = applications.filter((a) => a.partner_kind !== "celebrity");
    const pending = relevant.filter((a) => a.status === "pending").length;
    return { pending, total: relevant.length };
  }, [applications]);

  async function reviewApplication(
    app: PartnerApplication,
    action: "approve" | "reject",
  ) {
    const notes =
      action === "reject"
        ? window.prompt("سبب الرفض (اختياري):", "") ?? ""
        : "";

    setActingId(app.id);
    try {
      const res = await fetch("/api/crm/partner-applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: app.id,
          action,
          review_notes: notes.trim() || null,
        }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || "review_failed");
      }
      await fetchApplications();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "تعذر تحديث الطلب.",
      );
    } finally {
      setActingId(null);
    }
  }

  async function toggleExpertAssignments(app: PartnerApplication) {
    const expertId = String(app.id);
    if (expandedExpertId === expertId) {
      setExpandedExpertId(null);
      return;
    }

    setExpandedExpertId(expertId);
    if (expertAssignments[expertId]) return;

    setLoadingExpertId(expertId);
    setExpertAssignmentErrors((current) => {
      const next = { ...current };
      delete next[expertId];
      return next;
    });
    try {
      const response = await fetch(
        `/api/crm/experts/${encodeURIComponent(expertId)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        itineraries?: ExpertAssignedItinerary[];
        quotations?: ExpertAssignedQuotation[];
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "تعذر تحميل مهام الخبير.");
      }
      setExpertAssignments((current) => ({
        ...current,
        [expertId]: {
          itineraries: Array.isArray(payload.itineraries)
            ? payload.itineraries
            : [],
          quotations: Array.isArray(payload.quotations)
            ? payload.quotations
            : [],
        },
      }));
    } catch (err) {
      setExpertAssignmentErrors((current) => ({
        ...current,
        [expertId]:
          err instanceof Error ? err.message : "تعذر تحميل مهام الخبير.",
      }));
    } finally {
      setLoadingExpertId(null);
    }
  }

  return (
    <div className="min-h-full bg-[#F9FAFB] font-sans" dir="rtl">
      <header className="mb-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="min-w-0">
            <span className="text-xs font-bold uppercase tracking-widest text-[#b8952d]">
              PARTNERS RADAR
            </span>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900">رادار الشركاء</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              طلبات انضمام القادة وخبراء الوجهات من النموذج العام – بحالة pending حتى القبول أو
              الرفض.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/crm/partners-directory")}
              className="flex flex-shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition-all hover:bg-slate-800"
            >
              <Handshake className="h-4 w-4 shrink-0" aria-hidden />
              <span>دليل شبكة الشركاء النشطين</span>
            </button>
            <span className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-bold text-[#b8952d]">
              {counts.total} إجمالي السجلات
            </span>
            <span className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700">
              {counts.pending} قيد المراجعة
            </span>
          </div>
        </div>
      </header>

      <div className="flex w-full flex-col items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm lg:flex-row">
        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
          <span className="me-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            الدور
          </span>
          {(["all", "leader", "expert"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => setKindFilter(kind)}
              className={kindFilter === kind ? FILTER_PILL_ACTIVE : FILTER_PILL_INACTIVE}
            >
              {kind === "all"
                ? "الكل"
                : `${PARTNER_KIND_EMOJI[kind]} ${PARTNER_KIND_LABELS[kind]}`}
            </button>
          ))}
        </div>

        <div className="hidden h-8 w-px bg-slate-200 lg:block" aria-hidden />

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          <span className="me-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            الحالة
          </span>
          {(
            [
              ["pending", "قيد المراجعة"],
              ["approved", "مقبول / نشط"],
              ["rejected", "مرفوض"],
              ["all", "الكل"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={statusFilter === value ? FILTER_PILL_ACTIVE : FILTER_PILL_INACTIVE}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
          <p className="mt-2 text-xs font-normal opacity-80">
            تأكد من جداول leaders / experts وعمود status في Supabase
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-16 text-sm font-medium text-slate-500 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-[#D4AF37]">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          جاري التحميل…
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 flex w-full flex-col items-center justify-center rounded-xl border border-slate-100 bg-white py-24 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]">
          <Radar className="mb-4 h-16 w-16 text-slate-300 dark:text-slate-600" aria-hidden />
          <p className="text-lg font-medium text-slate-500 dark:text-slate-400">
            لا توجد طلبات شركاء في هذا الفلتر
          </p>
          <p className="mt-2 max-w-sm text-center text-sm text-slate-400 dark:text-slate-500">
            غيّر فلاتر الدور أو الحالة، أو انتظر طلبات انضمام جديدة من النموذج العام.
          </p>
        </div>
      ) : (
        <div className="mt-6">
          {filtered.map((app) => {
            const rowKey = `${app.partner_kind}-${String(app.id)}`;
            return (
              <PartnerRadarCard
                key={rowKey}
                app={app}
                actingId={actingId}
                expanded={expandedExpertId === String(app.id)}
                detailsOpen={detailsOpenId === rowKey}
                loadingExpert={loadingExpertId === String(app.id)}
                expertError={expertAssignmentErrors[String(app.id)]}
                expertData={expertAssignments[String(app.id)]}
                onToggleDetails={() =>
                  setDetailsOpenId((current) => (current === rowKey ? null : rowKey))
                }
                onToggleExpert={() => void toggleExpertAssignments(app)}
                onApprove={() => void reviewApplication(app, "approve")}
                onReject={() => void reviewApplication(app, "reject")}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
