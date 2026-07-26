'use server'

import { revalidatePath } from 'next/cache'

import { DEFAULT_SALES_STAGE } from '@/lib/client-sales-stage'
import {
  buildClientInsertPayload,
  clientDnaAdvancedPayload,
  sanitizeClientWritePayload,
} from '@/lib/clientsTravelDna'
import { normalizeAffiliateRef } from '@/lib/referral-url'
import { createServerSupabase } from '@/lib/supabase/server'

export type LeaderApplicationState = {
  ok: boolean
  error?: string
  message?: string
}

function s(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : ''
}

function formatInsertError(error: { message?: string; details?: string | null; code?: string | null }): string {
  const message = error.message?.trim() || 'تعذر حفظ الطلب'
  const code = error.code?.trim()
  if (code === '23505' || message.toLowerCase().includes('duplicate')) {
    return 'رقم الجوال مسجّل مسبقاً. تواصل مع فريق وندرلُوم إن كنت قدّمت طلباً سابقاً.'
  }
  return `عذراً، تعذر إرسال الطلب: ${message}`
}

async function findLeaderByReferralCode(code: string) {
  const supabase = createServerSupabase()

  const { data: leaderRow, error: leaderError } = await supabase
    .from('leaders')
    .select('id, name, referral_code, status')
    .eq('referral_code', code)
    .eq('status', 'active')
    .maybeSingle()

  if (!leaderError && leaderRow) {
    return {
      id: leaderRow.id,
      name: leaderRow.name,
      referral_code: leaderRow.referral_code,
      ref_code: leaderRow.referral_code,
      is_leader: true,
      source: 'leaders' as const,
    }
  }

  const { data, error } = await supabase
    .from('clients')
    .select('id, name, referral_code, ref_code, is_leader')
    .or(`referral_code.eq.${code},ref_code.eq.${code}`)
    .maybeSingle()

  if (error) {
    console.error('[leader-application] leader lookup failed', error)
    return null
  }
  return data
}

export async function submitLeaderApplication(formData: FormData): Promise<LeaderApplicationState> {
  try {
    const name = s(formData.get('name'))
    const phone_wa = s(formData.get('phone_wa'))
    const email = s(formData.get('email'))
    const leader_code = normalizeAffiliateRef(s(formData.get('leader_code')))

    const dna = clientDnaAdvancedPayload({
      dna_interests: s(formData.get('dna_interests')),
      dna_special_requests: s(formData.get('dna_special_requests')),
      dna_activity_level: s(formData.get('dna_activity_level')),
    })

    if (!leader_code) {
      return { ok: false, error: 'رابط الدعوة غير صالح. استخدم رابط أو باركود الشريك الذي دعاك.' }
    }

    if (!name || !phone_wa) {
      return { ok: false, error: 'الاسم ورقم الجوال مطلوبان.' }
    }

    const leader = await findLeaderByReferralCode(leader_code)
    if (!leader) {
      return { ok: false, error: 'كود الدعوة غير معروف. تأكد من الرابط أو تواصل مع شريك وندرلُوم.' }
    }

    const basePayload = buildClientInsertPayload({
      name,
      phone_wa,
      email,
      flight_seat: '',
      food_allergies: '',
      favorite_drink: '',
      hotel_preference: '',
      secret_notes: '',
      dna_interests: String(dna.dna_interests ?? ''),
      dna_special_requests: String(dna.dna_special_requests ?? ''),
      dna_activity_level: String(dna.dna_activity_level ?? ''),
      client_type: 'عميل',
      client_tier: 'regular',
      total_trips: 0,
      referrals_count: 0,
      lead_source: 'leader_referral_qr',
    })

    const payload = sanitizeClientWritePayload({
      ...basePayload,
      used_code: leader_code,
      sales_stage: DEFAULT_SALES_STAGE,
    })

    const supabase = createServerSupabase()
    const { data, error } = await supabase.from('clients').insert(payload).select('id').single()

    if (error || !data?.id) {
      console.error('[leader-application] insert failed', error)
      return { ok: false, error: formatInsertError(error ?? { message: 'unknown' }) }
    }

    await supabase.from('client_preferences').insert({ client_id: data.id })

    revalidatePath('/join')
    revalidatePath('/crm/clients')

    const leaderName = String(leader.name ?? '').trim()
    const via = leaderName ? ` عبر ${leaderName}` : ''

    return {
      ok: true,
      message: `تم استلام طلبك بنجاح${via}. سيتواصل معك فريق وندرلُوم قريباً.`,
    }
  } catch (error) {
    console.error('[leader-application] unexpected error', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'تعذر إرسال الطلب. حاول مرة أخرى.',
    }
  }
}
