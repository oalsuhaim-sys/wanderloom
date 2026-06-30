export type BirthdayRadarClient = {
  id: string;
  name: string;
  birth_date: string;
  daysUntilBirthday: number;
  phone_wa: string;
};

function parseBirthDateLocal(raw: string): Date | null {
  const trimmed = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getDaysUntilRecurringDate(dateRaw: string, today: Date): number | null {
  const parsed = parseBirthDateLocal(dateRaw);
  if (!parsed) return null;

  const todayNorm = new Date(today);
  todayNorm.setHours(0, 0, 0, 0);

  const next = new Date(todayNorm.getFullYear(), parsed.getMonth(), parsed.getDate());
  next.setHours(0, 0, 0, 0);

  if (next < todayNorm) {
    next.setFullYear(todayNorm.getFullYear() + 1);
  }

  const diffTime = next.getTime() - todayNorm.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function getDaysUntilBirthday(birthDateRaw: string, today: Date): number | null {
  return getDaysUntilRecurringDate(birthDateRaw, today);
}

export function filterUpcomingBirthdays(
  clients: Array<Record<string, unknown>>,
  horizonDays = 7,
  referenceDate = new Date(),
): BirthdayRadarClient[] {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const upcoming = clients
    .map((client) => {
      const birth_date = String(client.birth_date ?? '').trim();
      if (!birth_date) return null;

      const daysUntilBirthday = getDaysUntilBirthday(birth_date, today);
      if (daysUntilBirthday == null || daysUntilBirthday < 0 || daysUntilBirthday > horizonDays) {
        return null;
      }

      const name = String(client.name ?? '').trim() || `عميل #${client.id}`;

      return {
        id: String(client.id),
        name,
        birth_date,
        daysUntilBirthday,
        phone_wa: String(client.phone_wa ?? '').trim(),
      };
    })
    .filter((row): row is BirthdayRadarClient => row != null);

  upcoming.sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday);
  return upcoming;
}

export type AnniversaryRadarClient = {
  id: string;
  name: string;
  anniversary_date: string;
  daysUntilAnniversary: number;
  phone_wa: string;
};

export function filterUpcomingAnniversaries(
  clients: Array<Record<string, unknown>>,
  horizonDays = 7,
  referenceDate = new Date(),
): AnniversaryRadarClient[] {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const upcoming = clients
    .map((client) => {
      const anniversary_date = String(client.anniversary_date ?? '').trim();
      if (!anniversary_date) return null;

      const daysUntilAnniversary = getDaysUntilRecurringDate(anniversary_date, today);
      if (
        daysUntilAnniversary == null ||
        daysUntilAnniversary < 0 ||
        daysUntilAnniversary > horizonDays
      ) {
        return null;
      }

      const name = String(client.name ?? '').trim() || `عميل #${client.id}`;

      return {
        id: String(client.id),
        name,
        anniversary_date,
        daysUntilAnniversary,
        phone_wa: String(client.phone_wa ?? '').trim(),
      };
    })
    .filter((row): row is AnniversaryRadarClient => row != null);

  upcoming.sort((a, b) => a.daysUntilAnniversary - b.daysUntilAnniversary);
  return upcoming;
}

export function formatBirthdayDisplayDate(birthDateRaw: string): string {
  const birth = parseBirthDateLocal(birthDateRaw);
  if (!birth) return birthDateRaw;
  return birth.toLocaleDateString('ar-SA', { day: 'numeric', month: 'long' });
}
