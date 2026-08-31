'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { createSession, updateSession } from '@/app/crm/services/sessions';
import type { Session, SessionInsert } from '@/types/session-tables';
import { CRM_BTN_PRIMARY, CRM_INPUT, CRM_TEXTAREA } from '@/lib/crm-luxury-ui';

type SessionFormProps = {
  mode?: 'create' | 'edit';
  initialSession?: Session | null;
  onSaved?: (session: Session) => void;
  onCancelEdit?: () => void;
};

export function SessionForm({ mode = 'create', initialSession = null, onSaved, onCancelEdit }: SessionFormProps) {
  const [title, setTitle] = useState(initialSession?.title ?? '');
  const [date, setDate] = useState(initialSession?.date ?? '');
  const [sessionType, setSessionType] = useState<'online' | 'inperson'>(
    String(initialSession?.session_type ?? 'online').toLowerCase().includes('person') ? 'inperson' : 'online'
  );
  const [priceFree, setPriceFree] = useState(true);
  const [price, setPrice] = useState(initialSession?.price ?? 0);
  const [spots, setSpots] = useState(initialSession?.spots ?? 20);
  const [description, setDescription] = useState(initialSession?.description ?? '');
  const [locationUrl, setLocationUrl] = useState(initialSession?.location_url ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setTitle(initialSession?.title ?? '');
    setDate(initialSession?.date ?? '');
    setSessionType(String(initialSession?.session_type ?? 'online').toLowerCase().includes('person') ? 'inperson' : 'online');
    const p = Number(initialSession?.price ?? 0);
    setPrice(p);
    setPriceFree(p <= 0);
    setSpots(initialSession?.spots ?? 20);
    setDescription(initialSession?.description ?? '');
    setLocationUrl(initialSession?.location_url ?? '');
    setMessage(null);
  }, [initialSession]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!title.trim() || !date) {
      setMessage({ type: 'err', text: 'عنوان الجلسة والتاريخ مطلوبان.' });
      return;
    }
    if (spots < 1) {
      setMessage({ type: 'err', text: 'عدد المقاعد يجب أن يكون 1 على الأقل.' });
      return;
    }

    setSubmitting(true);
    const payload: SessionInsert = {
      title: title.trim(),
      date: date.slice(0, 10),
      session_type: sessionType,
      price: priceFree ? 0 : Math.max(0, Number(price) || 0),
      spots: Math.floor(spots),
      description: description.trim(),
      ...(sessionType === 'inperson' && locationUrl.trim() ? { location_url: locationUrl.trim() } : {}),
    };

    const result =
      mode === 'edit' && initialSession?.id
        ? await updateSession(String(initialSession.id), payload)
        : await createSession(payload);
    setSubmitting(false);

    if (!result.ok) {
      setMessage({ type: 'err', text: result.error });
      return;
    }

    setMessage({ type: 'ok', text: mode === 'edit' ? 'تم تحديث الجلسة بنجاح.' : 'تم إنشاء الجلسة بنجاح.' });
    onSaved?.(result.data);
    if (mode === 'edit') return;
    setTitle('');
    setDate('');
    setSessionType('online');
    setPriceFree(true);
    setPrice(0);
    setSpots(20);
    setDescription('');
    setLocationUrl('');
  }

  return (
    <form
      onSubmit={handleSubmit}
      dir="rtl"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]"
    >
      <h2 className="text-sm font-bold text-slate-900 dark:text-white">
        {mode === 'edit' ? 'تعديل جلسة' : 'إضافة جلسة جديدة'}
      </h2>
      <p className="mt-1 text-xs font-medium text-slate-500">
        {mode === 'edit' ? 'عدّل تفاصيل الجلسة في الحقول أدناه.' : 'أدخل تفاصيل الجلسة الجديدة أدناه.'}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:gap-x-4 lg:gap-y-3">
        <div className="sm:col-span-2 lg:col-span-6">
          <label className="mb-1 block text-xs font-semibold text-slate-500">عنوان الجلسة *</label>
          <input
            className={CRM_INPUT}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: جلسة تعريفية عن التخطيط للسفر"
          />
        </div>

        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">تاريخ الجلسة *</label>
          <input
            type="date"
            className={CRM_INPUT}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="lg:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">نوع الجلسة *</label>
          <select
            className={CRM_INPUT}
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value as 'online' | 'inperson')}
          >
            <option value="online">أونلاين</option>
            <option value="inperson">حضوري</option>
          </select>
        </div>

        <div className="sm:col-span-2 lg:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">عدد المقاعد *</label>
          <input
            type="number"
            min={1}
            className={CRM_INPUT}
            value={spots}
            onChange={(e) => setSpots(parseInt(e.target.value, 10) || 1)}
          />
        </div>

        {sessionType === 'inperson' && (
          <div className="sm:col-span-2 lg:col-span-6">
            <label className="mb-1 block text-xs font-semibold text-slate-500">
              رابط الموقع (Google Maps)
            </label>
            <input
              type="url"
              className={CRM_INPUT}
              value={locationUrl}
              onChange={(e) => setLocationUrl(e.target.value)}
              placeholder="https://maps.google.com/..."
            />
          </div>
        )}

        <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-6 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-6">
          <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 lg:pt-2">
            <input
              type="checkbox"
              checked={priceFree}
              onChange={(e) => setPriceFree(e.target.checked)}
              className="rounded border-slate-300"
            />
            جلسة مجانية
          </label>
          {!priceFree && (
            <div className="min-w-[12rem] flex-1">
              <label className="mb-1 block text-xs font-semibold text-slate-500">السعر (ريال)</label>
              <input
                type="number"
                min={0}
                className={`${CRM_INPUT} max-w-xs`}
                value={price || ''}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
        </div>

        <div className="sm:col-span-2 lg:col-span-6">
          <label className="mb-1 block text-xs font-semibold text-slate-500">الوصف</label>
          <textarea
            rows={3}
            className={CRM_TEXTAREA}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="وصف مختصر للجلسة…"
          />
        </div>
      </div>

      {message && (
        <div
          className={`mt-3 rounded-xl border px-3 py-2 text-xs font-medium ${
            message.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-400'
              : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="submit"
          disabled={submitting}
          className={`${CRM_BTN_PRIMARY} w-full sm:w-auto sm:min-w-[200px]`}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === 'edit' ? 'تحديث الجلسة' : 'حفظ الجلسة'}
        </button>
        {mode === 'edit' && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="w-full rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-700 dark:border-[#2D3F3A] dark:text-slate-300 sm:w-auto sm:px-6"
          >
            إلغاء التعديل
          </button>
        )}
      </div>
    </form>
  );
}
