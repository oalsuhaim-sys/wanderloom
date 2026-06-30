'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Globe, Handshake, Loader2, Search, ShieldCheck } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { VIP_COUNTRIES } from '@/utils/countries'

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

function matchesCountryFilter(countryStored: string, filterId: string): boolean {
  if (!filterId) return true
  const raw = countryStored.trim().toLowerCase()
  if (!raw) return false
  const vip = VIP_COUNTRIES.find((c) => c.id === filterId)
  if (!vip) return false
  return raw === vip.labelAr.toLowerCase() || raw === vip.id.toLowerCase()
}

const CONTROL_FIELD =
  'h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-[#001f3f]/35 focus:ring-2 focus:ring-[#d4af37]/40 focus:ring-offset-2 focus:ring-offset-[#F6F4F0] [color-scheme:light]'

export default function SuppliersPage() {
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
      if (!matchesCountryFilter(r.country, countryFilter)) return false
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
  }, [rows, search, countryFilter])

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-[#F6F4F0] to-[#EDE8DD] pb-14 font-sans text-gray-900">
      <div className="mx-auto max-w-7xl px-4 pt-2">
        <header className="mb-8 rounded-3xl border border-amber-200/60 bg-gradient-to-br from-white via-white to-amber-50/80 p-8 shadow-[0_22px_60px_-24px_rgba(28,69,50,0.35)]">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <p className="inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-amber-100/70 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#6B561C]">
                <Handshake className="h-3.5 w-3.5" aria-hidden />
                CRM الداخلي
              </p>
              <h1 className="text-3xl font-black tracking-tight text-gray-900 md:text-[2.1rem]">🌍 دليل الموردين</h1>
              <p className="max-w-xl text-base font-semibold leading-relaxed text-slate-600">
                شبكة الموثوق بهم: فنادق، نقالات، دلائل، وفاعليات — بيانات حية من جدول{' '}
                <code className="rounded bg-white/90 px-1.5 py-0.5 font-mono text-[13px] text-emerald-900">suppliers</code>.
              </p>
            </div>
            <div className="flex flex-shrink-0 flex-col gap-3 sm:items-end">
              <div className="flex flex-shrink-0 items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-sm font-bold text-slate-800 shadow-inner">
                <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                {loading ? (
                  <span className="flex items-center gap-2 text-slate-600">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    جاري المزامنة…
                  </span>
                ) : (
                  <span>
                    <strong className="text-[#1C4532]">{filtered.length}</strong>
                    <span className="mx-1 text-slate-500">/</span>
                    <span className="text-slate-600">{rows.length} مورد</span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/crm/destinations"
                  className="inline-flex rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black text-gray-900 shadow-sm transition hover:border-amber-400/60 hover:shadow-md sm:text-sm"
                >
                  دليل الوجهات
                </Link>
                <Link
                  href="/crm/hotels"
                  className="inline-flex rounded-2xl bg-gradient-to-r from-[#1C4532] to-[#274d3f] px-4 py-2.5 text-xs font-black text-amber-100 shadow-md transition hover:brightness-110 sm:text-sm"
                >
                  قاعدة الفنادق
                </Link>
              </div>
            </div>
          </div>
        </header>

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:gap-4">
          <label className="relative block min-h-12 min-w-0 flex-1">
            <Search className="pointer-events-none absolute right-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#001f3f]/35" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم، التصنيف، الدولة، جهة الاتصال، الهاتف، البريد، أو الخدمات…"
              className={`${CONTROL_FIELD} pr-11`}
              autoComplete="off"
            />
          </label>
          <label className="relative flex min-h-12 w-full shrink-0 items-center md:w-[min(100%,280px)]">
            <Globe className="pointer-events-none absolute right-3.5 top-1/2 z-[1] h-[18px] w-[18px] -translate-y-1/2 text-[#001f3f]/35" aria-hidden />
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              aria-label="تصفية حسب الدولة"
              className={`${CONTROL_FIELD} cursor-pointer appearance-none pr-10 pl-4`}
            >
              <option value="">كل الدول (VIP)</option>
              {VIP_COUNTRIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.labelAr}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-900"
          >
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200/80 bg-white/70 py-14 shadow-sm">
            <Loader2 className="h-9 w-9 animate-spin text-[#001f3f]" aria-hidden />
            <p className="text-sm font-semibold tracking-wide text-slate-500">جاري تحميل الموردين…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[38vh] flex-col items-center justify-center px-6 py-12 text-center">
            <p className="max-w-md text-sm font-medium leading-relaxed text-slate-500">
              {rows.length === 0
                ? 'لا يوجد موردون مسجّلون بعد، أو لا تتوفر صلاحية القراءة لهذا الجدول.'
                : 'لا توجد نتائج مطابقة لبحثك أو للدولة المختارة.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <article
                key={r.id}
                className="flex flex-col rounded-2xl bg-white p-6 shadow-md transition-shadow duration-300 hover:shadow-lg"
              >
                <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="text-lg font-bold leading-snug text-[#001f3f]">{r.name}</h2>
                    {r.country ? (
                      <p className="text-xs font-semibold tracking-wide text-gray-400">{r.country}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-full bg-[#d4af37] px-3 py-1 text-center text-xs font-bold text-white shadow-sm">
                    {r.category || 'عام'}
                  </span>
                </header>

                <div className="flex flex-col gap-3 text-sm text-gray-900">
                  <div className="flex items-baseline gap-2.5">
                    <span className="shrink-0 text-base leading-none" aria-hidden>
                      👤
                    </span>
                    <span className="min-w-0 font-semibold leading-relaxed">{r.contact_person || '—'}</span>
                  </div>
                  <div className="flex items-baseline gap-2.5">
                    <span className="shrink-0 text-base leading-none" aria-hidden>
                      📞
                    </span>
                    {r.phone ? (
                      <a
                        href={`tel:${r.phone.replace(/\s+/g, '')}`}
                        className="min-w-0 font-mono font-semibold text-[#001f3f] underline decoration-[#d4af37]/50 underline-offset-2 transition hover:text-[#001f3f]/80 ltr:text-left"
                        dir="ltr"
                      >
                        {r.phone}
                      </a>
                    ) : (
                      <span className="font-semibold text-gray-400">—</span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2.5">
                    <span className="shrink-0 text-base leading-none" aria-hidden>
                      ✉️
                    </span>
                    {r.email ? (
                      <a
                        href={`mailto:${r.email}`}
                        className="min-w-0 break-all font-semibold text-[#001f3f] underline decoration-[#d4af37]/50 underline-offset-2 transition hover:text-[#001f3f]/80 ltr:text-left"
                        dir="ltr"
                      >
                        {r.email}
                      </a>
                    ) : (
                      <span className="font-semibold text-gray-400">—</span>
                    )}
                  </div>
                </div>

                <hr className="my-5 border-t border-gray-100" />

                <p className="text-sm leading-relaxed text-gray-500">
                  <span className="font-semibold text-gray-400">الخدمات: </span>
                  {r.services_provided || '—'}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
