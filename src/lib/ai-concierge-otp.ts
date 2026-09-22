import 'server-only';

import { createHash, createHmac, randomInt, timingSafeEqual } from 'crypto';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sanitizePhoneDigits, validateAndFormatSaudiPhone } from '@/lib/phoneUtils';
import { isUsableClientName } from '@/lib/client-intake-pipeline';
import { trimText } from '@/lib/ai-concierge';

const OTP_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 55_000;

type OtpRow = {
  id: string;
  phone: string;
  client_name: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
  consumed_at: string | null;
};

type MemoryOtp = {
  id: string;
  phone: string;
  clientName: string;
  codeHash: string;
  attempts: number;
  expiresAt: number;
  consumed: boolean;
  createdAt: number;
};

const memoryOtps = new Map<string, MemoryOtp>();

function otpSecret(): string {
  return (
    (process.env.AI_CONCIERGE_OTP_SECRET ?? '').trim() ||
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim() ||
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim() ||
    'wanderloom-concierge-dev-secret'
  );
}

export function hashOtpCode(phone: string, code: string): string {
  return createHash('sha256')
    .update(`${otpSecret()}:${phone}:${code}`)
    .digest('hex');
}

export function generateFourDigitOtp(): string {
  return String(randomInt(0, 10000)).padStart(4, '0');
}

export function normalizeConciergePhone(phoneRaw: string): {
  ok: true;
  phone: string;
} | { ok: false; error: string } {
  const saudi = validateAndFormatSaudiPhone(phoneRaw);
  if (saudi.isValid) return { ok: true, phone: saudi.formattedPhone };
  const digits = sanitizePhoneDigits(phoneRaw);
  if (digits.length >= 8 && digits.length <= 15) return { ok: true, phone: digits };
  return { ok: false, error: saudi.error || 'رقم واتساب غير صالح' };
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

export type ConciergeVerifyPayload = {
  phone: string;
  name: string;
  clientId: number | null;
  exp: number;
};

export function signConciergeVerificationToken(payload: ConciergeVerifyPayload): string {
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', otpSecret()).update(body).digest();
  return `${body}.${b64url(sig)}`;
}

export function verifyConciergeVerificationToken(
  tokenRaw: string | null | undefined,
): { ok: true; payload: ConciergeVerifyPayload } | { ok: false; error: string } {
  const token = String(tokenRaw ?? '').trim();
  if (!token || !token.includes('.')) {
    return { ok: false, error: 'يلزم التحقق من رقم الجوال أولاً' };
  }
  const [body, sig] = token.split('.');
  if (!body || !sig) return { ok: false, error: 'رمز التحقق غير صالح' };

  const expected = createHmac('sha256', otpSecret()).update(body).digest();
  const actual = fromB64url(sig);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return { ok: false, error: 'رمز التحقق غير صالح' };
  }

  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as ConciergeVerifyPayload;
    if (!payload?.phone || !payload?.name || !payload?.exp) {
      return { ok: false, error: 'رمز التحقق غير مكتمل' };
    }
    if (Date.now() > Number(payload.exp)) {
      return { ok: false, error: 'انتهت صلاحية التحقق — أعد تأكيد رقمك' };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, error: 'تعذّر قراءة رمز التحقق' };
  }
}

async function purgeOldMemory() {
  const now = Date.now();
  for (const [id, row] of memoryOtps) {
    if (row.expiresAt < now || row.consumed) memoryOtps.delete(id);
  }
}

export async function createAndStoreOtp(input: {
  phone: string;
  clientName: string;
}): Promise<{ ok: true; code: string; expiresInSec: number } | { ok: false; error: string }> {
  if (!isUsableClientName(input.clientName)) {
    return { ok: false, error: 'يرجى إدخال الاسم الكريم' };
  }
  const phoneNorm = normalizeConciergePhone(input.phone);
  if (!phoneNorm.ok) return phoneNorm;

  const phone = phoneNorm.phone;
  const name = trimText(input.clientName, 120);
  const code = generateFourDigitOtp();
  const codeHash = hashOtpCode(phone, code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  try {
    const admin = createSupabaseAdminClient();

    const { data: recent } = await admin
      .from('ai_concierge_otps')
      .select('id, created_at')
      .eq('phone', phone)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent?.created_at) {
      const age = Date.now() - new Date(recent.created_at).getTime();
      if (age < RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((RESEND_COOLDOWN_MS - age) / 1000);
        return { ok: false, error: `انتظر ${wait} ثانية قبل إعادة إرسال الرمز` };
      }
    }

    // Invalidate previous active codes
    await admin
      .from('ai_concierge_otps')
      .update({ consumed_at: new Date().toISOString() })
      .eq('phone', phone)
      .is('consumed_at', null);

    const { error } = await admin.from('ai_concierge_otps').insert({
      phone,
      client_name: name,
      code_hash: codeHash,
      expires_at: expiresAt,
      attempts: 0,
    });

    if (error) {
      if (/relation|does not exist|schema cache/i.test(error.message ?? '')) {
        return createMemoryOtp({ phone, clientName: name, code, codeHash });
      }
      return { ok: false, error: error.message };
    }

    return { ok: true, code, expiresInSec: Math.floor(OTP_TTL_MS / 1000) };
  } catch (err) {
    return createMemoryOtp({
      phone,
      clientName: name,
      code,
      codeHash,
    });
  }
}

