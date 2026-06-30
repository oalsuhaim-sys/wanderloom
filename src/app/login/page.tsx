import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

import LoginForm from './LoginForm';

export default function LoginPage() {
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#FDFBF7] text-[#111111]"
      dir="rtl"
      style={{
        fontFamily: 'var(--font-tajawal), system-ui, sans-serif',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(205,160,76,0.12), transparent), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(30,63,32,0.06), transparent)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517760444937-f6397edcbbcd?q=80&w=1600&auto=format&fit=crop')] bg-cover bg-center opacity-[0.07]" />

      <Suspense
        fallback={
          <div className="relative z-10 flex min-h-screen items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-[#cda04c]" aria-label="جاري التحميل" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
