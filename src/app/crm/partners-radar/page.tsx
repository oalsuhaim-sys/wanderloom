"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

import {
  ExpertAssignmentsPanel,
  type ExpertAssignedItinerary,
  type ExpertAssignedQuotation,
} from "@/components/ExpertAssignmentsPanel";
import type { PartnerApplication } from "@/lib/partners";
import { PARTNER_KIND_EMOJI, PARTNER_KIND_LABELS, partnerKindLabel } from "@/lib/partners";

type StatusFilter = "all" | "pending" | "approved" | "rejected";
type ExpertAssignments = {
  itineraries: ExpertAssignedItinerary[];
  quotations: ExpertAssignedQuotation[];
};

function isExpertEntityId(value: string | number): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value),
  );
}

export default function PartnerRadarPage() {
  const [applications, setApplications] = useState<PartnerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<"all" | "leader" | "expert">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [actingId, setActingId] = useState<string | number | null>(null);
  const [expandedExpertId, setExpandedExpertId] = useState<string | null>(null);
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
      window.alert(
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
    <div className="min-h-screen bg-gray-50 p-8 font-sans" dir="rtl">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-extrabold text-gray-900">رادار الشركاء 🤝</h1>
        <p className="text-gray-500">
          طلبات انضمام القادة وخبراء الوجهات من النموذج العام — بحالة pending حتى القبول أو الرفض.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
          {counts.pending} قيد المراجعة
        </span>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
          {counts.total} إجمالي السجلات
        </span>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {(["all", "leader", "expert"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setKindFilter(kind)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
              kindFilter === kind
                ? "bg-[#1E2720] text-[#D4AF37]"
                : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
            }`}
          >
            {kind === "all"
              ? "الكل"
              : `${PARTNER_KIND_EMOJI[kind]} ${PARTNER_KIND_LABELS[kind]}`}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
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
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              statusFilter === value
                ? "bg-[#D4AF37]/20 text-[#1E2720] ring-1 ring-[#D4AF37]/40"
                : "bg-white text-gray-500 ring-1 ring-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-900">
          {error}
          <p className="mt-2 text-xs font-normal">
            تأكد من جداول leaders / experts وعمود status في Supabase
          </p>
        </div>
      ) : null}

      {loading ? (
        <p className="font-bold text-[#B5914F]">جاري التحميل…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-lg font-bold text-gray-700">لا توجد طلبات شركاء في هذا الفلتر.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((app) => (
            <article
              key={`${app.partner_kind}-${String(app.id)}`}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-extrabold text-gray-900">{app.name}</p>
                  <p className="mt-1 text-sm font-semibold text-[#B5914F]">
                    {partnerKindLabel(app.partner_kind)}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    {app.phone}
                    {app.email ? ` · ${app.email}` : ""}
                  </p>
                  {app.preferred_destinations ? (
                    <p className="mt-1 text-xs text-gray-600">
                      الوجهات: {app.preferred_destinations}
                    </p>
                  ) : null}
                  {app.languages ? (
                    <p className="mt-1 text-xs text-gray-600">اللغات: {app.languages}</p>
                  ) : null}
                  {app.experience_years != null ? (
                    <p className="mt-1 text-xs text-gray-600">
                      الخبرة: {app.experience_years} سنة
                    </p>
                  ) : null}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    app.status === "pending"
                      ? "bg-amber-100 text-amber-900"
                      : app.status === "approved"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {app.status === "pending"
                    ? "قيد المراجعة"
                    : app.status === "approved"
                      ? "نشط"
                      : "مرفوض"}
                </span>
              </div>

              {app.partner_kind === "expert" && isExpertEntityId(app.id) ? (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() => void toggleExpertAssignments(app)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-2 text-xs font-black text-[#725A2D] transition hover:border-[#D4AF37]/60 hover:bg-[#D4AF37]/15"
                    aria-expanded={expandedExpertId === String(app.id)}
                  >
                    المهام المرتبطة بالخبير
                    <ChevronDown
                      className={`h-4 w-4 transition ${
                        expandedExpertId === String(app.id) ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {expandedExpertId === String(app.id) ? (
                    <div className="mt-3">
                      {loadingExpertId === String(app.id) ? (
                        <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 p-6 text-xs font-bold text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin text-[#B5914F]" />
                          جاري تحميل المهام…
                        </div>
                      ) : expertAssignmentErrors[String(app.id)] ? (
                        <p className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
                          {expertAssignmentErrors[String(app.id)]}
                        </p>
                      ) : expertAssignments[String(app.id)] ? (
                        <ExpertAssignmentsPanel
                          itineraries={
                            expertAssignments[String(app.id)].itineraries
                          }
                          quotations={
                            expertAssignments[String(app.id)].quotations
                          }
                          compact
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {app.status === "pending" ? (
                <div className="mt-4 flex gap-2 border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    disabled={actingId === app.id}
                    onClick={() => void reviewApplication(app, "approve")}
                    className="flex-1 rounded-xl bg-[#1E2720] py-2 text-sm font-bold text-[#D4AF37] disabled:opacity-50"
                  >
                    قبول → نشط
                  </button>
                  <button
                    type="button"
                    disabled={actingId === app.id}
                    onClick={() => void reviewApplication(app, "reject")}
                    className="flex-1 rounded-xl bg-red-50 py-2 text-sm font-bold text-red-600 disabled:opacity-50"
                  >
                    رفض
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
