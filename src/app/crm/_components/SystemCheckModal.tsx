'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2,
  Play,
  ShieldCheck,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';

import { getClientAccessToken } from '@/lib/crm-session-token';

const FOREST = '#1A3B2A';
const GOLD = '#C5A059';

type LogStatus = 'loading' | 'success' | 'error' | 'info';

type AuditLog = {
  time: string;
  step: string;
  status: LogStatus;
  details: string;
  code?: string;
};

type SystemCheckModalProps = {
  open: boolean;
  onClose: () => void;
};

function statusColor(status: LogStatus): string {
  switch (status) {
    case 'success':
      return 'text-emerald-400';
    case 'error':
      return 'text-rose-400';
    case 'loading':
      return 'text-amber-300';
    default:
      return 'text-slate-400';
  }
}

function statusTag(status: LogStatus): string {
  switch (status) {
    case 'success':
      return 'OK';
    case 'error':
      return 'ERR';
    case 'loading':
      return '...';
    default:
      return 'INF';
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    } as Intl.DateTimeFormatOptions);
  } catch {
    return iso.slice(11, 23);
  }
}

export function SystemCheckModal({ open, onClose }: SystemCheckModalProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [running, setRunning] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [overall, setOverall] = useState<'idle' | 'PASS' | 'FAIL'>('idle');
  const consoleRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const el = consoleRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs, fatalError]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLogs([]);
    setRunning(false);
    setFatalError(null);
    setOverall('idle');
  }, []);

  const handleClose = useCallback(() => {
    if (running) return;
    reset();
    onClose();
  }, [onClose, reset, running]);

  const appendLog = useCallback((entry: AuditLog) => {
    setLogs((prev) => [...prev, entry]);
  }, []);

  const runFullSystemAudit = useCallback(async () => {
    if (running) return;

    setRunning(true);
    setFatalError(null);
    setOverall('idle');
    setLogs([
      {
        time: new Date().toISOString(),
        step: 'UI',
        status: 'info',
        details: 'runFullSystemAudit() — awaiting NDJSON stream from /api/admin/system-audit',
      },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const accessToken = await getClientAccessToken();
      const response = await fetch('/api/admin/system-audit', {
        method: 'POST',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/x-ndjson',
        },
      });

      if (!response.ok || !response.body) {
        let message = `HTTP ${response.status}`;
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) message = payload.error;
        } catch {
          /* ignore */
        }
        throw new Error(message);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamOk = true;
      let lastErrorDetail: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let parsed: AuditLog | { type: 'done'; ok: boolean };
          try {
            parsed = JSON.parse(trimmed) as AuditLog | { type: 'done'; ok: boolean };
          } catch {
            appendLog({
              time: new Date().toISOString(),
              step: 'PARSE',
              status: 'error',
              details: `Malformed NDJSON: ${trimmed.slice(0, 200)}`,
            });
            continue;
          }

          if ('type' in parsed && parsed.type === 'done') {
            streamOk = Boolean(parsed.ok);
            continue;
          }

          const log = parsed as AuditLog;
          appendLog(log);
          if (log.status === 'error') {
            lastErrorDetail = log.details;
            setFatalError(log.details);
            streamOk = false;
          }
        }
      }

      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim()) as
            | AuditLog
            | { type: 'done'; ok: boolean };
          if ('type' in parsed && parsed.type === 'done') {
            streamOk = Boolean(parsed.ok);
          } else {
            appendLog(parsed as AuditLog);
          }
        } catch {
          /* ignore trailing junk */
        }
      }

      setOverall(streamOk ? 'PASS' : 'FAIL');
      if (!streamOk && !lastErrorDetail) {
        setFatalError('Audit finished with failures — see console ERR lines');
      }
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') {
        appendLog({
          time: new Date().toISOString(),
          step: 'ABORT',
          status: 'info',
          details: 'Audit aborted by user',
        });
      } else {
        const message =
          err instanceof Error ? err.message : 'Failed to run system audit';
        setFatalError(message);
        setOverall('FAIL');
        appendLog({
          time: new Date().toISOString(),
          step: 'FATAL',
          status: 'error',
          details: message,
        });
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [appendLog, running]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="system-audit-title"
      onClick={handleClose}
    >
      <div
        className="relative flex max-h-[90vh] w-[95%] max-w-3xl flex-col overflow-hidden rounded-2xl border border-emerald-500/30 bg-[#0b0f0c] shadow-2xl"
        dir="ltr"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `${GOLD}22`, color: GOLD }}
            >
              <Terminal className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p
                className="font-mono text-[10px] font-bold uppercase tracking-[0.25em]"
                style={{ color: GOLD }}
              >
                Enterprise E2E Diagnostic
              </p>
              <h2
                id="system-audit-title"
                className="mt-0.5 font-mono text-sm font-bold text-white sm:text-base"
              >
                فحص شامل للنظام — Write / Read / Verify
              </h2>
              <p className="mt-1 font-mono text-[11px] text-slate-400">
                Pillars: Partners · Individuals · Groups · Nuclear cleanup
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={running}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {fatalError ? (
          <div
            className="border-b border-rose-500/50 bg-rose-950/90 px-4 py-3 font-mono text-sm font-bold text-rose-200 shadow-[inset_0_0_40px_rgba(244,63,94,0.25)]"
            role="alert"
          >
            <span className="me-2 inline-block rounded bg-rose-500 px-2 py-0.5 text-[10px] font-black tracking-widest text-white">
              FATAL
            </span>
            {fatalError}
          </div>
        ) : null}

        <div
          ref={consoleRef}
          className="min-h-[280px] flex-1 overflow-y-auto bg-black px-3 py-3 font-mono text-[12px] leading-relaxed text-slate-300 sm:px-4"
          aria-live="polite"
        >
          {logs.length === 0 ? (
            <p className="text-slate-600">
              $ awaiting operator — press START AUDIT to begin
            </p>
          ) : (
            logs.map((log, idx) => (
              <div
                key={`${log.time}-${log.step}-${idx}`}
                className={`mb-1 flex flex-wrap gap-x-2 gap-y-0.5 ${
                  log.status === 'error'
                    ? 'rounded bg-rose-950/60 px-1 py-0.5 text-rose-300'
                    : ''
                }`}
              >
                <span className="shrink-0 text-slate-600">
                  [{formatTime(log.time)}]
                </span>
                <span
                  className={`shrink-0 font-bold ${statusColor(log.status)}`}
                >
                  {statusTag(log.status)}
                </span>
                <span className="shrink-0 text-cyan-400">{log.step}</span>
                <span className="min-w-0 break-all text-slate-300">
                  {log.details}
                </span>
                {log.code ? (
                  <span className="shrink-0 text-rose-400">#{log.code}</span>
                ) : null}
              </div>
            ))
          )}
          {running ? (
            <div className="mt-2 flex items-center gap-2 text-amber-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              <span>streaming…</span>
            </div>
          ) : null}
        </div>

        <footer className="flex flex-col gap-2 border-t border-white/10 bg-[#0f1511] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="font-mono text-[11px] text-slate-500">
            {overall === 'PASS' ? (
              <span className="font-bold text-emerald-400">● AUDIT PASS</span>
            ) : overall === 'FAIL' ? (
              <span className="font-bold text-rose-400">● AUDIT FAIL</span>
            ) : running ? (
              <span className="text-amber-300">● RUNNING</span>
            ) : (
              <span>● IDLE — will not auto-run</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={reset}
              disabled={running || logs.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 font-mono text-xs font-bold text-slate-300 transition hover:bg-white/5 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Clear
            </button>
            <button
              type="button"
              onClick={() => void runFullSystemAudit()}
              disabled={running}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-xs font-black text-[#0b0f0c] transition hover:opacity-95 disabled:cursor-wait disabled:opacity-70"
              style={{ background: GOLD }}
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Play className="h-4 w-4" aria-hidden />
              )}
              {running ? 'AUDITING…' : 'START AUDIT'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-mono text-xs font-bold text-white transition hover:opacity-95 disabled:opacity-40"
              style={{ backgroundColor: FOREST }}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Close
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
