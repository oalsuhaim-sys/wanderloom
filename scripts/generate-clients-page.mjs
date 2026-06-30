import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function transformSnippet(s) {
  let o = s.replace(/\r\n/g, '\n')

  o = o.replace(
    /setError\(\s*\n\s*'Supabase[\s\S]*?NEXT_PUBLIC_SUPABASE_ANON_KEY\.',\s*\n\s*\)/m,
    'setError(ar.supabaseErr)',
  )

  o = o.replace(
    /setError\(err\.message \|\| '[^']*'\)/,
    'setError(err.message || ar.loadErr)',
  )

  o = o.replace(
    /if \(err\) \{\n        setError\(\n          schemaError\(err\.message \?\? ''\)\n            \? '[^']*'\n            : err\.message \|\| '[^']*',\n        \)\n        setSaving\(false\)\n        return\n      \}/,
    `if (err) {\n        setError(\n          schemaError(err.message ?? '')\n            ? ar.updateSchemaErr\n            : err.message || ar.updateErr,\n        )\n        setSaving(false)\n        return\n      }`,
  )

  o = o.replace(
    /if \(err \|\| !data\) \{\n        const msg = err\?\.message \?\? ''\n        setError\(\n          schemaError\(msg\)\n            \? '[^']*'\n            : err\?\.message \|\| '[^']*',\n        \)\n        setSaving\(false\)\n        return\n      \}/,
    `if (err || !data) {\n        const msg = err?.message ?? ''\n        setError(\n          schemaError(msg)\n            ? ar.insertSchemaErr\n            : err?.message || ar.insertErr,\n        )\n        setSaving(false)\n        return\n      }`,
  )

  o = o.replace(
    /setError\('[^']*' \+ code\)/,
    'setError(ar.copyFail + code)',
  )

  o = o.replace(
    /setCopyToast\('[^']*'\)/,
    'setCopyToast(ar.copyOk)',
  )

  o = o.replace(
    /(<h1 className="text-3xl font-black tracking-tight text-\[#001f3f\] md:text-\[2rem\]">\s*)[^<]+(\s*<\/h1>)/,
    '$1{ar.title}$2',
  )

  o = o.replace(
    /(<p className="max-w-lg text-sm font-semibold leading-relaxed text-slate-600">\s*)[^<]+(\s*<\/p>)/,
    '$1{ar.subtitle}$2',
  )

  o = o.replace(
    /(<Crown className="h-3\.5 w-3\.5 text-\[#d4af37\]" aria-hidden \/>\s*)\n\s*[^\n]+\n/,
    '$1\n                {ar.loyalty}\n',
  )

  o = o.replace(
    /(<Plus className="h-5 w-5 text-\[#d4af37\]" aria-hidden \/>\s*)\n\s*[^\n]+\n(\s*<\/button>)/,
    '$1\n              {ar.addBtn}\n$2',
  )

  let phIdx = 0
  o = o.replace(/placeholder="[^"]*"/g, (m) => {
    phIdx += 1
    if (phIdx === 1) return 'placeholder={ar.searchPh}'
    return m
  })

  o = o.replace(
    /\{filtered\.length\} \?\? \{clients\.length\} [^\n]+/,
    "{ar.resultCount.replace('{n}', String(filtered.length)).replace('{m}', String(clients.length))}",
  )

  o = o.replace(
    /<Loader2 className="h-10 w-10 animate-spin text-\[#001f3f\]" aria-hidden \/>\s*\n\s*<p className="text-sm font-semibold text-slate-500">[^<]+<\/p>/,
    '<Loader2 className="h-10 w-10 animate-spin text-[#001f3f]" aria-hidden />\n            <p className="text-sm font-semibold text-slate-500">{ar.loading}</p>',
  )

  o = o.replace(
    /clients\.length === 0\n\s*\? '[^']*'\n\s*: '[^']*'/,
    'clients.length === 0\n              ? ar.empty\n              : ar.noMatch',
  )

  o = o.replace(
    /<span className="text-xs text-gray-400">[^<]+<\/span>/,
    '<span className="text-xs text-gray-400">{ar.noContact}</span>',
  )

  o = o.replace(
    /(<span aria-hidden>\{'\\u2708\\uFE0F'\}<\/span>\n\s*)[^\n]+/,
    '$1{ar.trips}: {c.total_trips}',
  )

  o = o.replace(
    /(<span aria-hidden>\{'\\uD83E\\uDD1D'\}<\/span>\n\s*)[^\n]+/,
    '$1{ar.referrals}: {c.referrals_count}',
  )

  o = o.replace(
    /<span className="shrink-0 text-\[10px\] font-black uppercase tracking-wide text-\[#001f3f\]\/70">\s*[^<]+<\/span>/,
    '<span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-[#001f3f]/70">{ar.refCode}</span>',
  )

  o = o.replace(
    /<p className="mt-3 text-\[11px\] font-semibold text-gray-400">[^<]+<\/p>/,
    '<p className="mt-3 text-[11px] font-semibold text-gray-400">{ar.noRef}</p>',
  )

  o = o.replace(
    /title="[^"]+"\n\s*aria-label="[^"]+"/,
    'title={ar.copyRef}\n                        aria-label={ar.copyRef}',
  )


  o = o.replace(/title="Flight Prefs"/g, 'title={ar.dnaFlight}')
  o = o.replace(/title="Hotel Prefs"/g, 'title={ar.dnaHotel}')
  o = o.replace(/title="Dietary"/g, 'title={ar.dnaDietary}')
  o = o.replace(/title="Secret Notes"/g, 'title={ar.dnaSecret}')

  o = o.replace(
    /(<Pencil className="h-3\.5 w-3\.5 text-\[#d4af37\]" aria-hidden \/>\s*)\n\s*[^\n]+\n(\s*<\/button>\s*\n\s*<\/div>\s*\n\s*<\/article>)/,
    '$1\n                    {ar.edit}\n$2',
  )

  o = o.replace(/\{isEditing \? '[^']*' : '[^']*'\}/, '{isEditing ? ar.editTitle : ar.addTitle}')

  o = o.replace(
    /<p className="mt-1 text-xs font-semibold text-slate-500">\s*[^<]+<\/p>\n\s*<\/div>\n\s*<button\n\s*type="button"\n\s*onClick=\{closeModal\}/,
    '<p className="mt-1 text-xs font-semibold text-slate-500">{ar.modalHint}</p>\n              </div>\n              <button\n                type="button"\n                onClick={closeModal}',
  )

  o = o.replace(/aria-label="\?\?\?\?\?"/, 'aria-label={ar.close}')

  o = o.replace(
    /<span className="mb-1\.5 block text-xs font-bold text-\[#001f3f\]">[^<]*\*<\/span>\n\s*<input\n\s*value=\{form\.full_name\}/,
    '<span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.fullName}</span>\n                <input\n                  value={form.full_name}',
  )

  o = o.replace(
    /<p className="text-xs font-black text-\[#001f3f\]">[^<]+<\/p>\n\s*<label className="block">\n\s*<span className="mb-1\.5 block text-xs font-bold text-\[#001f3f\]">[^<]+<\/span>\n\s*<select\n\s*value=\{form\.client_tier\}/,
    '<p className="text-xs font-black text-[#001f3f]">{ar.loyaltySection}</p>\n                <label className="block">\n                  <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.tier}</span>\n                  <select\n                    value={form.client_tier}',
  )

  o = o.replace(
    /<span className="mb-1\.5 block text-xs font-bold text-\[#001f3f\]">[^<]+<\/span>\n\s*<input\n\s*type="number"\n\s*min=\{0\}\n\s*value=\{form\.total_trips\}/,
    '<span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.trips}</span>\n                    <input\n                      type="number"\n                      min={0}\n                      value={form.total_trips}',
  )

  o = o.replace(
    /<span className="mb-1\.5 block text-xs font-bold text-\[#001f3f\]">[^<]+<\/span>\n\s*<input\n\s*type="number"\n\s*min=\{0\}\n\s*value=\{form\.referrals_count\}/,
    '<span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.referrals}</span>\n                    <input\n                      type="number"\n                      min={0}\n                      value={form.referrals_count}',
  )

  o = o.replace(
    /<span className="mb-1\.5 block text-xs font-bold text-\[#001f3f\]">[^<]+<\/span>\n\s*<input\n\s*value=\{form\.referral_code\}/,
    '<span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.refCode}</span>\n                  <input\n                    value={form.referral_code}',
  )

  o = o.replace(
    /<span className="mb-1\.5 block text-xs font-bold text-\[#001f3f\]">[^<]+<\/span>\n\s*<input\n\s*value=\{form\.phone_number\}/,
    '<span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.phone}</span>\n                  <input\n                    value={form.phone_number}',
  )

  o = o.replace(
    /<span className="mb-1\.5 block text-xs font-bold text-\[#001f3f\]">[^<]+<\/span>\n\s*<input\n\s*type="email"\n\s*value=\{form\.email\}/,
    '<span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.email}</span>\n                  <input\n                    type="email"\n                    value={form.email}',
  )

  o = o.replace(
    /<span className="mb-1\.5 block text-xs font-bold text-\[#001f3f\]">Flight Prefs<\/span>/,
    '<span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.dnaFlight}</span>',
  )

  o = o.replace(
    /<span className="mb-1\.5 block text-xs font-bold text-\[#001f3f\]">Hotel Prefs<\/span>/,
    '<span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.dnaHotel}</span>',
  )

  o = o.replace(
    /<span className="mb-1\.5 block text-xs font-bold text-\[#001f3f\]">Dietary<\/span>/,
    '<span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.dnaDietary}</span>',
  )

  o = o.replace(
    /<span className="mb-1\.5 block text-xs font-bold text-\[#001f3f\]">Secret Notes<\/span>/,
    '<span className="mb-1.5 block text-xs font-bold text-[#001f3f]">{ar.dnaSecret}</span>',
  )

  o = o.replace(
    /<Loader2 className="h-4 w-4 animate-spin" aria-hidden \/>\s*\n\s*[^\n]+\n/,
    '<Loader2 className="h-4 w-4 animate-spin" aria-hidden />\n                    {ar.saving}\n',
  )

  o = o.replace(
    /\) : isEditing \? \(\s*\n\s*'[^']*'\s*\n\s*\) : \(\s*\n\s*'[^']*'\s*\n\s*\)\}/,
    ') : isEditing ? (\n                  ar.saveEdit\n                ) : (\n                  ar.saveNew\n                )}',
  )

  o = o.replace(
    /<button\n\s*type="button"\n\s*onClick=\{closeModal\}\n\s*disabled=\{saving\}\n\s*className="rounded-2xl border border-gray-200 bg-gray-50[^>]*>\s*\n\s*[^\n]+\n\s*<\/button>/,
    '<button\n                type="button"\n                onClick={closeModal}\n                disabled={saving}\n                className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-3.5 text-sm font-bold text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"\n              >\n                {ar.cancel}\n              </button>',
  )

  o = o.replace(
    /transition hover:text-\[#001f3f\]"\n\s*>\n\s*[^\n]+\n\s*<\/Link>/,
    'transition hover:text-[#001f3f]"\n                  >\n                    {ar.openProfile}\n                  </Link>',
  )

  return o
}

const header = `'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Building2,
  ChevronDown,
  Copy,
  Crown,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Phone,
  Plane,
  Plus,
  Search,
  UtensilsCrossed,
  X,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import {
  buildClientInsertPayload,
  buildClientUpdatePayload,
  CLIENT_TIER_OPTIONS,
  normalizeVipClient,
  tierBadgeClassName,
  tierDisplayLabel,
  type ClientTier,
  type VipClientProfile,
} from '@/lib/clientsTravelDna'
`


const ar = JSON.parse(fs.readFileSync(path.join(__dirname, 'clients-page-ar.json'), 'utf8'))

const baselinePath = path.join(__dirname, '_clients_baseline.tsx')
const snippet = transformSnippet(fs.readFileSync(baselinePath, 'utf8'))

const outPath = path.join(__dirname, '..', 'src', 'app', 'crm', 'clients', 'page.tsx')
const arLiteral = `const ar = ${JSON.stringify(ar, null, 2)} as const\n\n`

fs.writeFileSync(outPath, `${header.trimEnd()}\n\n${arLiteral}${snippet}`, 'utf8')
console.log('Wrote', outPath)

