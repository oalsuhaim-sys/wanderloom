'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useSearchParams } from 'next/navigation';
import { Loader2, MessageCircle, Send, X } from 'lucide-react';

import { useCrmEmployee } from '@/app/crm/_components/CrmEmployeeProvider';
import {
  employeeInitials,
  formatArabicRelativeTime,
  type CrmCommentEmployeeOption,
  type CrmCommentMention,
  type CrmRecordComment,
} from '@/lib/crm-comments';
import { getClientAccessToken } from '@/lib/crm-session-token';

export type InternalDiscussionProps = {
  /** When omitted, context is inferred from the CRM URL (or global lounge). */
  recordId?: string | number;
  recordType?: string;
  className?: string;
  /** Poll interval ms — 0 disables */
  pollMs?: number;
};

const GLOBAL_RECORD_ID = 'global-team-lounge';
const GLOBAL_RECORD_TYPE = 'general';

type DiscussionContext = {
  recordId: string;
  recordType: string;
  title: string;
  isGlobal: boolean;
};

function resolveCrmDiscussionContext(
  pathname: string,
  searchParams: URLSearchParams,
): DiscussionContext {
  const path = (pathname || '').replace(/\/+$/, '') || '/crm';

  const itineraryMatch = path.match(/^\/crm\/itineraries\/([^/]+)(?:\/edit)?$/);
  if (
    itineraryMatch?.[1] &&
    !['new', 'builder'].includes(itineraryMatch[1])
  ) {
    return {
      recordType: 'itinerary',
      recordId: decodeURIComponent(itineraryMatch[1]),
      title: 'نقاشات السجل',
      isGlobal: false,
    };
  }

  if (path.includes('/partners-directory/profile')) {
    const type = searchParams.get('type')?.trim();
    const id = searchParams.get('id')?.trim();
    if (type && id) {
      return {
        recordType: 'partner',
        recordId: `${type}:${id}`,
        title: 'نقاشات السجل',
        isGlobal: false,
      };
    }
  }

  const expertMatch = path.match(/^\/crm\/partners-directory\/expert\/([^/]+)$/);
  if (expertMatch?.[1]) {
    return {
      recordType: 'partner',
      recordId: `experts:${decodeURIComponent(expertMatch[1])}`,
      title: 'نقاشات السجل',
      isGlobal: false,
    };
  }

  const clientMatch = path.match(/^\/crm\/clients\/([^/]+)$/);
  if (clientMatch?.[1]) {
    return {
      recordType: 'client',
      recordId: decodeURIComponent(clientMatch[1]),
      title: 'نقاشات السجل',
      isGlobal: false,
    };
  }

  const quoteMatch = path.match(/^\/crm\/quotations\/edit\/([^/]+)$/);
  if (quoteMatch?.[1]) {
    return {
      recordType: 'quotation',
      recordId: decodeURIComponent(quoteMatch[1]),
      title: 'نقاشات السجل',
      isGlobal: false,
    };
  }

  return {
    recordType: GLOBAL_RECORD_TYPE,
    recordId: GLOBAL_RECORD_ID,
    title: 'صالة الفريق (عام)',
    isGlobal: true,
  };
}

