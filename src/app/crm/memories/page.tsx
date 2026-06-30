"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

type MemoryVaultRow = {
  id: string;
  magic_link_id?: string | null;
  itinerary_id?: string | null;
  image_urls?: string[] | null;
  comment?: string | null;
  rating?: number | null;
  created_at: string;
  client_name?: string | null;
  destination?: string | null;
  client_review?: string | null;
};

type MemoryFormState = {
  client_name: string;
  destination: string;
  rating: number;
  client_review: string;
};

const emptyForm = (): MemoryFormState => ({
  client_name: "",
  destination: "",
  rating: 5,
  client_review: "",
});

const FIELD_CLASS =
  "w-full p-3 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] text-gray-800 bg-white";

/** عند الإدراج اليدوي نخزن الاسم والوجهة داخل comment لأن الجدول الأساسي لا يضمها دائماً */
function formatManualComment(f: MemoryFormState): string {
  const lines = [`👤 ${f.client_name.trim()}`, `📍 ${f.destination.trim()}`, "", f.client_review.trim()];
  return lines.join("\n");
}

function parseMemoryComment(comment: string | null | undefined): {
  client_name: string;
  destination: string;
  body: string;
} {
  if (!comment?.trim()) {
    return { client_name: "", destination: "", body: "" };
  }
  const raw = comment.split("\n");
  let client_name = "";
  let destination = "";
  const bodyLines: string[] = [];
  for (const line of raw) {
    const t = line.trim();
    if (t.startsWith("👤")) client_name = t.replace(/^👤\s*/, "").trim();
    else if (t.startsWith("📍")) destination = t.replace(/^📍\s*/, "").trim();
    else bodyLines.push(line);
  }
  const body = bodyLines.join("\n").trim();
  return { client_name, destination, body };
}

export default function MemoriesPage() {
  const [memories, setMemories] = useState<MemoryVaultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<MemoryFormState>(emptyForm());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setFormData(emptyForm());
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
    if (!supabase) {
      setLoadError("قاعدة البيانات غير مهيأة.");
      setMemories([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("memory_vault")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setLoadError(error.message);
      setMemories([]);
    } else {
      setMemories((data as MemoryVaultRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchMemories();
  }, [fetchMemories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    if (!selectedFile) {
      setFormError("الرجاء إرفاق صورة التقييم أو المحادثة قبل الحفظ");
      return;
    }

    setSaving(true);
    setFormError(null);

    const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const filePath = `crm/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
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
    const image_urls = [publicData.publicUrl];
    const { error } = await supabase.from("memory_vault").insert([
      {
        magic_link_id: `manual-crm-${Date.now()}`,
        image_urls,
        comment: formatManualComment(formData),
        rating: formData.rating,
      },
    ]);
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

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`text-xl ${i < (rating || 5) ? "text-yellow-400" : "text-gray-300"}`}>
        ★
      </span>
    ));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center text-gray-500">
        جاري تحميل الذكريات...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans" dir="rtl">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-extrabold text-gray-900">ذكريات العملاء 📸</h1>
          <p className="text-gray-500">مكتبة التقييمات والصور المخصصة لفريق التسويق</p>
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

      {loadError ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950">
          {loadError}
        </div>
      ) : null}

      {memories.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-20 text-center">
          <div className="mb-4 text-6xl">📭</div>
          <h3 className="mb-2 text-xl font-bold text-gray-700">لا توجد ذكريات مسجلة بعد</h3>
          <p className="text-gray-500">
            عندما يقوم العملاء برفع صورهم وتقييماتهم من الرابط السحري ستظهر هنا.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
          {memories.map((memory) => {
            const parsed = parseMemoryComment(memory.comment);
            const displayName = memory.client_name || parsed.client_name || "عميل مميز";
            const displayDest = memory.destination || parsed.destination || "وجهة غير محددة";
            const displayReview =
              memory.client_review || parsed.body || memory.comment || "لم يترك العميل تعليقاً نصياً، اكتفى بالتقييم أو الصور.";

            return (
            <div
              key={memory.id}
              className="flex flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-xl"
            >
              <div className="group relative h-56 bg-gray-100">
                {memory.image_urls && memory.image_urls.length > 0 ? (
                  <img
                    src={memory.image_urls[0]}
                    alt="Trip Memory"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl text-gray-400">🗺️</div>
                )}
                {memory.image_urls && memory.image_urls.length > 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <a
                      href={memory.image_urls[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-black"
                    >
                      فتح الصورة بجودة عالية
                    </a>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-grow flex-col p-6">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{displayName}</h3>
                    <p className="mt-1 text-sm font-medium text-indigo-600">📍 {displayDest}</p>
                  </div>
                  <div className="flex rounded-full bg-gray-50 px-3 py-1">
                    {renderStars(Number(memory.rating) || 0)}
                  </div>
                </div>

                <div className="mb-4 flex-grow rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm italic leading-relaxed text-blue-900">
                  &quot;{displayReview}&quot;
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-gray-50 pt-4 text-xs text-gray-400">
                  <span>تاريخ النشر: {new Date(memory.created_at).toLocaleDateString("ar-SA")}</span>
                  <button type="button" className="font-bold text-indigo-600 hover:text-indigo-800">
                    نسخ النص للتسويق
                  </button>
                </div>
              </div>
            </div>
            );
          })}
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
                استخدم هذا النموذج لإضافة تقييمات العملاء التي تصلك عبر الواتساب.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" dir="rtl">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-right text-sm font-medium text-gray-700">
                    اسم العميل
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: أحمد العتيبي"
                    className={FIELD_CLASS}
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-right text-sm font-medium text-gray-700">
                    المدينة / الوجهة
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: ميونخ"
                    className={FIELD_CLASS}
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-right text-sm font-medium text-gray-700">
                  التقييم (من 5)
                </label>
                <select
                  className={FIELD_CLASS}
                  value={formData.rating}
                  onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })}
                >
                  <option value={5}>⭐⭐⭐⭐⭐ (ممتاز)</option>
                  <option value={4}>⭐⭐⭐⭐ (جيد جداً)</option>
                  <option value={3}>⭐⭐⭐ (جيد)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-right text-sm font-medium text-gray-700">
                  رأي العميل (التعليق)
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="اكتب نص التقييم أو المحادثة هنا…"
                  className={`${FIELD_CLASS} resize-y`}
                  value={formData.client_review}
                  onChange={(e) => setFormData({ ...formData, client_review: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-right text-sm font-medium text-gray-700">
                  إرفاق صورة الواتساب / ذكرى <span className="text-red-500">*</span>
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
                      <img
                        src={imagePreview}
                        alt="معاينة الصورة"
                        className="h-40 w-full rounded-lg border border-gray-200 object-cover"
                      />
                      <p className="text-center text-sm font-semibold text-gray-700">
                        {selectedFile?.name}
                      </p>
                      <p className="text-xs text-gray-500">اضغط لتغيير الصورة</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center px-4 py-5">
                      <svg
                        className="mb-3 h-8 w-8 text-gray-400"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 20 16"
                      >
                        <path
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                        />
                      </svg>
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
