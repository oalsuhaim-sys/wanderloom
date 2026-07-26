import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

import ForgotPasswordForm from './ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#FDFBF7] text-[#111111]"
      dir="rtl"
      style={{ fontFamily: 'var(--font-tajawal), system-ui, sans-serif' }}
    >
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-[#cda04c]" />
          </div>
        }
      >
        <ForgotPasswordForm />
      </Suspense>
    </main>
  );
}
