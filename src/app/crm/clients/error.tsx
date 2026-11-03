'use client'

import { useEffect } from 'react'

export default function ClientsPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Error fetching clients:', error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6" dir="rtl">
      <div className="max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">تعذر تحميل قائمة العملاء</h1>
        <p className="text-sm text-slate-500">حدث خطأ أثناء فتح الصفحة. يمكنك المحاولة مرة أخرى.</p>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-[#1B242F] px-6 py-2.5 text-xs font-bold text-white"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  )
}
