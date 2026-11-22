'use client'

import { useState } from 'react'
import { Loader2, MessageCircle } from 'lucide-react'

import { RV } from './route-utils'

/** «ملاحظة» pill — next to «وثّق اللحظة» in the stop's panel. */
export function StopNoteButton({ hasNote, open, onClick }: { hasNote: boolean; open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-black transition active:scale-95"
      style={{ borderColor: RV.lineStrong, background: RV.goldTint, color: RV.cream }}
    >
      <MessageCircle className="h-3.5 w-3.5" aria-hidden />
      {hasNote ? 'ملاحظتك' : 'ملاحظة'}
    </button>
  )
}

/** The client's note on a stop: shown when saved, editable in place. */
export function StopNoteEditor({
  value,
  open,
  onClose,
  onSave,
}: {
  value: string | undefined
  open: boolean
  onClose: () => void
  onSave: (note: string) => Promise<boolean>
}) {
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!open) {
    return value ? (
      <p className="mt-2 rounded-xl px-3 py-2 text-[12.5px] leading-relaxed" style={{ background: RV.goldTint, color: RV.text2 }}>
        <span className="font-black" style={{ color: RV.goldText }}>
          ملاحظتك:{' '}
        </span>
        {value}
      </p>
    ) : null
  }

  const save = async () => {
    setSaving(true)
    setFailed(false)
    const ok = await onSave(draft)
    setSaving(false)
    if (ok) onClose()
    else setFailed(true)
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="كيف كانت تجربتك هنا؟ اكتب رأيك أو أي ملاحظة لخبيرك…"
        className="w-full rounded-xl border px-3 py-2 text-[13px] leading-relaxed outline-none"
        style={{ borderColor: RV.lineStrong, background: RV.card, color: RV.cream }}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-black disabled:opacity-60"
          style={{ background: RV.gold, color: RV.onGold }}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          حفظ الملاحظة
        </button>
        <button type="button" onClick={onClose} className="px-2 text-xs font-bold" style={{ color: RV.muted }}>
          إلغاء
        </button>
        {failed ? (
          <span className="text-xs font-bold" style={{ color: RV.goldText }}>
            تعذر الحفظ، حاول مرة أخرى
          </span>
        ) : null}
      </div>
    </div>
  )
}
