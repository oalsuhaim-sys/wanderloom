'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { useParams } from 'next/navigation'
import { Check, Copy, Loader2, ShieldCheck, Sparkles, Upload } from 'lucide-react'

import {
  fetchCheckoutClient,
  submitBankReceipt,
  uploadBankReceipt,
  WANDERLOOM_BANK_DETAILS,
  type CheckoutClientProfile,
} from '@/lib/bank-checkout'

const PANEL =
  'rounded-[1.75rem] border border-[#d4af37]/20 bg-gradient-to-b from-[#121816] to-[#0a0d0b] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-8'

const GOLD = 'text-[#d4af37]'

export default function CheckoutClient() {
  const params = useParams()
  const clientId = String(params?.id ?? '').trim()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<CheckoutClientProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [copied, setCopied] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const load = useCallback(async () => {
    if (!clientId) {
      setError('رابط السداد غير صالح')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    const res = await fetchCheckoutClient(clientId)
    setLoading(false)

    if (!res.ok || !res.client) {
      setClient(null)
      setError(res.error ?? 'لم يتم العثور على بيانات الحجز')
      return
    }

    setClient(res.client)
    if (res.client.receipt_url) setSuccess(true)
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  async function copyIban() {
    try {
      await navigator.clipboard.writeText(WANDERLOOM_BANK_DETAILS.iban.replace(/\s+/g, ''))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  async function processFile(file: File | undefined) {
    if (!file || !clientId || uploading) return
    setSelectedFile(file)
    setUploading(true)
    setError(null)

    const upload = await uploadBankReceipt(clientId, file)
    if (!upload.ok || !upload.publicUrl) {
      setUploading(false)
      setError(upload.error ?? 'تعذّر رفع الإيصال')
      return
    }

    const save = await submitBankReceipt(clientId, upload.publicUrl)
    setUploading(false)

    if (!save.ok) {
      setError(save.error ?? 'تم الرفع لكن تعذّر حفظ الإيصال')
      return
    }

    setSuccess(true)
    setClient((prev) => (prev ? { ...prev, receipt_url: upload.publicUrl! } : prev))
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    void processFile(file)
  }

  if (loading) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-[#070908] text-[#f5f0e6]"
        dir="rtl"
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className={`h-10 w-10 animate-spin ${GOLD}`} aria-hidden />
          <p className="text-sm font-bold text-white/60">جاري تحميل صفحة السداد…</p>
        </div>
      </main>
    )
  }

  if (error && !client) {
    return (
      <main className="min-h-screen bg-[#070908] px-4 py-16 text-[#f5f0e6]" dir="rtl">
        <div className="mx-auto max-w-lg rounded-2xl border border-red-500/30 bg-red-950/30 px-6 py-8 text-center">
          <p className="text-sm font-black text-red-200">{error}</p>
          <Link href="/" className={`mt-4 inline-block text-xs font-bold ${GOLD} underline`}>
            العودة للرئيسية
          </Link>
        </div>
      </main>
    )
  }

  const displayName = client?.name?.trim() || 'ضيفنا الكريم'
  const displayTrip = client?.target_trip?.trim() || 'رحلتك الحصرية'

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#070908] text-[#f5f0e6]"
      dir="rtl"
      style={{ fontFamily: 'var(--font-tajawal), system-ui, sans-serif' }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(212,175,55,0.12), transparent), radial-gradient(ellipse 60% 40% at 0% 100%, rgba(30,63,32,0.15), transparent)',
        }}
      />

      <header className="relative z-10 border-b border-[#d4af37]/10 bg-[#0a0d0b]/80 px-4 py-4 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <Link href="/" className="text-xs font-black tracking-[0.2em] text-[#d4af37]/80 transition hover:text-[#d4af37]">
            WANDERLOOM
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-white/40">
            <ShieldCheck className="h-3.5 w-3.5 text-[#d4af37]/70" aria-hidden />
            سداد آمن
          </span>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 text-center">
          <p className={`inline-flex items-center gap-2 text-[11px] font-black tracking-[0.25em] ${GOLD}`}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            CHECKOUT
          </p>
          <h1 className="mt-4 text-2xl font-black leading-snug text-white sm:text-3xl">
            أهلاً بك{' '}
            <span className={GOLD}>{displayName}</span>
            <br />
            <span className="text-lg font-bold text-white/75 sm:text-xl">في رحلة</span>{' '}
            <span className="text-[#e8dcc0]">{displayTrip}</span>
          </h1>
          <p className="mt-3 text-sm font-semibold text-white/45">
            أكمل التحويل البنكي وأرفق الإيصال لتثبيت مقعدك في الرادار الحي
          </p>
        </div>

        {success ? (
          <div className={`${PANEL} text-center`}>
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border-2 border-emerald-400/50 bg-emerald-500/10 shadow-[0_0_40px_rgba(52,211,153,0.25)]">
              <Check className="h-10 w-10 text-emerald-400 animate-[pulse_2s_ease-in-out_infinite]" aria-hidden />
            </div>
            <p className="text-lg font-black text-emerald-200">
              تم استلام الإيصال بنجاح، جاري تأكيد حجزك ونقله للرادار الحي! ✨
            </p>
            <p className="mt-3 text-xs font-semibold text-white/40">
              سيتواصل معك فريق وندرلُوم قريباً لتأكيد التفاصيل النهائية.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <section className={PANEL}>
              <h2 className={`mb-5 text-right text-sm font-black ${GOLD}`}>تفاصيل الحساب البنكي الرسمي</h2>
              <dl className="space-y-4">
                <div className="rounded-xl border border-white/8 bg-black/30 px-4 py-3">
                  <dt className="text-[10px] font-bold text-white/40">اسم البنك</dt>
                  <dd className="mt-1 text-sm font-black text-white">{WANDERLOOM_BANK_DETAILS.bankName}</dd>
                </div>
                <div className="rounded-xl border border-white/8 bg-black/30 px-4 py-3">
                  <dt className="text-[10px] font-bold text-white/40">اسم الحساب</dt>
                  <dd className="mt-1 text-sm font-black text-white">{WANDERLOOM_BANK_DETAILS.accountName}</dd>
                </div>
                <div className="rounded-xl border border-[#d4af37]/25 bg-[#d4af37]/5 px-4 py-3">
                  <dt className="text-[10px] font-bold text-[#d4af37]/70">رقم الآيبان (IBAN)</dt>
                  <dd className="mt-2 flex items-center justify-between gap-3">
                    <span className="font-mono text-sm font-black tracking-wide text-[#f5f0e6]" dir="ltr">
                      {WANDERLOOM_BANK_DETAILS.iban}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyIban()}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#d4af37]/35 bg-[#d4af37]/10 px-3 py-1.5 text-[10px] font-black text-[#d4af37] transition hover:bg-[#d4af37]/20"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5" aria-hidden />
                          تم النسخ
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" aria-hidden />
                          نسخ
                        </>
                      )}
                    </button>
                  </dd>
                </div>
              </dl>
            </section>

            <section className={PANEL}>
              <h2 className={`mb-2 text-right text-sm font-black ${GOLD}`}>إرفاق إيصال التحويل البنكي</h2>
              <p className="mb-5 text-right text-xs font-semibold text-white/40">
                اسحب الملف هنا أو اضغط للرفع — صورة أو PDF (حتى 10 ميجابايت)
              </p>

              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
                  dragOver
                    ? 'border-[#d4af37]/60 bg-[#d4af37]/10'
                    : 'border-white/15 bg-black/20 hover:border-[#d4af37]/35 hover:bg-[#d4af37]/5'
                }`}
              >
                {uploading ? (
                  <>
                    <Loader2 className={`h-10 w-10 animate-spin ${GOLD}`} aria-hidden />
                    <p className="text-sm font-bold text-white/70">جاري رفع الإيصال…</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-[#d4af37]/60" aria-hidden />
                    <p className="text-sm font-black text-white/80">اضغط أو اسحب إيصال التحويل هنا</p>
                    {selectedFile ? (
                      <p className="text-xs font-semibold text-[#d4af37]/80">{selectedFile.name}</p>
                    ) : (
                      <p className="text-[11px] font-semibold text-white/35">JPG · PNG · WebP · PDF</p>
                    )}
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                className="sr-only"
                onChange={(e) => {
                  void processFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />

              {error ? (
                <p className="mt-4 rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-xs font-bold text-red-200">
                  {error}
                </p>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}
