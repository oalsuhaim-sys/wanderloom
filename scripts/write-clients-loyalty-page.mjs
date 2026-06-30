import fs from 'node:fs'

const out = new URL('../src/app/crm/clients/page.tsx', import.meta.url)

const page = `'use client'

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

const CRM_FIELD =
  'w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#001f3f]/40 focus:ring-2 focus:ring-[#d4af37]/45 [color-scheme:light]'

const CLIENT_SELECT =
  'id, name, full_name, phone_wa, phone_number, email, flight_preferences, hotel_preferences, dietary, secret_notes, travel_dna, created_at, client_tier, total_trips, referrals_count, referral_code, ref_code'

const EMPTY_FORM = {
  full_name: '',
  phone_number: '',
  email: '',
  flight_preferences: '',
  hotel_preferences: '',
  dietary: '',
  secret_notes: '',
  client_tier: 'regular' as ClientTier,
  total_trips: 0,
  referrals_count: 0,
  referral_code: '',
}

function clientToForm(c: VipClientProfile) {
  return {
    full_name: c.full_name,
    phone_number: c.phone_number,
    email: c.email ?? '',
    flight_preferences: c.flight_preferences,
    hotel_preferences: c.hotel_preferences,
    dietary: c.dietary,
    secret_notes: c.secret_notes,
    client_tier: c.client_tier,
    total_trips: c.total_trips,
    referrals_count: c.referrals_count,
    referral_code: c.referral_code,
  }
}

function CollapsibleSection({
  title,
  icon,
  children,
  muted = false,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
  muted?: boolean
}) {
  const [open, setOpen] = useState(false)
  const text = String(children ?? '').trim()
  const hasContent = Boolean(text && text !== '\\u2014')

  return (
    <motionless className="border-t border-gray-100/90 first:border-t-0">
`

fs.writeFileSync(out, page, 'utf8')
console.log('partial - use full file below')
