export type CrmCommentRecordType =
  | 'itinerary'
  | 'trip'
  | 'partner'
  | 'client'
  | 'quotation'
  | 'group_trip'
  | string;

export type CrmCommentMention = {
  employeeId: string;
  name: string;
};

export type CrmRecordComment = {
  id: string;
  recordType: string;
  recordId: string;
  authorEmployeeId: string | null;
  authorUserId: string | null;
  authorName: string;
  body: string;
  mentions: CrmCommentMention[];
  createdAt: string;
};

export type CrmCommentEmployeeOption = {
  id: string;
  fullName: string;
  role: string | null;
};

export function mapCrmCommentRow(row: Record<string, unknown>): CrmRecordComment | null {
  const id = String(row.id ?? '').trim();
  const body = String(row.body ?? '').trim();
  const createdAt = String(row.created_at ?? '').trim();
  if (!id || !body || !createdAt) return null;

  const mentionsRaw = row.mentions;
  const mentions: CrmCommentMention[] = [];
  if (Array.isArray(mentionsRaw)) {
    for (const item of mentionsRaw) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const employeeId = String(rec.employeeId ?? rec.employee_id ?? '').trim();
      const name = String(rec.name ?? '').trim();
      if (employeeId && name) mentions.push({ employeeId, name });
    }
  }

  return {
    id,
    recordType: String(row.record_type ?? '').trim(),
    recordId: String(row.record_id ?? '').trim(),
    authorEmployeeId:
      row.author_employee_id != null ? String(row.author_employee_id).trim() : null,
    authorUserId: row.author_user_id != null ? String(row.author_user_id).trim() : null,
    authorName: String(row.author_name ?? 'موظف').trim() || 'موظف',
    body,
    mentions,
    createdAt,
  };
}

export function employeeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '؟';
  if (parts.length === 1) return parts[0]!.slice(0, 1);
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`;
}

/** Arabic relative time e.g. "منذ ساعتين" */
export function formatArabicRelativeTime(
  iso: string,
  now: Date = new Date(),
): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';

  const diffSec = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));
  if (diffSec < 45) return 'الآن';
  if (diffSec < 90) return 'منذ دقيقة';

  const mins = Math.floor(diffSec / 60);
  if (mins < 60) {
    if (mins === 1) return 'منذ دقيقة';
    if (mins === 2) return 'منذ دقيقتين';
    if (mins >= 3 && mins <= 10) return `منذ ${mins} دقائق`;
    return `منذ ${mins} دقيقة`;
  }

  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    if (hours === 1) return 'منذ ساعة';
    if (hours === 2) return 'منذ ساعتين';
    if (hours >= 3 && hours <= 10) return `منذ ${hours} ساعات`;
    return `منذ ${hours} ساعة`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) return 'منذ يوم';
  if (days === 2) return 'منذ يومين';
  if (days >= 3 && days <= 10) return `منذ ${days} أيام`;
  if (days < 30) return `منذ ${days} يوماً`;

  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(then);
  } catch {
    return then.toLocaleString('ar');
  }
}

export function extractMentionTokens(body: string): string[] {
  const matches = body.match(/@([\u0600-\u06FFa-zA-Z0-9_.-]+)/g) ?? [];
  return matches.map((m) => m.slice(1));
}