function createMemoryOtp(input: {
  phone: string;
  clientName: string;
  code: string;
  codeHash: string;
}): { ok: true; code: string; expiresInSec: number } | { ok: false; error: string } {
  purgeOldMemory();
  for (const row of memoryOtps.values()) {
    if (row.phone === input.phone && !row.consumed && Date.now() - row.createdAt < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - row.createdAt)) / 1000);
      return { ok: false, error: `انتظر ${wait} ثانية قبل إعادة إرسال الرمز` };
    }
  }

  const id = `mem-${Date.now()}`;
  memoryOtps.set(id, {
    id,
    phone: input.phone,
    clientName: input.clientName,
    codeHash: input.codeHash,
    attempts: 0,
    expiresAt: Date.now() + OTP_TTL_MS,
    consumed: false,
    createdAt: Date.now(),
  });
  return { ok: true, code: input.code, expiresInSec: Math.floor(OTP_TTL_MS / 1000) };
}

export async function consumeOtp(input: {
  phone: string;
  code: string;
}): Promise<
  | { ok: true; clientName: string; phone: string }
  | { ok: false; error: string }
> {
  const phoneNorm = normalizeConciergePhone(input.phone);
  if (!phoneNorm.ok) return phoneNorm;
  const phone = phoneNorm.phone;
  const code = String(input.code ?? '').replace(/\D/g, '').slice(0, 4);
  if (code.length !== 4) return { ok: false, error: 'أدخل رمز التحقق المكوّن من 4 أرقام' };

  const codeHash = hashOtpCode(phone, code);

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('ai_concierge_otps')
      .select('id, phone, client_name, code_hash, attempts, expires_at, consumed_at')
      .eq('phone', phone)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (/relation|does not exist|schema cache/i.test(error.message ?? '')) {
        return consumeMemoryOtp(phone, codeHash);
      }
      return { ok: false, error: error.message };
    }

    if (!data) return { ok: false, error: 'لا يوجد رمز تحقق نشط — أعد الإرسال' };
    const row = data as OtpRow;
    if (row.consumed_at) return { ok: false, error: 'تم استخدام هذا الرمز مسبقاً' };
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false, error: 'انتهت صلاحية الرمز — أعد الإرسال' };
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      return { ok: false, error: 'تجاوزت عدد المحاولات — أعد إرسال رمز جديد' };
    }

    if (row.code_hash !== codeHash) {
      await admin
        .from('ai_concierge_otps')
        .update({ attempts: row.attempts + 1 })
        .eq('id', row.id);
      return { ok: false, error: 'رمز التحقق غير صحيح' };
    }

    await admin
      .from('ai_concierge_otps')
      .update({ consumed_at: new Date().toISOString() })
      .eq('id', row.id);

    return {
      ok: true,
      phone,
      clientName: String(row.client_name ?? '').trim() || 'ضيف واندرلوم',
    };
  } catch {
    return consumeMemoryOtp(phone, codeHash);
  }
}

function consumeMemoryOtp(
  phone: string,
  codeHash: string,
): { ok: true; clientName: string; phone: string } | { ok: false; error: string } {
  purgeOldMemory();
  const row = [...memoryOtps.values()]
    .filter((r) => r.phone === phone && !r.consumed)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  if (!row) return { ok: false, error: 'لا يوجد رمز تحقق نشط — أعد الإرسال' };
  if (row.expiresAt < Date.now()) return { ok: false, error: 'انتهت صلاحية الرمز — أعد الإرسال' };
  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: 'تجاوزت عدد المحاولات — أعد إرسال رمز جديد' };
  }
  if (row.codeHash !== codeHash) {
    row.attempts += 1;
    return { ok: false, error: 'رمز التحقق غير صحيح' };
  }
  row.consumed = true;
  return { ok: true, phone, clientName: row.clientName };
}

export function buildVerificationToken(input: {
  phone: string;
  name: string;
  clientId: number | null;
}): string {
  return signConciergeVerificationToken({
    phone: input.phone,
    name: input.name,
    clientId: input.clientId,
    exp: Date.now() + TOKEN_TTL_MS,
  });
}
