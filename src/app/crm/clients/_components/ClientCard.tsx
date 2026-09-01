'use client'

import {
  Crown,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Trash2,
} from 'lucide-react'

import ClientPaymentWhatsAppButton from '@/app/crm/clients/_components/ClientPaymentWhatsAppButton'
import ClientSalesStageControl from '@/app/crm/clients/_components/ClientSalesStageControl'
import {
  clientDisplayTierBadge,
  engagementDotClass,
  engagementStatusLabel,
  formatSarClv,
  parseTravelDnaChips,
  resolveClientLifetimeValue,
} from '@/lib/client-crm-profile'
import { whatsAppHref } from '@/lib/crm-lead-actions'
import { CRM_CARD_INTERACTIVE, partnerInitials } from '@/lib/crm-luxury-ui'
import {
  activityLevelBadgeClass,
  parseDnaInterests,
  resolveClientDnaDisplay,
  type VipClientProfile,
} from '@/lib/clientsTravelDna'

export type ClientCardProps = {
  client: VipClientProfile
  trips: number
  deletingId?: string | null
  manageProfileLabel?: string
  noContactLabel?: string
  editLabel?: string
  deleteLabel?: string
  onOpenProfile: (client: VipClientProfile) => void
  onEdit: (client: VipClientProfile) => void
  onDelete: (client: VipClientProfile) => void
  onSalesStageUpdated: (clientId: string, stage: string) => void
}

/** CRM directory card — reads DNA directly from the `clients` row (with travel_dna fallbacks). */
export default function ClientCard({
  client,
  trips,
  deletingId = null,
  manageProfileLabel = 'إدارة الملف',
  noContactLabel = 'لا توجد بيانات اتصال',
  editLabel = 'تعديل',
  deleteLabel = 'حذف',
  onOpenProfile,
  onEdit,
  onDelete,
  onSalesStageUpdated,
}: ClientCardProps) {
  const tier = clientDisplayTierBadge(client)
  const clv = resolveClientLifetimeValue(client)
  const displayName = client.name?.trim() || '—'
  const dna = resolveClientDnaDisplay(client)
  const interestTags = parseDnaInterests(dna.dna_interests)
  const activity = dna.dna_activity_level?.trim()
  const dnaChips = parseTravelDnaChips({
    travel_dna: client.travel_dna,
    dna_interests: client.dna_interests,
    dna_activity_level: client.dna_activity_level,
    food_allergies: client.food_allergies,
    dietary: client.dietary,
    tags: client.tags,
  })
  const engagement = client.engagement_status
  const wa = client.phone_wa?.trim() ? whatsAppHref(client.phone_wa) : null

  return (
    <article
      className={`group relative flex cursor-pointer flex-col items-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-[#2D3F3A] dark:bg-[#22302C] ${CRM_CARD_INTERACTIVE}`}
      onClick={() => onOpenProfile(client)}
    >
      <div className="relative mb-4">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xl font-bold text-slate-700 dark:border-[#D4AF37]/30 dark:bg-[#1A2421] dark:text-[#D4AF37]"
          aria-hidden
        >
          {partnerInitials(displayName)}
        </div>
        {engagement ? (
          <span
            className={`absolute bottom-1 left-1 h-3.5 w-3.5 rounded-full ring-2 ring-white dark:ring-[#22302C] ${engagementDotClass(engagement)} animate-pulse`}
            title={engagementStatusLabel(engagement)}
            aria-label={`التفاعل: ${engagementStatusLabel(engagement)}`}
          />
        ) : null}
      </div>

      <h2 className="mb-1 max-w-full truncate text-lg font-bold text-slate-900 dark:text-white">
        {displayName}
      </h2>

      <div className="mt-1 flex flex-col items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
        {client.phone_wa ? (
          <a
            href={`tel:${client.phone_wa.replace(/\s+/g, '')}`}
            dir="ltr"
            className="inline-flex items-center gap-1.5 transition hover:text-slate-800 dark:hover:text-[#D4AF37]"
            onClick={(e) => e.stopPropagation()}
          >
            <Phone className="h-3 w-3 shrink-0" aria-hidden />
            {client.phone_wa}
          </a>
        ) : null}
        {client.email ? (
          <a
            href={`mailto:${client.email}`}
            dir="ltr"
            title={client.email}
            className="inline-flex max-w-full items-center gap-1.5 truncate transition hover:text-slate-800 dark:hover:text-[#D4AF37]"
            onClick={(e) => e.stopPropagation()}
          >
            <Mail className="h-3 w-3 shrink-0" aria-hidden />
            {client.email}
          </a>
        ) : null}
        {!client.phone_wa && !client.email ? <span>{noContactLabel}</span> : null}
      </div>

      <div className="mt-3 mb-3 flex flex-wrap items-center justify-center gap-2">
        <span
          className="rounded-md border border-emerald-200/80 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300"
          dir="ltr"
          title="Lifetime Value"
        >
          {formatSarClv(clv)}
        </span>
        <span className={`inline-flex items-center gap-1 ${tier.className}`}>
          {client.client_tier === 'vip' ||
          client.client_tier === 'vvip' ||
          tier.label.includes('VIP') ? (
            <Crown className="h-3 w-3" aria-hidden />
          ) : null}
          {tier.label}
        </span>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300">
          {trips} رحلات
        </span>
        <div onClick={(e) => e.stopPropagation()}>
          <ClientSalesStageControl
            clientId={client.id}
            value={client.sales_stage ?? ''}
            compact
            className="min-w-0"
            onUpdated={(stage) => onSalesStageUpdated(client.id, stage)}
          />
        </div>
      </div>

      {activity ? (
        <div className="mb-2 flex w-full justify-center">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black ${activityLevelBadgeClass(activity)}`}
          >
            ⚡ {activity}
          </span>
        </div>
      ) : null}

      {dnaChips.length > 0 ? (
        <div className="mb-4 flex w-full flex-wrap justify-center gap-1.5">
          {dnaChips.map((chip) => (
            <span
              key={chip.key}
              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300"
            >
              {chip.label}
            </span>
          ))}
        </div>
      ) : interestTags.length > 0 ? (
        <div className="mb-4 flex w-full flex-wrap justify-center gap-1.5">
          {interestTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-slate-300"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div
        className="mt-auto flex w-full gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onOpenProfile(client)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-900 transition-all hover:bg-slate-900 hover:text-white dark:border-[#D4AF37]/50 dark:bg-transparent dark:text-[#D4AF37] dark:hover:bg-[#D4AF37]/10"
        >
          {manageProfileLabel}
        </button>
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            title="واتساب"
            aria-label={`واتساب ${displayName}`}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-600 hover:text-white dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
          </a>
        ) : (
          <ClientPaymentWhatsAppButton
            clientId={client.id}
            clientName={client.name ?? '—'}
            phone={client.phone_wa}
            targetTrip={client.target_trip}
            salesStage={client.sales_stage}
            compact
            className="!h-11 !w-11 shrink-0 !rounded-full"
          />
        )}
      </div>

      <div
        className="mt-2 flex items-center justify-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onEdit(client)}
          disabled={deletingId === client.id}
          title={editLabel}
          aria-label={`${editLabel} ${client.name ?? ''}`}
          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-[#1A2421] dark:hover:text-[#D4AF37]"
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onDelete(client)}
          disabled={deletingId === client.id}
          title={deleteLabel}
          aria-label={`${deleteLabel} ${client.name ?? ''}`}
          className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
        >
          {deletingId === client.id ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    </article>
  )
}
