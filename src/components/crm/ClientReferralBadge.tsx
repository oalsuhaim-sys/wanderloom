import Link from 'next/link';

interface ClientCardProps {
  clientName: string;
  referralCodeUsed: string;
}

export const ClientReferralBadge = ({ clientName, referralCodeUsed }: ClientCardProps) => {
  const code = referralCodeUsed.trim();
  if (!code) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <span className="min-w-0 truncate text-xs font-semibold text-slate-800">{clientName}</span>

      <Link
        href={`/influencers/${encodeURIComponent(code)}`}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 font-mono text-xs font-bold text-[#BA8E48] transition-all hover:bg-amber-100"
        title="انقر للانتقال لصفحة صاحب الكود"
      >
        <span>🔑 {code}</span>
        <span className="text-[10px] opacity-70">←</span>
      </Link>
    </div>
  );
};