function highlightMentions(body: string): ReactNode {
  const parts = body.split(/(@[\u0600-\u06FFa-zA-Z0-9_.-]+)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="font-bold text-slate-900 dark:text-[#D4AF37]">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export default function InternalDiscussion({
  recordId,
  recordType,
  className = '',
  pollMs = 45000,
}: InternalDiscussionProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { employee } = useCrmEmployee();
  const currentEmployeeId = employee?.id != null ? String(employee.id) : null;
  const currentName = employee?.full_name?.trim() || '';

  const context = useMemo((): DiscussionContext => {
    const explicitId = recordId != null ? String(recordId).trim() : '';
    const explicitType = recordType?.trim() || '';
    if (explicitId && explicitType) {
      return {
        recordId: explicitId,
        recordType: explicitType,
        title: 'نقاشات السجل',
        isGlobal: false,
      };
    }
    return resolveCrmDiscussionContext(pathname ?? '', searchParams);
  }, [recordId, recordType, pathname, searchParams]);

  const activeRecordId = context.recordId || GLOBAL_RECORD_ID;
  const activeRecordType = context.recordType || GLOBAL_RECORD_TYPE;

  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [comments, setComments] = useState<CrmRecordComment[]>([]);
  const [employees, setEmployees] = useState<CrmCommentEmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [draft, setDraft] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mentionCandidates = useMemo(() => {
    if (mentionQuery == null) return [];
    const q = mentionQuery.toLowerCase();
    return employees
      .filter((e) => e.fullName.toLowerCase().includes(q) || e.fullName.split(/\s+/)[0]?.includes(mentionQuery))
      .slice(0, 6);
  }, [employees, mentionQuery]);

  const load = useCallback(async () => {
    if (!activeRecordId || !activeRecordType) return;
    try {
      const token = await getClientAccessToken();
      const res = await fetch(
        `/api/crm/comments?recordType=${encodeURIComponent(activeRecordType)}&recordId=${encodeURIComponent(activeRecordId)}&employees=1`,
        {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      const data = (await res.json()) as {
        ok?: boolean;
        comments?: CrmRecordComment[];
        employees?: CrmCommentEmployeeOption[];
        error?: string;
        setupRequired?: boolean;
        message?: string;
      };

      if (!res.ok || !data.ok) {
        setError(data.error || 'تعذر تحميل النقاشات');
        return;
      }

      setComments(Array.isArray(data.comments) ? data.comments : []);
      setEmployees(Array.isArray(data.employees) ? data.employees : []);
      setSetupRequired(Boolean(data.setupRequired));
      setError(data.setupRequired ? data.message || null : null);
    } catch {
      setError('تعذر الاتصال بخادم النقاشات');
    } finally {
      setLoading(false);
    }
  }, [activeRecordId, activeRecordType]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setLoading(true);
    setComments([]);
    setDraft('');
    setMentionQuery(null);
    setError(null);
    void load();
  }, [load]);

  useEffect(() => {
    if (!pollMs || pollMs < 5000) return;
    const id = window.setInterval(() => void load(), pollMs);
    return () => window.clearInterval(id);
  }, [load, pollMs]);

  useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [comments.length, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  function updateMentionState(value: string, cursor: number) {
    const before = value.slice(0, cursor);
    const match = before.match(/@([\u0600-\u06FFa-zA-Z0-9_.-]*)$/);
    if (match) {
      setMentionQuery(match[1] ?? '');
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  }

  function applyMention(emp: CrmCommentEmployeeOption) {
    const input = inputRef.current;
    const value = draft;
    const cursor = input?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);
    const replaced = before.replace(/@([\u0600-\u06FFa-zA-Z0-9_.-]*)$/, `@${emp.fullName} `);
    setDraft(replaced + after);
    setMentionQuery(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || sending || setupRequired) return;

    setSending(true);
    setError(null);

    const mentions: CrmCommentMention[] = employees
      .filter((emp) => text.includes(`@${emp.fullName}`))
      .map((emp) => ({ employeeId: emp.id, name: emp.fullName }));

    const optimisticId = `tmp-${Date.now()}`;
    const optimistic: CrmRecordComment = {
      id: optimisticId,
      recordType: activeRecordType,
      recordId: activeRecordId,
      authorEmployeeId: currentEmployeeId,
      authorUserId: null,
      authorName: currentName || 'أنت',
      body: text,
      mentions,
      createdAt: new Date().toISOString(),
    };
    setComments((prev) => [...prev, optimistic]);
    setDraft('');
    setMentionQuery(null);

    try {
      const token = await getClientAccessToken();
      const res = await fetch('/api/crm/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          recordType: activeRecordType,
          recordId: activeRecordId,
          body: text,
          mentions,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        comment?: CrmRecordComment;
        error?: string;
        setupRequired?: boolean;
      };

      if (!res.ok || !data.ok || !data.comment) {
        setComments((prev) => prev.filter((c) => c.id !== optimisticId));
        setDraft(text);
        if (data.setupRequired) setSetupRequired(true);
        setError(data.error || 'تعذر إرسال التعليق');
        return;
      }

      setComments((prev) =>
        prev.map((c) => (c.id === optimisticId ? data.comment! : c)),
      );
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== optimisticId));
      setDraft(text);
      setError('تعذر إرسال التعليق');
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (mentionQuery != null && mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionCandidates.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyMention(mentionCandidates[mentionIndex]!);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  if (!mounted) return null;

  const badgeCount = comments.length;
  const headerTitle = context.title;
  const emptyHint = context.isGlobal
    ? 'صالة الفريق — شارك تحديثات عامة أو @زميل هنا.'
    : 'ابدأ نقاشاً حول جودة المسار أو ملاحظات الموردين هنا.';

  const widget = (
    <div className={className} dir="rtl">
      {isOpen ? (
        <div
          role="dialog"
          aria-label={headerTitle}
          aria-modal="false"
          className="fixed bottom-24 left-6 z-50 flex h-[500px] w-[340px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-[380px] animate-[wl-chat-slide-in_0.3s_ease-out] dark:border-[#2D3F3A] dark:bg-[#22302C]"
        >
          <header className="flex items-center justify-between rounded-t-xl bg-slate-900 p-4 text-white dark:border-b dark:border-[#2D3F3A] dark:bg-[#1A2421]">
            <div className="flex min-w-0 items-center gap-2">
              <MessageCircle className="h-5 w-5 shrink-0 text-white/80 dark:text-[#D4AF37]" aria-hidden />
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold">{headerTitle}</h3>
                {!context.isGlobal ? (
                  <p className="truncate text-[10px] font-medium text-white/50">
                    {activeRecordType} · {activeRecordId}
                  </p>
                ) : null}
              </div>
              {badgeCount > 0 ? (
                <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold">
                  {badgeCount}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="إغلاق النقاش"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </header>

          <div
            ref={listRef}
            className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-[#F9FAFB] p-4 dark:bg-[#1A2421]/40"
          >
            {loading ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm font-medium text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400 dark:text-[#D4AF37]" aria-hidden />
                جاري تحميل النقاشات…
              </div>
            ) : comments.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">لا تعليقات بعد</p>
                <p className="text-xs font-medium text-slate-400">{emptyHint}</p>
              </div>
            ) : (
              comments.map((comment) => {
                const isMine =
                  (currentEmployeeId &&
                    comment.authorEmployeeId &&
                    comment.authorEmployeeId === currentEmployeeId) ||
                  (currentName && comment.authorName === currentName);
                return (
                  <div
                    key={comment.id}
                    className={`mb-4 flex gap-3 ${isMine ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]"
                      aria-hidden
                    >
                      {employeeInitials(comment.authorName)}
                    </div>
                    <div className={`min-w-0 flex-1 ${isMine ? 'text-left' : 'text-right'}`}>
                      <p className="mb-1 text-xs text-slate-400">
                        <span className="font-bold text-slate-500 dark:text-slate-300">{comment.authorName}</span>
                        {' · '}
                        {formatArabicRelativeTime(comment.createdAt)}
                      </p>
                      <div
                        className={`border border-slate-100 bg-white p-3 text-sm text-slate-800 dark:border-[#2D3F3A] dark:bg-[#22302C] dark:text-gray-200 ${
                          isMine
                            ? 'rounded-2xl rounded-tl-none'
                            : 'rounded-2xl rounded-tr-none'
                        } w-full`}
                      >
                        {highlightMentions(comment.body)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {error ? (
            <p className="mx-4 mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              {error}
            </p>
          ) : null}

          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="relative flex shrink-0 items-center gap-2 border-t border-slate-100 bg-white p-3 dark:border-[#2D3F3A] dark:bg-[#22302C]"
          >
            {mentionQuery != null && mentionCandidates.length > 0 ? (
              <ul
                className="absolute bottom-full left-3 right-14 z-20 mb-2 max-h-40 overflow-y-auto rounded-xl border border-slate-100 bg-white py-1 shadow-lg dark:border-[#2D3F3A] dark:bg-[#1A2421]"
                role="listbox"
              >
                {mentionCandidates.map((emp, idx) => (
                  <li key={emp.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={idx === mentionIndex}
                      onClick={() => applyMention(emp)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-right text-sm transition ${
                        idx === mentionIndex
                          ? 'bg-slate-900 font-bold text-white dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-gray-300 dark:hover:bg-[#22302C]'
                      }`}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]">
                        {employeeInitials(emp.fullName)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{emp.fullName}</span>
                      {emp.role ? (
                        <span className="text-[10px] font-semibold text-slate-400">{emp.role}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <input
              ref={inputRef}
              type="text"
              value={draft}
              disabled={sending || setupRequired}
              onChange={(e) => {
                const value = e.target.value;
                setDraft(value);
                updateMentionState(value, e.target.selectionStart ?? value.length);
              }}
              onKeyDown={onKeyDown}
              placeholder={setupRequired ? 'فعّل جدول النقاشات أولاً…' : 'اكتب ملاحظة أو @اسم الزميل…'}
              className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-slate-200 disabled:opacity-60 dark:border-[#2D3F3A] dark:bg-[#1A2421] dark:text-gray-100 dark:focus:ring-[#D4AF37]/20"
              aria-label="نص التعليق"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim() || setupRequired}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-transparent bg-slate-900 text-white transition-colors duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:border dark:border-[#D4AF37]/30 dark:bg-[#22302C] dark:text-[#D4AF37]"
              aria-label="إرسال"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Send className="h-4 w-4" aria-hidden />
              )}
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="fixed bottom-6 left-6 z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-transparent bg-slate-900 text-white shadow-lg transition-colors duration-200 hover:opacity-90 dark:border dark:border-[#D4AF37]/30 dark:bg-[#22302C] dark:text-[#D4AF37]"
        aria-label={isOpen ? 'إغلاق نقاشات الفريق' : 'فتح نقاشات الفريق'}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <X className="h-6 w-6" aria-hidden />
        ) : (
          <MessageCircle className="h-6 w-6" aria-hidden />
        )}
        {!isOpen && badgeCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 text-[10px] font-bold text-white dark:border-[#1A2421]">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        ) : null}
      </button>
    </div>
  );

  return createPortal(widget, document.body);
}
