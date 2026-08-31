'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Globe, Handshake, Loader2, Search, ShieldCheck } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useCountries } from '@/hooks/useCountries'

type SupplierRow = {
  id: string
  name: string
  category: string
  country: string
  contact_person: string
  phone: string
  email: string
  services_provided: string
}

function pickStr(raw: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = raw[k]
    if (v != null && String(v).trim()) return String(v).trim()
  }
  return ''
}

function normalizeSupplier(raw: Record<string, unknown>): SupplierRow | null {
  const id = raw.id != null ? String(raw.id) : ''
  const name = pickStr(raw, ['name', 'supplier_name', 'company_name', 'title'])
  if (!id || !name) return null
  return {
    id,
    name,
    category: pickStr(raw, ['category', 'supplier_category', 'type']),
    country: pickStr(raw, ['country', 'country_name']),
    contact_person: pickStr(raw, ['contact_person', 'contact_name', 'contact']),
    phone: pickStr(raw, ['phone', 'phone_number', 'mobile']),
    email: pickStr(raw, ['email', 'contact_email']),
    services_provided: pickStr(raw, ['services_provided', 'services', 'service_summary']),
  }
}

function matchesCountryFilter(
  countryStored: string,
  filterId: string,
  options: { id: string; name: string }[],
): boolean {
  if (!filterId) return true
  const raw = countryStored.trim().toLowerCase()
  if (!raw) return false
  const match = options.find((c) => c.id === filterId)
  if (!match) return false
  return raw === match.name.toLowerCase() || raw === match.id.toLowerCase()
}

const CONTROL_FIELD =
  'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-100 dark:focus:border-[#D4AF37]/40 dark:focus:ring-[#D4AF37]/15'

