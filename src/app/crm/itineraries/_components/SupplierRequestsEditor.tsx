'use client';

import { useState } from 'react';
import { MessageCircle, Plus, Trash2 } from 'lucide-react';

import type { CrmSupplier } from '@/lib/crm-suppliers';
import { WL_DATE_INPUT } from '@/lib/itinerary-builder-ui';
import {
  openSupplierContact,
  findSupplierForRequest,
  normalizePreferredApp,
  supplierContactButtonClass,
  supplierContactLabel,
  type SupplierContactApp,
} from '@/lib/supplier-contact';
import {
  buildSupplierRequestWhatsAppMessage,
  createEmptySupplierRequest,
  SUPPLIER_REQUEST_STATUS_OPTIONS,
  SUPPLIER_SERVICE_TYPE_OPTIONS,
  type SupplierRequest,
} from '@/lib/supplier-requests';

type BriefContext = {
  clientName?: string;
  destination?: string;
  tripDates?: string;
};

type Props = {
  requests: SupplierRequest[];
  onChange: (requests: SupplierRequest[]) => void;
  /** موردون مفلترون حسب الوجهة/الدول — لا تمرّر القائمة الكاملة */
  filteredSuppliers: CrmSupplier[];
  /** قائمة كاملة للبحث عن preferred_app عند غياب المطابقة في الفلتر */
  allSuppliers?: CrmSupplier[];
  destination: string;
  briefContext?: BriefContext;
};

const CHANNEL_APPS: SupplierContactApp[] = ['whatsapp', 'line', 'kakao'];

