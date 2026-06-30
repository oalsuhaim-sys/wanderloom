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
  const hasContent = Boolean(text && text !== '\u2014')

  return (
    <div className="border-t border-gray-100/90 first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 py-3 text-right transition hover:bg-gray-50/80"
      >
        <span className="flex items-center gap-2 text-xs font-bold tracking-wide text-[#001f3f]">
          <span className="text-[#d4af37]">{icon}</span>
          {title}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <p
            className={`pb-3 text-sm leading-relaxed ${muted ? 'italic text-gray-500' : 'text-gray-700'} ${!hasContent ? 'text-gray-400' : ''}`}
          >
            {hasContent ? children : '\u2014'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function ClientsLoyaltyPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [clients, setClients] = useState<VipClientProfile[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [copyToast, setCopyToast] = useState('')

  const loadClients = useCallback(async () => {
    setError('')
    if (!supabase) {
      setError(
        'Supabase ??? ????. ???? ?? ????? NEXT_PUBLIC_SUPABASE_URL ? NEXT_PUBLIC_SUPABASE_ANON_KEY.',
      )
      setClients([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error: err } = await supabase
      .from('clients')
      .select(CLIENT_SELECT)
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message || '???? ????? ???????.')
      setClients([])
      setLoading(false)
      return
    }

    const list = (data ?? [])
      .map((r) => normalizeVipClient(r as Record<string, unknown>))
      .filter((x): x is VipClientProfile => Boolean(x))
    setClients(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadClients()
  }, [loadClients])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => {
      const blob = [
        c.full_name,
        c.phone_number,
        c.email,
        c.flight_preferences,
        c.hotel_preferences,
        c.dietary,
        c.secret_notes,
        tierDisplayLabel(c.client_tier),
        c.referral_code,
        String(c.total_trips),
        String(c.referrals_count),
      ]
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [clients, search])

  const openAdd = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (c: VipClientProfile) => {
    setEditingId(c.id)
    setForm(clientToForm(c))
    setShowModal(true)
  }

  const closeModal = () => {
    if (saving) return
    setShowModal(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const schemaError = (msg: string) =>
    msg.includes('full_name') ||
    msg.includes('client_tier') ||
    msg.includes('referral') ||
    msg.includes('column') ||
    msg.includes('schema')

  const saveClient = async () => {
    if (!supabase) return
    if (!form.full_name.trim()) return

    setSaving(true)
    setError('')

    if (editingId) {
      const payload = buildClientUpdatePayload(form)
      const { error: err } = await supabase.from('clients').update(payload).eq('id', editingId)

      if (err) {
        setError(
          schemaError(err.message ?? '')
            ? '???? ????? ? ???? ?? ????? ?????? (client_tier? total_trips? referrals_count? referral_code) ? full_name ?? Supabase.'
            : err.message || '???? ????? ??????.',
        )
        setSaving(false)
        return
      }
    } else {
      const payload = buildClientInsertPayload(form)
      const { data, error: err } = await supabase.from('clients').insert(payload).select('id').single()

      if (err || !data) {
        const msg = err?.message ?? ''
        setError(
          schemaError(msg)
            ? '???? ????? ? ???? ??????? clients_vip_dna_columns.sql ? clients_travel_dna.sql ?????? ?????? ?? Supabase.'
            : err?.message || '???? ????? ??????.',
        )
        setSaving(false)
        return
      }

      await supabase.from('client_preferences').insert({ client_id: data.id })
    }

    closeModal()
    await loadClients()
    setSaving(false)
  }

  const copyReferralCode = async (code: string) => {
    if (!code.trim()) return
    try {
      await navigator.clipboard.writeText(code.trim())
      setCopyToast('?? ??? ??? ???????!')
      window.setTimeout(() => setCopyToast(''), 2800)
    } catch {
      setError('???? ??? ????? ? ????? ??????: ' + code)
    }
  }

  const isEditing = Boolean(editingId)

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-[#F6F4F0] via-[#FAF8F4] to-[#EDE8DD] pb-16 font-sans">
      <div className="mx-auto max-w-7xl px-4 pt-2 sm:px-6">
        <header className="mb-8 rounded-3xl border border-[#d4af37]/25 bg-gradient-to-br from-white via-white to-amber-50/50 p-8 shadow-[0_24px_64px_-28px_rgba(0,31,63,0.35)]">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-2">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#d4af37]/40 bg-[#001f3f]/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#001f3f]">
                <Crown className="h-3.5 w-3.5 text-[#d4af37]" aria-hidden />
                ???? ??????
              </p>
              <h1 className="text-3xl font-black tracking-tight text-[#001f3f] md:text-[2rem]">
                ????? ??????? ????? ??????
              </h1>
              <p className="max-w-lg text-sm font-semibold leading-relaxed text-slate-600">
                ????? ???????? ???????? ??????? ?????????? ?????? ??????? ? ?? ??? ??? DNA ??????? ??? ????.
              </p>
            </div>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#001f3f] px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-[#001f3f]/20 transition hover:bg-[#002a55] focus:outline-none focus:ring-2 focus:ring-[#d4af37] focus:ring-offset-2"
            >
              <Plus className="h-5 w-5 text-[#d4af37]" aria-hidden />
              ????? ???? ????
            </button>
          </div>
        </header>

        {error ? (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-900"
          >
            {error}
          </div>
        ) : null}

        <div className="mb-8">
          <label className="relative block">
            <Search
              className="pointer-events-none absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#d4af37]"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="??? ??????? ???????? ??? ???????? ??????? ?? ??????????"
              className={`${CRM_FIELD} h-12 pr-11`}
            />
          </label>
          {!loading ? (
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {filtered.length} ?? {clients.length} ????
            </p>
          ) : null}
        </div>

        {loading ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/80 bg-white/80 py-16 shadow-sm">
            <Loader2 className="h-10 w-10 animate-spin text-[#001f3f]" aria-hidden />
            <p className="text-sm font-semibold text-slate-500">???? ????? ????? ????????</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-20 text-center text-sm font-medium text-slate-500">
            {clients.length === 0
              ? '?? ???? ????? ??? ? ??? ??? ???? ?? ???? ?????.'
              : '?? ???? ????? ?????? ?????.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <article
                key={c.id}
                className="flex flex-col rounded-2xl border border-[#d4af37]/15 bg-white shadow-md transition-shadow duration-300 hover:shadow-lg"
              >
                <div className="border-b border-[#d4af37]/10 bg-gradient-to-l from-[#001f3f]/[0.03] to-transparent px-6 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/crm/clients/${c.id}`}
                        className="block text-lg font-bold leading-snug text-[#001f3f] transition hover:text-[#002a55]"
                      >
                        {c.full_name}
                      </Link>
                      <div className="mt-3 flex flex-col gap-1.5 text-sm font-semibold text-slate-600">
                        {c.phone_number ? (
                          <a
                            href={`tel:${c.phone_number.replace(/\s+/g, '')}`}
                            className="inline-flex items-center gap-2 text-[#001f3f] hover:underline"
                            dir="ltr"
                          >
                            <Phone className="h-4 w-4 shrink-0 text-[#d4af37]" aria-hidden />
                            <span className="ltr:text-left">{c.phone_number}</span>
                          </a>
                        ) : null}
                        {c.email ? (
                          <a
                            href={`mailto:${c.email}`}
                            className="inline-flex items-center gap-2 break-all text-[#001f3f] hover:underline"
                            dir="ltr"
                          >
                            <Mail className="h-4 w-4 shrink-0 text-[#d4af37]" aria-hidden />
                            {c.email}
                          </a>
                        ) : null}
                        {!c.phone_number && !c.email ? (
                          <span className="text-xs text-gray-400">?? ???? ?????? ?????</span>
                        ) : null}
                      </div>
                    </div>
                    <span className={tierBadgeClassName(c.client_tier)}>{tierDisplayLabel(c.client_tier)}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden>{'\u2708\uFE0F'}</span>
                      ??? ???????: {c.total_trips}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden>{'\uD83E\uDD1D'}</span>
                      ??? ????????: {c.referrals_count}
                    </span>
                  </div>

                  {c.referral_code ? (
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#d4af37]/20 bg-amber-50/60 px-3 py-2">
                      <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-[#001f3f]/70">
                        ??? ???????
                      </span>
                      <code className="min-w-0 flex-1 truncate font-mono text-sm font-bold text-[#001f3f]" dir="ltr">
                        {c.referral_code}
                      </code>
                      <button
                        type="button"
                        onClick={() => void copyReferralCode(c.referral_code)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#001f3f] text-[#d4af37] transition hover:bg-[#002a55]"
                        title="??? ??? ???????"
                        aria-label="??? ??? ???????"
                      >
                        <Copy className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] font-semibold text-gray-400">?? ???? ??? ?????</p>
                  )}
                </div>

                <div className="flex flex-1 flex-col px-5 pb-4 pt-1">
                  <CollapsibleSection title="Flight Prefs" icon={<Plane className="h-4 w-4" />}>
                    {c.flight_preferences}
                  </CollapsibleSection>
                  <CollapsibleSection title="Hotel Prefs" icon={<Building2 className="h-4 w-4" />}>
                    {c.hotel_preferences}
                  </CollapsibleSection>
                  <CollapsibleSection title="Dietary" icon={<UtensilsCrossed className="h-4 w-4" />}>
                    {c.dietary}
                  </CollapsibleSection>
                  <CollapsibleSection title="Secret Notes" icon={<Lock className="h-4 w-4" />} muted>
                    {c.secret_notes}
                  </CollapsibleSection>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-5 py-3">
                  <Link
                    href={`/crm/clients/${c.id}`}
                    className="text-xs font-bold text-[#001f3f]/70 underline decoration-[#d4af37]/50 underline-offset-4 transition hover:text-[#001f3f]"
                  >
                    ??? ????? ?????? ?
                  </Link>
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[#001f3f] transition hover:bg-gray-100"
                  >
                    <Pencil className="h-3.5 w-3.5 text-[#d4af37]" aria-hidden />
                    ?????
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {copyToast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[200] w-[min(100%,20rem)] -translate-x-1/2 rounded-2xl border border-[#d4af37]/45 bg-gradient-to-br from-[#001f3f] via-[#0a1830] to-[#001f3f] px-5 py-3.5 text-center text-sm font-bold text-[#d4af37] shadow-[0_20px_60px_rgba(0,31,63,0.55)]"
        >
          {copyToast}
        </div>
      ) : null}

      {showModal ? (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-[#001f3f]/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="client-modal-title"
          onClick={closeModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[#d4af37]/20 bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 id="client-modal-title" className="text-xl font-black text-[#001f3f]">
                  {isEditing ? '????? ?????? ??????' : '????? ???? ????'}
                </h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  ????? ????? ?? full_name ? name ?? ?????? ??????
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200 disabled:opacity-50"
                aria-label="?????"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">????? ?????? *</span>
                <input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  className={CRM_FIELD}
                  dir="rtl"
                />
              </label>

              <div className="rounded-2xl border border-[#d4af37]/15 bg-amber-50/40 p-4 space-y-4">
                <p className="text-xs font-black text-[#001f3f]">?????? ????????</p>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">???????</span>
                  <select
                    value={form.client_tier}
                    onChange={(e) => setForm({ ...form, client_tier: e.target.value as ClientTier })}
                    className={CRM_FIELD}
                  >
                    {CLIENT_TIER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">??? ???????</span>
                    <input
                      type="number"
                      min={0}
                      value={form.total_trips}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          total_trips: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className={CRM_FIELD}
                      dir="ltr"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">??? ????????</span>
                    <input
                      type="number"
                      min={0}
                      value={form.referrals_count}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          referrals_count: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className={CRM_FIELD}
                      dir="ltr"
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">??? ???????</span>
                  <input
                    value={form.referral_code}
                    onChange={(e) => setForm({ ...form, referral_code: e.target.value })}
                    className={CRM_FIELD}
                    dir="ltr"
                    placeholder="REF-XXXX"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">??? ??????</span>
                  <input
                    value={form.phone_number}
                    onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                    className={CRM_FIELD}
                    dir="ltr"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">?????? ??????????</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={CRM_FIELD}
                    dir="ltr"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">Flight Prefs</span>
                <textarea
                  value={form.flight_preferences}
                  onChange={(e) => setForm({ ...form, flight_preferences: e.target.value })}
                  rows={2}
                  className={`${CRM_FIELD} resize-y`}
                  dir="rtl"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">Hotel Prefs</span>
                <textarea
                  value={form.hotel_preferences}
                  onChange={(e) => setForm({ ...form, hotel_preferences: e.target.value })}
                  rows={2}
                  className={`${CRM_FIELD} resize-y`}
                  dir="rtl"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">Dietary</span>
                <textarea
                  value={form.dietary}
                  onChange={(e) => setForm({ ...form, dietary: e.target.value })}
                  rows={2}
                  className={`${CRM_FIELD} resize-y`}
                  dir="rtl"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[#001f3f]">Secret Notes</span>
                <textarea
                  value={form.secret_notes}
                  onChange={(e) => setForm({ ...form, secret_notes: e.target.value })}
                  rows={3}
                  className={`${CRM_FIELD} resize-y`}
                  dir="rtl"
                />
              </label>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => void saveClient()}
                disabled={saving || !form.full_name.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#001f3f] py-3.5 text-sm font-black text-white transition hover:bg-[#002a55] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ???? ??????
                  </>
                ) : isEditing ? (
                  '??? ?????????'
                ) : (
                  '??? ??????'
                )}
              </button>
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-3.5 text-sm font-bold text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
              >
                ?????
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
