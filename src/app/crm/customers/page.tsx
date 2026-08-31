'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type CustomerRow = {
  id: string
  full_name: string
  email?: string | null
  phone_wa: string
  tags?: string[] | null
  [key: string]: unknown
}

function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((t) => String(t ?? '').trim()).filter(Boolean)
}

function waDigits(phone: string | null | undefined): string {
  return String(phone ?? '').replace(/\D/g, '')
}

const AVAILABLE_TAGS = [
  'VIP 🌟',
  'عائلة 👨‍👩‍👧‍👦',
  'يحب الفخامة 💎',
  'عريس 💍',
  'ميزانية مفتوحة 💰',
  'يكره الترانزيت ✈️',
  'مغامر 🧗‍♂️',
  'اقتصادي 💵',
]

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null)

  const fetchCustomers = async () => {
    if (!supabase) {
      setError('Supabase غير مهيأ. تأكد من NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase.from('customers').select('*').order('created_at', { ascending: false })

    if (err) {
      setError(err.message || 'تعذر تحميل العملاء.')
      setCustomers([])
    } else {
      setCustomers((data as CustomerRow[]) || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    void fetchCustomers()
  }, [])

  const handleAddTag = async (customerId: string, currentTags: unknown, newTag: string) => {
    if (!supabase) return
    const safeTags = normalizeTags(currentTags)
    if (safeTags.includes(newTag)) return

    const updatedTags = [...safeTags, newTag]

    setCustomers((prev) => prev.map((c) => (c.id === customerId ? { ...c, tags: updatedTags } : c)))
    setSelectedCustomer((prev) => (prev && prev.id === customerId ? { ...prev, tags: updatedTags } : prev))

    const { error: upErr } = await supabase.from('customers').update({ tags: updatedTags }).eq('id', customerId)
    if (upErr) {
      setError(
        upErr.message ||
          'تعذر حفظ الوسم. نفّذ سكربت supabase/sql/customers_tags.sql في قاعدة البيانات إن لم يكن عمود tags موجوداً.',
      )
      void fetchCustomers()
    }
  }

  const handleRemoveTag = async (customerId: string, currentTags: unknown, tagToRemove: string) => {
    if (!supabase) return
    const safeTags = normalizeTags(currentTags)
    const updatedTags = safeTags.filter((tag) => tag !== tagToRemove)

    setCustomers((prev) => prev.map((c) => (c.id === customerId ? { ...c, tags: updatedTags } : c)))
    setSelectedCustomer((prev) => (prev && prev.id === customerId ? { ...prev, tags: updatedTags } : prev))

    const { error: upErr } = await supabase.from('customers').update({ tags: updatedTags }).eq('id', customerId)
    if (upErr) {
      setError(upErr.message || 'تعذر حذف الوسم.')
      void fetchCustomers()
    }
  }

  if (loading) {
    return <div className="min-h-screen p-4 text-center text-gray-500 sm:p-6">جاري تحميل بيانات العملاء...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans sm:p-6" dir="rtl">
      {error ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-900">{error}</div>
      ) : null}

      <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-extrabold text-gray-900">إدارة العملاء 👥</h1>
          <p className="text-gray-500">ابنِ ملفاً شخصياً (DNA) لكل عميل لتقديم خدمة لا تُنسى</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {customers.map((customer) => {
          const tags = normalizeTags(customer.tags)
          const wa = waDigits(customer.phone_wa)
          const displayName = customer.full_name?.trim() || '—'

          return (
            <div key={customer.id} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-lg">
              <div className="mb-4 flex items-start gap-4 border-b border-gray-50 pb-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-600">
                  {displayName.charAt(0) || 'ع'}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-gray-900">{displayName}</h3>
                  <p className="whitespace-nowrap text-sm text-gray-500" dir="ltr">
                    {customer.phone_wa || '—'}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">الـ DNA السياحي للعميل</h4>
                <div className="mb-4 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => void handleRemoveTag(customer.id, tags, tag)}
                        className="text-indigo-400 hover:text-red-500"
                        aria-label="حذف الوسم"
                      >
                        ✕
                      </button>
                    </span>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(customer)
                      setIsModalOpen(true)
                    }}
                    className="rounded-full border border-dashed border-gray-300 bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-500 transition hover:bg-gray-200"
                  >
                    + إضافة وسم
                  </button>
                </div>
              </div>

              <div className="mt-4 flex gap-2 border-t border-gray-50 pt-4">
                <a
                  href={wa ? `https://wa.me/${wa}` : '#'}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex-1 rounded-xl py-2 text-center text-sm font-bold transition ${
                    wa ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'cursor-not-allowed bg-gray-100 text-gray-400'
                  }`}
                  onClick={(e) => {
                    if (!wa) e.preventDefault()
                  }}
                >
                  مراسلة واتساب
                </a>
              </div>
            </div>
          )
        })}
      </div>

      {isModalOpen && selectedCustomer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-[95%] max-h-[90vh] max-w-md overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl sm:p-6">
            <h2 className="mb-2 text-xl font-bold">إضافة وسم للعميل: {selectedCustomer.full_name?.trim() || '—'}</h2>
            <p className="mb-6 text-sm text-gray-500">اختر الصفات التي تميز هذا العميل لتسهيل خدمته مستقبلاً.</p>

            <div className="mb-8 flex flex-wrap gap-3">
              {AVAILABLE_TAGS.map((tag) => {
                const selTags = normalizeTags(selectedCustomer.tags)
                const hasTag = selTags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    disabled={hasTag}
                    onClick={() => {
                      void handleAddTag(selectedCustomer.id, selTags, tag)
                      setIsModalOpen(false)
                    }}
                    className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                      hasTag
                        ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                        : 'border-gray-300 bg-white text-gray-700 shadow-sm hover:border-indigo-500 hover:text-indigo-600'
                    }`}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="w-full rounded-xl bg-gray-100 py-3 font-bold text-gray-700 transition hover:bg-gray-200"
            >
              إغلاق
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
