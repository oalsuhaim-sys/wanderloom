"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

type ClientOption = {
  id: number;
  name: string;
};

type ItineraryOption = {
  id: number;
  title: string | null;
  destination: string | null;
};

/** Flat row from client_memories — no FK joins */
type ClientMemoryRow = {
  id: number | string;
  client_id?: number | string | null;
  itinerary_id?: number | string | null;
  image_url: string;
  caption?: string | null;
  location_name?: string | null;
  location?: string | null;
  created_at?: string | null;
};

type MemoryFormState = {
  client_id: string;
  itinerary_id: string;
  location_name: string;
  rating: number;
  client_review: string;
};

const emptyForm = (): MemoryFormState => ({
  client_id: "",
  itinerary_id: "",
  location_name: "",
  rating: 5,
  client_review: "",
});

const FIELD_CLASS =
  "w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] text-gray-800 bg-white";

export default function MemoriesPage() {
  const [memories, setMemories] = useState<ClientMemoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientItineraries, setClientItineraries] = useState<ItineraryOption[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<MemoryFormState>(emptyForm());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(() => {
    setFormData(emptyForm());
    setClientItineraries([]);
    setSelectedFile(null);
    setFormError(null);
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    resetForm();
  }, [resetForm]);

  const fetchMemories = useCallback(async () => {
    try {
      setIsLoading(true);
      setFetchError(null);

      if (!supabase) {
        throw new Error(
          "Supabase client is null — check NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY",
        );
      }

      // 1) Strict direct select — no joins
      const { data, error } = await supabase
        .from("client_memories")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      console.log("Fetched memories from DB (anon):", data);
      console.log("Memories count (anon):", data?.length ?? 0);

      if (Array.isArray(data) && data.length > 0) {
        setMemories(data as ClientMemoryRow[]);
        return;
      }

      // 2) Anon returned 0 rows (common when RLS blocks SELECT) — try admin API
      console.warn(
        "[crm/memories] anon returned 0 rows — trying /api/crm/client-memories (admin)",
      );
      const apiRes = await fetch("/api/crm/client-memories");
      const apiPayload = (await apiRes.json()) as {
        ok?: boolean;
        memories?: ClientMemoryRow[];
        error?: string;
      };

      console.log("Fetched memories from admin API:", apiPayload);

      if (!apiRes.ok || !apiPayload.ok) {
        setFetchError(
          apiPayload.error ||
            `anon_returned_0_rows; admin_api_failed:status_${apiRes.status}`,
        );
        setMemories([]);
        return;
      }

      const adminRows = Array.isArray(apiPayload.memories) ? apiPayload.memories : [];
      setMemories(adminRows);

      if (adminRows.length === 0) {
        setFetchError(
          "anon و admin أعادا 0 صفوف — تحقق من وجود بيانات في جدول client_memories",
        );
      } else {
        // Flag that anon RLS likely blocked reads
        setFetchError(
          `تنبيه: anon رأى 0 صفوف (RLS؟) — عُرضت ${adminRows.length} ذكرى عبر Admin API`,
        );
      }
    } catch (err) {
      console.error("Fetch error details:", err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err != null
            ? JSON.stringify(err)
            : String(err);
      setFetchError(message || "unknown_error");
      setMemories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMemories();
  }, [fetchMemories]);

  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name", { ascending: true });
      if (!error && data) {
        setClients(
          (data as ClientOption[]).filter(
            (client) => client.id != null && String(client.name ?? "").trim().length > 0,
          ),
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (!supabase || !formData.client_id.trim()) {
      setClientItineraries([]);
      return;
    }

    void (async () => {
      const clientId = Number(formData.client_id);
      if (!Number.isFinite(clientId)) {
        setClientItineraries([]);
        return;
      }

      const [directRes, memberRes] = await Promise.all([
        supabase
          .from("itineraries")
          .select("id, title, destination")
          .eq("client_id", clientId)
          .or("is_template.is.null,is_template.eq.false")
          .order("id", { ascending: false }),
        supabase
          .from("itinerary_client_members")
          .select("itinerary_id, itineraries (id, title, destination, is_template)")
          .eq("client_id", clientId),
      ]);

      const byId = new Map<number, ItineraryOption>();

      for (const row of (directRes.data ?? []) as ItineraryOption[]) {
        if (row?.id != null) byId.set(Number(row.id), row);
      }

      for (const link of (memberRes.data ?? []) as Array<{
        itineraries?: ItineraryOption | ItineraryOption[] | null;
      }>) {
        const nested = link.itineraries;
        const itinerary = Array.isArray(nested) ? nested[0] : nested;
        if (!itinerary?.id) continue;
        if ((itinerary as { is_template?: boolean }).is_template === true) continue;
        byId.set(Number(itinerary.id), {
          id: Number(itinerary.id),
          title: itinerary.title ?? null,
          destination: itinerary.destination ?? null,
        });
      }

      setClientItineraries(
        [...byId.values()].sort((a, b) => Number(b.id) - Number(a.id)),
      );
    })();
  }, [formData.client_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    const selectedClient = clients.find(
      (client) => String(client.id) === formData.client_id.trim(),
    );

    if (!selectedClient?.id) {
      setFormError("الرجاء اختيار العميل قبل رفع الذكرى.");
      return;
    }

    if (!selectedFile) {
      setFormError("الرجاء إرفاق صورة قبل الحفظ");
      return;
    }

    setSaving(true);
    setFormError(null);

    const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `crm/client-${selectedClient.id}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("memories")
      .upload(filePath, selectedFile, {
        contentType: selectedFile.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      setFormError(uploadError.message || "تعذر رفع الصورة. حاول مرة أخرى.");
      setSaving(false);
      return;
    }

    const { data: publicData } = supabase.storage.from("memories").getPublicUrl(filePath);
    const uploadedFileUrl = publicData.publicUrl;
    const memoryCaption = formData.client_review.trim() || null;

    const { error } = await supabase.from("client_memories").insert({
      client_id: selectedClient.id,
      image_url: uploadedFileUrl,
      caption: memoryCaption,
      itinerary_id: formData.itinerary_id.trim() ? Number(formData.itinerary_id) : null,
      location_name: formData.location_name.trim() || null,
      location: formData.location_name.trim() || null,
    });

    if (error) {
      setFormError(error.message);
      setSaving(false);
      return;
    }

    closeModal();
    void fetchMemories();
    setSaving(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setFormError(null);
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans" dir="rtl">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-extrabold text-gray-900">ذكريات العملاء 📸</h1>
          <p className="text-gray-500">مكتبة التقييمات والصور المخصصة لفريق التسويق وبوابة العميل</p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-black px-6 py-3 font-bold text-white shadow-lg transition hover:bg-gray-800"
        >
          <span>➕</span> إضافة ذكرى يدوياً
        </button>
      </div>

      {fetchError ? (
        <div
          className={`mb-6 rounded-xl border px-4 py-4 text-sm font-bold ${
            memories.length > 0
              ? "border-amber-300 bg-amber-50 text-amber-950"
              : "border-rose-300 bg-rose-50 text-rose-900"
          }`}
        >
          <p className="mb-1 text-xs uppercase tracking-wide opacity-70">Fetch diagnostics</p>
          <p className="break-all font-mono text-xs sm:text-sm">{fetchError}</p>
          <button
            type="button"
            onClick={() => void fetchMemories()}
            className={`mt-3 rounded-lg px-4 py-2 text-xs font-bold text-white ${
              memories.length > 0 ? "bg-amber-900" : "bg-rose-900"
            }`}
          >
            إعادة المحاولة
          </button>
        </div>
      ) : null}

      <p className="mb-4 text-xs font-bold text-gray-500">
        حالة التحميل: {isLoading ? "جاري…" : "انتهى"} · عدد الصفوف: {memories.length}
      </p>

      {isLoading ? (
        <div className="flex justify-center p-10">
          <p className="font-bold text-[#B5914F]">جاري جلب الذكريات...</p>
        </div>
      ) : memories.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4 lg:grid-cols-5">
          {memories.map((m) => (
            <div
              key={String(m.id)}
              className="group relative aspect-square overflow-hidden rounded-2xl bg-gray-100 shadow-lg"
            >
              {m.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.image_url}
                  alt={m.location_name || m.caption || "Memory"}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-bold text-gray-400">
                  لا توجد صورة
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/80 to-transparent p-4 transition-transform group-hover:translate-y-0">
                <p className="text-center text-sm font-bold text-white drop-shadow-md">
                  📍 {m.location_name || m.location || "بدون موقع"}
                </p>
                {m.created_at ? (
                  <p className="mt-1 text-center text-[11px] text-white/80">
                    {new Date(m.created_at).toLocaleDateString("ar-SA")}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-gray-100 bg-white p-12 shadow-sm">
          <div className="mb-4 text-6xl">📭</div>
          <h3 className="mt-6 text-xl font-bold text-[#1A2521]">
            لا توجد ذكريات تسويقية مسجلة بعد
          </h3>
          <p className="mt-2 max-w-md text-center text-sm text-gray-500">
            الاستعلام نجح لكن الجدول فارغ من جهة العميل (anon)، أو لا توجد صفوف مرئية بسبب RLS.
          </p>
          {!fetchError ? (
            <p className="mt-3 max-w-lg rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-bold text-amber-900">
              إذا كانت الصفوف موجودة في Supabase Table Editor ولم تظهر هنا، نفّذ سياسات RLS من
              supabase/sql/client_memories.sql أو استخدم service role في الـ API.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void fetchMemories()}
            className="mt-6 rounded-xl border border-[#B5914F]/40 bg-[#FFFBF0] px-5 py-2.5 text-sm font-bold text-[#B5914F]"
          >
            إعادة التحميل
          </button>
        </div>
      )}

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          dir="rtl"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-xl rounded-3xl border border-[#D4AF37]/20 bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 border-b border-gray-100 pb-5">
              <h2 className="text-2xl font-bold text-gray-900">توثيق ذكرى عميل ✍️</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                اختر العميل أولاً — تُربط الصورة مباشرةً بملفه الشخصي في بوابة VIP.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">
              <div>
                <label className="mb-1 block text-right text-sm font-medium text-gray-700">
                  العميل <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  className={FIELD_CLASS}
                  value={formData.client_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      client_id: e.target.value,
                      itinerary_id: "",
                    })
                  }
                >
                  <option value="">اختر العميل…</option>
                  {clients.map((client) => (
                    <option key={client.id} value={String(client.id)}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-right text-sm font-medium text-gray-700">
                  المسار / الرحلة (اختياري)
                </label>
                <select
                  className={FIELD_CLASS}
                  value={formData.itinerary_id}
                  onChange={(e) => {
                    const itineraryId = e.target.value;
                    const selectedItinerary = clientItineraries.find(
                      (itinerary) => String(itinerary.id) === itineraryId,
                    );
                    const suggestedLocation =
                      selectedItinerary?.destination?.trim() ||
                      selectedItinerary?.title?.trim() ||
                      "";

                    setFormData((prev) => ({
                      ...prev,
                      itinerary_id: itineraryId,
                      location_name:
                        prev.location_name.trim() || suggestedLocation || prev.location_name,
                    }));
                  }}
                  disabled={!formData.client_id || clientItineraries.length === 0}
                >
                  <option value="">بدون ربط بمسار محدد</option>
                  {clientItineraries.map((itinerary) => (
                    <option key={itinerary.id} value={String(itinerary.id)}>
                      {(itinerary.destination || itinerary.title || `مسار #${itinerary.id}`).trim()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-right text-sm font-medium text-gray-700">
                  اسم الموقع / المحطة
                </label>
                <input
                  type="text"
                  placeholder="مثال: برج طوكيو"
                  className={FIELD_CLASS}
                  value={formData.location_name}
                  onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-right text-sm font-medium text-gray-700">
                  رأي العميل (التعليق)
                </label>
                <textarea
                  rows={4}
                  placeholder="اكتب نص التقييم أو المحادثة هنا…"
                  className={`${FIELD_CLASS} resize-y`}
                  value={formData.client_review}
                  onChange={(e) => setFormData({ ...formData, client_review: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-right text-sm font-medium text-gray-700">
                  إرفاق صورة <span className="text-red-500">*</span>
                </label>
                <label
                  className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition ${
                    selectedFile
                      ? "border-[#D4AF37]/60 bg-[#D4AF37]/5"
                      : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                  } ${imagePreview ? "h-auto min-h-[8rem] p-3" : "h-32"}`}
                >
                  {imagePreview ? (
                    <div className="flex w-full flex-col items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="معاينة الصورة"
                        className="h-40 w-full rounded-lg border border-gray-200 object-cover"
                      />
                      <p className="text-center text-sm font-semibold text-gray-700">
                        {selectedFile?.name}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center px-4 py-5">
                      <p className="mb-1 text-sm font-semibold text-gray-600">اضغط هنا لرفع الصورة</p>
                      <p className="text-xs text-gray-400">JPG · PNG · WebP · GIF</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    required
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>

              {formError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
                  {formError}
                </div>
              ) : null}

              <div className="flex gap-3 border-t border-gray-100 pt-2">
                <button
                  type="submit"
                  disabled={!selectedFile || saving}
                  className="flex-1 rounded-xl bg-[#1E2720] py-3 text-sm font-bold text-[#D4AF37] transition hover:bg-[#2a362c] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "جاري الحفظ…" : "حفظ"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-50 py-3 text-sm font-bold text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
