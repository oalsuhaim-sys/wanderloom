'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';

import type { CrmSupplier } from '@/lib/crm-suppliers';
import {
  runSupplierContact,
  supplierContactButtonClass,
  supplierContactLabel,
  type SupplierContactApp,
  type SupplierContactHotel,
} from '@/lib/supplier-contact';

type Props = {
  hotel: SupplierContactHotel;
  supplierContact: string;
  onSupplierContactChange: (value: string) => void;
  suppliers: CrmSupplier[];
  destinationLabel?: string;
  isManualSupplier: boolean;
  onManualSupplierChange: (manual: boolean) => void;
};

function supplierPhoneInDirectory(contact: string, suppliers: CrmSupplier[]): boolean {
  const normalized = contact.trim();
  if (!normalized) return false;
  return suppliers.some((s) => s.phone.trim() === normalized);
}

const CHANNEL_APPS: SupplierContactApp[] = ['whatsapp', 'line', 'kakao'];

const labelClass = 'mb-2 block text-xs font-semibold text-slate-700';
const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 outline-none transition focus:border-[#D4AF37] placeholder:text-slate-600 [color-scheme:light]';

export default function SupplierContactActions({
  hotel,
  supplierContact,
  onSupplierContactChange,
  suppliers,
  destinationLabel = 'المختارة',
  isManualSupplier,
  onManualSupplierChange,
}: Props) {
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const handleContact = async (app: SupplierContactApp) => {
    setError('');
    setNotice('');
    const result = await runSupplierContact(app, {
      ...hotel,
      supplier_contact: supplierContact,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotice(result.message);
  };

  const selectValue =
    !isManualSupplier && supplierPhoneInDirectory(supplierContact, suppliers)
      ? supplierContact
      : '';

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-base font-bold text-[#D4AF37]">
          المورد المعتمد للوجهة
        </span>
        <label className="flex cursor-pointer items-center gap-1.5 text-[10px] font-bold text-slate-600">
          <input
            type="checkbox"
            checked={isManualSupplier}
            onChange={(e) => onManualSupplierChange(e.target.checked)}
            className="rounded border-slate-200 accent-[#D4AF37]"
          />
          إدخال رقم يدوياً
        </label>
      </div>

      {suppliers.length === 0 && !isManualSupplier ? (
        <p className="rounded-xl border border-[#D4AF37]/35 bg-white px-3 py-2 text-xs font-bold text-[#D4AF37]">
          لا يوجد موردون مسجلون لوجهة ({destinationLabel}). فعّل «إدخال رقم يدوياً» أو أضف موردين من
          قسم الموردين.
        </p>
      ) : null}

      {!isManualSupplier && suppliers.length > 0 ? (
        <select
          value={selectValue}
          onChange={(e) => onSupplierContactChange(e.target.value)}
          className={inputClass}
        >
          <option value="">— اختر المورد من الدليل —</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.phone || String(supplier.id)}>
              {supplier.destination || supplier.city || supplier.country} — {supplier.name}
            </option>
          ))}
        </select>
      ) : null}

      <label className="block">
        <span className={labelClass}>رقم/معرّف المورد</span>
        <input
          type="text"
          placeholder="+966… / LINE ID / Kakao ID"
          value={supplierContact}
          onChange={(e) => onSupplierContactChange(e.target.value)}
          dir="ltr"
          className={inputClass}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {CHANNEL_APPS.map((app) => (
          <button
            key={app}
            type="button"
            onClick={() => void handleContact(app)}
            className={`inline-flex min-w-[5.5rem] flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-black transition ${supplierContactButtonClass(app)}`}
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {supplierContactLabel(app)}
          </button>
        ))}
      </div>

      {error ? <p className="text-xs font-bold text-red-400">{error}</p> : null}
      {notice ? <p className="text-xs font-bold text-[#D4AF37]">{notice}</p> : null}
    </div>
  );
}

export function resolveHotelManualSupplier(
  hotel: { supplier_contact: string; isManualSupplier?: boolean },
  suppliers: CrmSupplier[],
): boolean {
  if (hotel.isManualSupplier != null) return hotel.isManualSupplier;
  const contact = hotel.supplier_contact.trim();
  if (!contact) return false;
  return !supplierPhoneInDirectory(contact, suppliers);
}
