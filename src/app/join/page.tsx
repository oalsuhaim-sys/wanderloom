import Link from 'next/link'

import LeaderApplicationForm from './LeaderApplicationForm'

export const metadata = {
  title: 'طلب انضمام VIP | Wanderloom',
  description: 'نموذج تقديم حصري عبر شركاء وندرلُوم',
}

export default function JoinPage() {
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#FDFBF7] text-[#111111]"
      dir="rtl"
      style={{ fontFamily: 'var(--font-tajawal), system-ui, sans-serif' }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(205,160,76,0.14), transparent), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(30,63,32,0.08), transparent)',
        }}
      />

      <header className="relative z-10 border-b border-[#1e3f20]/10 bg-white/70 px-4 py-4 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <Link href="/" className="text-sm font-black text-[#1e3f20] transition hover:text-[#163018]">
            ← وندرلُوم
          </Link>
          <span className="text-[10px] font-black tracking-[0.25em] text-[#6b5c38]">APPLICATION</span>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-10 sm:px-8 sm:py-16">
        <LeaderApplicationForm />
      </div>
    </main>
  )
}