const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:border dark:border-[#D4AF37]/50 dark:bg-[#D4AF37]/20 dark:text-[#D4AF37] dark:hover:bg-[#D4AF37]/30'

const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-300'

const CARD =
  'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]'

const CATEGORY_BADGE =
  'shrink-0 rounded-full bg-slate-100 px-3 py-1 text-center text-xs font-medium text-slate-700 dark:bg-[#1A2421] dark:text-[#D4AF37] dark:ring-1 dark:ring-[#2D3F3A]'

export default function SuppliersPage() {
  const { countries: countryOptions } = useCountries()
  const [rows, setRows] = useState<SupplierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [countryFilter, setCountryFilter] = useState('')

  const load = useCallback(async () => {
    setError(null)
    if (!supabase) {
      setRows([])
      setError('قاعدة البيانات غير مهيأة.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data, error: qErr } = await supabase.from('suppliers').select('*')
      if (qErr) throw qErr
      let list = (data ?? [])
        .map((r) => normalizeSupplier(r as Record<string, unknown>))
        .filter((x): x is SupplierRow => Boolean(x))
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'ar'))
      setRows(list)
    } catch (e) {
      console.error('[CRM suppliers]', e)
      setRows([])
      setError(e instanceof Error ? e.message : 'تعذر تحميل الموردين.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (!matchesCountryFilter(r.country, countryFilter, countryOptions)) return false
      if (!q) return true
      const hay = [
        r.name,
        r.category,
        r.country,
        r.contact_person,
        r.phone,
        r.email,
        r.services_provided,
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [rows, search, countryFilter, countryOptions])

  return (
    <div dir="rtl" className="min-h-full bg-[#F9FAFB] font-sans dark:bg-[#1A2421]">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex flex-col gap-4 rounded-2xl bg-slate-900 p-4 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:border dark:border-[#D4AF37]/30 dark:!bg-[#22302C] dark:text-[#D4AF37]">
          <div className="space-y-1.5">
            <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/50 dark:text-[#D4AF37]/80">
              <Handshake className="h-3.5 w-3.5" aria-hidden />
              CRM الداخلي
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl dark:text-gray-100">
              دليل الموردين
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-white/70 dark:text-gray-300">
              شبكة الموثوق بهم: فنادق، نقالات، دلائل، وفاعليات — بيانات حية من جدول{' '}
              <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-white/90 dark:bg-[#1A2421] dark:text-[#D4AF37]">
                suppliers
              </code>
              .
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-white/90 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-200">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#D4AF37]" aria-hidden />
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  جاري المزامنة…
                </span>
              ) : (
                <span>
                  <strong className="text-white dark:text-[#D4AF37]">{filtered.length}</strong>
                  <span className="mx-1 text-white/50">/</span>
                  <span className="text-white/70 dark:text-gray-400">{rows.length} مورد</span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/crm/destinations"
                className={`${BTN_SECONDARY} border-white/20 !bg-white/10 !text-white hover:!bg-white/20 dark:!border-[#D4AF37]/30 dark:!bg-[#1A2421] dark:!text-[#D4AF37]`}
              >
                دليل الوجهات
              </Link>
              <Link href="/crm/hotels" className={`${BTN_PRIMARY} !bg-white !text-slate-900 hover:!bg-slate-50`}>
                قاعدة الفنادق
              </Link>
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative block min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-[#D4AF37]"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم، التصنيف، الدولة، جهة الاتصال، الهاتف، البريد، أو الخدمات…"
              className={`${CONTROL_FIELD} pr-10`}
              autoComplete="off"
            />
          </label>
          <label className="relative flex w-full shrink-0 items-center md:w-[min(100%,280px)]">
            <Globe
              className="pointer-events-none absolute right-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-[#D4AF37]"
              aria-hidden
            />
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              aria-label="تصفية حسب الدولة"
              className={`${CONTROL_FIELD} cursor-pointer appearance-none pl-4 pr-10`}
            >
              <option value="">كل الدول (VIP)</option>
              {countryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.flag ? `${c.flag} ` : ''}
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200"
          >
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className={`flex min-h-[220px] flex-col items-center justify-center gap-3 py-14 ${CARD}`}>
            <Loader2 className="h-8 w-8 animate-spin text-slate-400 dark:text-[#D4AF37]" aria-hidden />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">جاري تحميل الموردين…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className={`${CARD} border-dashed px-6 py-14 text-center`}>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {rows.length === 0
                ? 'لا يوجد موردون مسجّلون بعد، أو لا تتوفر صلاحية القراءة لهذا الجدول.'
                : 'لا توجد نتائج مطابقة لبحثك أو للدولة المختارة.'}
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C]">
              <table className="min-w-full text-right text-sm">
                <thead className="bg-slate-50 text-sm font-semibold text-slate-600 dark:bg-[#1A2421] dark:text-slate-300">
                  <tr className="border-b border-slate-200 dark:border-[#2D3F3A]">
                    <th className="whitespace-nowrap px-4 py-3">المورد</th>
                    <th className="whitespace-nowrap px-4 py-3">التصنيف</th>
                    <th className="whitespace-nowrap px-4 py-3">الدولة</th>
                    <th className="whitespace-nowrap px-4 py-3">جهة الاتصال</th>
                    <th className="whitespace-nowrap px-4 py-3">الهاتف</th>
                    <th className="whitespace-nowrap px-4 py-3">البريد</th>
                    <th className="whitespace-nowrap px-4 py-3">الخدمات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-[#2D3F3A] dark:hover:bg-[#2A3834]/50"
                    >
                      <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-gray-100">
                        {r.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className={CATEGORY_BADGE}>{r.category || 'عام'}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-900 dark:text-gray-100">
                        {r.country || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-900 dark:text-gray-100">
                        {r.contact_person || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-900 dark:text-gray-100">
                        {r.phone ? (
                          <a
                            href={`tel:${r.phone.replace(/\s+/g, '')}`}
                            className="font-medium underline decoration-slate-300 underline-offset-2 hover:text-slate-700 dark:decoration-[#2D3F3A] dark:hover:text-[#D4AF37]"
                            dir="ltr"
                          >
                            {r.phone}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-900 dark:text-gray-100">
                        {r.email ? (
                          <a
                            href={`mailto:${r.email}`}
                            className="break-all font-medium underline decoration-slate-300 underline-offset-2 hover:text-slate-700 dark:decoration-[#2D3F3A] dark:hover:text-[#D4AF37]"
                            dir="ltr"
                          >
                            {r.email}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="max-w-xs px-4 py-3.5 text-slate-600 dark:text-gray-300">
                        <span className="line-clamp-2">{r.services_provided || '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        )}
      </div>
    </div>
  )
}
