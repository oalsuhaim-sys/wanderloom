/** Session keys — group registration draft survives steps until terms confirmation */
export const GROUP_REG_PHONE_KEY = 'wanderloom_group_reg_phone';
export const GROUP_REG_NAME_KEY = 'wanderloom_group_reg_name';
export const GROUP_REG_EMAIL_KEY = 'wanderloom_group_reg_email';
export const GROUP_REG_DRAFT_KEY = 'wanderloom_group_reg_draft_v1';

export type GroupRegistrationContact = {
  phone: string;
  fullName: string;
  email: string;
};

export type GroupRegistrationDraft = {
  version: 1;
  full_name: string;
  phone_wa: string;
  email: string;
  birth_date: string;
  referral_code: string;
  preferred_trip_id: string;
  trip_label: string;
  interview_date?: string;
  interview_time?: string;
  saved_at: string;
};

export type GroupRegistrationDraftInput = Omit<GroupRegistrationDraft, 'version' | 'saved_at'>;

export function persistGroupRegistrationContact(contact: {
  phone?: string;
  fullName?: string;
  email?: string | null;
}): void {
  if (typeof window === 'undefined') return;
  const phone = String(contact.phone ?? '').trim();
  const fullName = String(contact.fullName ?? '').trim();
  const email = String(contact.email ?? '').trim();
  if (phone) localStorage.setItem(GROUP_REG_PHONE_KEY, phone);
  if (fullName) localStorage.setItem(GROUP_REG_NAME_KEY, fullName);
  if (email) localStorage.setItem(GROUP_REG_EMAIL_KEY, email);
}

export function readGroupRegistrationContact(): GroupRegistrationContact {
  if (typeof window === 'undefined') {
    return { phone: '', fullName: '', email: '' };
  }
  return {
    phone: localStorage.getItem(GROUP_REG_PHONE_KEY)?.trim() ?? '',
    fullName: localStorage.getItem(GROUP_REG_NAME_KEY)?.trim() ?? '',
    email: localStorage.getItem(GROUP_REG_EMAIL_KEY)?.trim() ?? '',
  };
}

export function persistGroupRegistrationDraft(
  draft: GroupRegistrationDraftInput,
): GroupRegistrationDraft {
  const full: GroupRegistrationDraft = {
    version: 1,
    full_name: String(draft.full_name ?? '').trim(),
    phone_wa: String(draft.phone_wa ?? '').trim(),
    email: String(draft.email ?? '').trim(),
    birth_date: String(draft.birth_date ?? '').trim().slice(0, 10),
    referral_code: String(draft.referral_code ?? '').trim().toUpperCase().slice(0, 64),
    preferred_trip_id: String(draft.preferred_trip_id ?? '').trim(),
    trip_label: String(draft.trip_label ?? '').trim(),
    interview_date: draft.interview_date?.trim().slice(0, 10) || undefined,
    interview_time: draft.interview_time?.trim() || undefined,
    saved_at: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(GROUP_REG_DRAFT_KEY, JSON.stringify(full));
    persistGroupRegistrationContact({
      phone: full.phone_wa,
      fullName: full.full_name,
      email: full.email || null,
    });
  }

  return full;
}

export function readGroupRegistrationDraft(): GroupRegistrationDraft | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(GROUP_REG_DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GroupRegistrationDraft>;
    if (!parsed?.full_name?.trim() || !parsed?.phone_wa?.trim() || !parsed?.preferred_trip_id?.trim()) {
      return null;
    }
    return {
      version: 1,
      full_name: String(parsed.full_name).trim(),
      phone_wa: String(parsed.phone_wa).trim(),
      email: String(parsed.email ?? '').trim(),
      birth_date: String(parsed.birth_date ?? '').trim().slice(0, 10),
      referral_code: String(parsed.referral_code ?? '').trim(),
      preferred_trip_id: String(parsed.preferred_trip_id).trim(),
      trip_label: String(parsed.trip_label ?? 'رحلة جماعية').trim(),
      interview_date: parsed.interview_date?.trim().slice(0, 10) || undefined,
      interview_time: parsed.interview_time?.trim() || undefined,
      saved_at: String(parsed.saved_at ?? new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

export function patchGroupRegistrationDraft(
  patch: Partial<Pick<GroupRegistrationDraft, 'interview_date' | 'interview_time'>>,
): GroupRegistrationDraft | null {
  const current = readGroupRegistrationDraft();
  if (!current) return null;
  return persistGroupRegistrationDraft({
    ...current,
    interview_date: patch.interview_date ?? current.interview_date,
    interview_time: patch.interview_time ?? current.interview_time,
  });
}

export function clearGroupRegistrationDraft(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GROUP_REG_DRAFT_KEY);
}

/** Step 2 — optional dates / direct path to terms (no DB writes yet). */
export function buildGroupConfirmHref(): string {
  return '/group-onboarding/confirm';
}

/** Step 3 — terms & final confirmation. */
export function buildGroupTermsHref(): string {
  return '/group-onboarding/terms';
}

/** @deprecated Use buildGroupConfirmHref — kept for legacy /dna links */
export function buildGroupDnaHref(
  _leadId: string,
  contact?: Partial<GroupRegistrationContact>,
): string {
  if (contact?.phone || contact?.fullName || contact?.email) {
    persistGroupRegistrationContact({
      phone: contact.phone,
      fullName: contact.fullName,
      email: contact.email,
    });
  }
  return buildGroupConfirmHref();
}