function SupplierChannelRow({
  contactId: contact,
  message,
  onNotice,
  onError,
}: {
  contactId: string;
  message: string;
  onNotice: (text: string) => void;
  onError: (text: string) => void;
}) {
  const handleChannel = async (app: SupplierContactApp) => {
    onError('');
    onNotice('');
    if (!contact.trim()) {
      onError('الرجاء إدخال رقم أو معرّف المورد أولاً.');
      return;
    }
    const result = await openSupplierContact({
      app,
      phone: contact,
      message,
    });
    if (!result.ok) {
      onError(result.error);
      return;
    }
    onNotice(result.message);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {CHANNEL_APPS.map((app) => (
        <button
          key={app}
          type="button"
          onClick={() => void handleChannel(app)}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-black transition min-w-[5.5rem] ${supplierContactButtonClass(app)}`}
        >
          <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {supplierContactLabel(app)}
        </button>
      ))}
    </div>
  );
}

export default function SupplierRequestsEditor({
  requests,
  onChange,
  filteredSuppliers,
  allSuppliers = [],
  destination,
  briefContext,
}: Props) {
  const destinationLabel = destination.trim() || 'المختارة';
  const supplierLookupPool =
    allSuppliers.length > 0 ? allSuppliers : filteredSuppliers;

  const [rowNotices, setRowNotices] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const update = (index: number, patch: Partial<SupplierRequest>) => {
    onChange(requests.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const resolveSupplier = (request: SupplierRequest): CrmSupplier | undefined =>
    findSupplierForRequest(filteredSuppliers, request) ??
    findSupplierForRequest(supplierLookupPool, request);

  const handleSupplierPick = (index: number, supplierId: string) => {
    const supplier = filteredSuppliers.find((s) => String(s.id) === String(supplierId));
    if (!supplier) {
      update(index, { supplier_id: '', supplier_name: '', title: '', supplierPhone: '' });
      return;
    }
    update(index, {
      supplier_id: String(supplier.id),
      supplier_name: supplier.name,
      title: supplier.name,
      supplierPhone: supplier.phone || '',
      preferred_app: normalizePreferredApp(supplier.preferred_app),
      details:
        requests[index]?.details.trim() ||
        supplier.services_provided ||
        [supplier.category, supplier.contact_person].filter(Boolean).join(' · '),
    });
  };

  return (
    <div className="space-y-4">
      {filteredSuppliers.length === 0 ? (
        <p className="rounded-lg border border-[#cda04c]/30 bg-[#FFFBF0] px-4 py-3 text-sm font-bold text-[#1e3f20]">
          لا يوجد موردين مسجلين لوجهة ({destinationLabel}) في قاعدة البيانات.
        </p>
      ) : (
        <p className="text-sm text-gray-600">
          {filteredSuppliers.length} مورد متاح لوجهة{' '}
          <strong className="text-[#1E2720]">{destinationLabel}</strong>
        </p>
      )}

      {requests.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#cda04c]/40 bg-[#FEFDF9] px-4 py-6 text-center text-sm text-gray-600">
          لا توجد طلبات بعد. اضغط «إضافة طلب مورد» لبدء دورة المتابعة.
        </p>
      ) : (
        requests.map((request, index) => {
          const contactMessage = buildSupplierRequestWhatsAppMessage(request, briefContext);
          const contactId = request.supplierPhone ?? '';
          const rowKey = request.id;

          return (
            <div
              key={request.id}
              className="rounded-xl border border-[#1e3f20]/10 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-[#cda04c]">
                  طلب #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(requests.filter((_, i) => i !== index))}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  حذف
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1.5 md:col-span-2">
                  <span className="text-xs font-bold text-gray-600">المورد *</span>
                  <select
                    value={
                      request.supplier_id ||
                      filteredSuppliers.find(
                        (s) => s.name === (request.supplier_name || request.title),
                      )?.id ||
                      ''
                    }
                    onChange={(e) => handleSupplierPick(index, e.target.value)}
                    disabled={filteredSuppliers.length === 0}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-bold text-gray-900 outline-none focus:border-[#cda04c] disabled:bg-gray-100"
                  >
                    <option value="">— اختر مورد —</option>
                    {filteredSuppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                        {supplier.category ? ` · ${supplier.category}` : ''}
                        {supplier.preferred_app
                          ? ` · ${normalizePreferredApp(supplier.preferred_app).toUpperCase()}`
                          : supplier.country?.includes('كور') || /korea/i.test(supplier.country)
                            ? ' · KAKAO'
                            : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-gray-600">نوع الخدمة</span>
                  <select
                    value={request.service_type}
                    onChange={(e) =>
                      update(index, {
                        service_type: e.target.value as SupplierRequest['service_type'],
                      })
                    }
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-bold text-gray-900 outline-none focus:border-[#cda04c]"
                  >
                    {SUPPLIER_SERVICE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-gray-600">تاريخ الخدمة</span>
                  <input
                    type="date"
                    value={request.service_date}
                    onChange={(e) => update(index, { service_date: e.target.value })}
                    className={WL_DATE_INPUT}
                  />
                </label>

                <label className="flex flex-col gap-1.5 md:col-span-2">
                  <span className="text-xs font-bold text-gray-600">تفاصيل الطلب</span>
                  <textarea
                    value={request.details}
                    onChange={(e) => update(index, { details: e.target.value })}
                    rows={2}
                    placeholder="عدد الغرف، وقت الاستلام، تفضيلات VIP…"
                    className="resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#cda04c]"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-gray-600">الحالة</span>
                  <select
                    value={request.status}
                    onChange={(e) =>
                      update(index, { status: e.target.value as SupplierRequest['status'] })
                    }
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-bold text-gray-900 outline-none focus:border-[#cda04c]"
                  >
                    {SUPPLIER_REQUEST_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5 md:col-span-2">
                  <span className="text-xs font-bold text-gray-600">رقم/معرّف المورد</span>
                  <input
                    type="text"
                    value={request.supplierPhone ?? ''}
                    onChange={(e) => update(index, { supplierPhone: e.target.value })}
                    placeholder="+82… / +966… / LINE ID"
                    dir="ltr"
                    className="rounded-lg border border-[#1e3f20]/15 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#cda04c]"
                  />
                </label>

                <div className="md:col-span-2">
                  <SupplierChannelRow
                    contactId={contactId}
                    message={contactMessage}
                    onNotice={(text) =>
                      setRowNotices((prev) => ({ ...prev, [rowKey]: text }))
                    }
                    onError={(text) => setRowErrors((prev) => ({ ...prev, [rowKey]: text }))}
                  />
                  {rowErrors[rowKey] ? (
                    <p className="mt-2 text-xs font-bold text-red-600">{rowErrors[rowKey]}</p>
                  ) : null}
                  {rowNotices[rowKey] ? (
                    <p className="mt-2 text-xs font-bold text-[#1e3f20]">{rowNotices[rowKey]}</p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })
      )}

      <button
        type="button"
        onClick={() => onChange([...requests, createEmptySupplierRequest()])}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#cda04c]/50 bg-[#1e3f20] px-4 py-2.5 text-sm font-bold text-[#cda04c] transition hover:bg-[#163018]"
      >
        <Plus className="h-4 w-4" aria-hidden />
        إضافة طلب مورد
      </button>
    </div>
  );
}
