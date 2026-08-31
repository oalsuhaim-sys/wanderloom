'use client';

export const RADAR_SECTION_INITIAL_LIMIT = 3;

type ShowAllToggleProps = {
  showAll: boolean;
  total: number;
  limit?: number;
  onToggle: () => void;
  className?: string;
};

export function ShowAllToggle({
  showAll,
  total,
  limit = RADAR_SECTION_INITIAL_LIMIT,
  onToggle,
  className = '',
}: ShowAllToggleProps) {
  if (total <= limit) return null;

  return (
    <div className={`mt-4 flex justify-center ${className}`}>
      <button
        type="button"
        onClick={onToggle}
        className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-95"
      >
        {showAll ? 'عرض أقل' : `إظهار الكل (${total})`}
      </button>
    </div>
  );
}
