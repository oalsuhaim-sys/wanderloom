'use client';

type Props = {
  paid: boolean;
  onChange: (paid: boolean) => void;
  compact?: boolean;
};

export default function SupplierPaymentToggle({ paid, onChange, compact }: Props) {
  return (
    <button
      type="button"
      onClick={() => onChange(!paid)}
      className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
        paid
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
          : 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100'
      } ${compact ? 'text-[10px] px-2 py-1' : ''}`}
    >
      {paid ? 'تم الدفع 🟢' : 'لم يتم الدفع للمورد 🔴'}
    </button>
  );
}
