import type { SupabaseClient } from '@supabase/supabase-js'

export type GroupTripLeaderOption = {
  id: string
  name: string
  role: 'leader'
}

function pickClientName(raw: Record<string, unknown>): string {
  return String(raw.name ?? raw.full_name ?? '').trim()
}

export function parseGroupTripLeaderOption(raw: Record<string, unknown>): GroupTripLeaderOption | null {
  const id = raw.id
  if (id == null || id === '') return null

  const name = pickClientName(raw)
  if (!name) return null

  return { id: String(id), name, role: 'leader' }
}

export function groupTripLeaderRoleLabel(_role: GroupTripLeaderOption['role']): string {
  return 'ليدر'
}

export function groupTripLeaderRoleEmoji(_role: GroupTripLeaderOption['role']): string {
  return '🚀'
}

/** جلب الليدرز فقط — clients.is_leader = true */
export async function fetchGroupTripLeaderOptions(
  supabase: SupabaseClient,
): Promise<{ options: GroupTripLeaderOption[]; error: string | null }> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, full_name')
    .eq('is_leader', true)
    .order('name', { ascending: true })

  if (error) {
    return { options: [], error: error.message }
  }

  const options = ((data ?? []) as Record<string, unknown>[])
    .map(parseGroupTripLeaderOption)
    .filter((row): row is GroupTripLeaderOption => row != null)
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))

  return { options, error: null }
}

export function resolveGroupTripLeaderName(
  leaderId: string,
  options: GroupTripLeaderOption[] | null | undefined,
  fallbackName?: string | null,
): string | null {
  const id = leaderId.trim()
  if (!id) return null
  const safeOptions = Array.isArray(options) ? options : []
  return safeOptions.find((l) => l.id === id)?.name.trim() || fallbackName?.trim() || null
}

export function parseGroupTripLeaderIdForDb(leaderId: string): number | null {
  const raw = leaderId.trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/** يضمن ظهور الليدر الحالي في القائمة عند التعديل حتى لو تغيّرت الأعلام */
export function withAssignedLeaderOption(
  options: GroupTripLeaderOption[] | null | undefined,
  leaderId: string | number | null | undefined,
  leaderName: string | null | undefined,
): GroupTripLeaderOption[] {
  const safeOptions = Array.isArray(options) ? options : []
  const id = leaderId != null ? String(leaderId).trim() : ''
  const name = String(leaderName ?? '').trim()
  if (!id || !name) return safeOptions
  if (safeOptions.some((o) => o.id === id)) return safeOptions
  return [{ id, name, role: 'leader' }, ...safeOptions]
}
