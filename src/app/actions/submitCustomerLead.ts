'use server';

import { revalidatePath } from 'next/cache';

import { runWebsiteLeadIntakeAutomation, canonicalizePhoneWa } from '@/lib/client-intake-pipeline';
import { ensureLeadClientIntakeAdmin, ensureClientFromDirectoryFieldsAdmin } from '@/lib/client-intake-pipeline-server';
import { escapeEmailHtml, sendEmailAlert } from '@/lib/emailAlert';
import { mapTripFormSourceToLeadSource } from '@/lib/lead-source';
import { normalizeLeadStatus, CLIENT_DATABASE_LEAD_STATUSES } from '@/lib/lead-status';
import { labelForCityComposite, labelForCountryId } from '@/lib/trip-destination-data';
import { normalizeAffiliateRef } from '@/lib/referral-url';
import { runRegistrationAutomationPipeline } from '@/lib/registration-automation';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { assertServiceRoleKeyConfigured } from '@/lib/supabase/server-action-auth';
import { ar } from '@/messages/ar';
import type { LeadTravelStyle } from '@/lib/lead-travel-style';

export type CustomerLeadState = {
  ok: boolean;
  error?: string;
  message?: string;
};

type SupabaseInsertError = {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

type InsertedLeadRow = {
  id: string;
  full_name: string;
  phone_wa: string;
  email: string | null;
  referral_code?: string | null;
};

function mapInsertedLeadRow(raw: unknown): InsertedLeadRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = String(row.id ?? '').trim();
  if (!id) return null;
  return {
    id,
    full_name: String(row.full_name ?? '').trim(),
    phone_wa: String(row.phone_wa ?? '').trim(),
    email: row.email != null ? String(row.email).trim() || null : null,
    referral_code: row.referral_code != null ? String(row.referral_code).trim() || null : null,
  };
}

type LeadsInsertRow = {
  full_name: string;
  email: string | null;
  phone_wa: string;
  age: number | null;
  destinations: string[];
  travel_date: string | null;
  travel_days: number;
  travelers_count: number;
  budget: string | null;
  interests: string[];
  travel_style: LeadTravelStyle;
  lead_source?: string | null;
  daily_pace: string | null;
  walking_readiness: string | null;
  day_start_time: string | null;
  food_preferences: string[];
  accommodation_type: string[];
  final_thoughts: string;
  form_type: 'trip_log' | 'contact';
  status: 'radar_pending';
  referral_code?: string | null;
};

function formatSupabaseInsertError(error: SupabaseInsertError): string {
  const message = error.message?.trim() || 'Unknown database error';
  const details = error.details?.trim();
  const hint = error.hint?.trim();
  const code = error.code?.trim();

  let text = `عذراً، تعذر الحفظ: ${message}`;
  if (details) text += ` | Details: ${details}`;
  if (hint) text += ` | Hint: ${hint}`;
  if (code) text += ` | Code: ${code}`;
  return text;
}

function formatThrownError(error: unknown): string {
  if (error instanceof Error) {
    return `عذراً، تعذر الحفظ: ${error.message}`;
  }
  if (typeof error === 'string' && error.trim()) {
    return `عذراً، تعذر الحفظ: ${error.trim()}`;
  }
  try {
    return `عذراً، تعذر الحفظ: ${JSON.stringify(error)}`;
  } catch {
    return ar.errors.trip.dbSaveFailed;
  }
}

function s(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : '';
}

function all(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((x): x is string => typeof x === 'string' && x.trim() !== '');
}

function mergeOtherPref(values: string[], otherText: string): string[] {
  const withoutOther = values.filter((v) => v !== 'other');
  const detail = otherText.trim();
  if (values.includes('other') && detail) {
    return [...withoutOther, `أخرى: ${detail}`];
  }
  if (values.includes('other')) {
    return [...withoutOther, 'أخرى'];
  }
  return withoutOther;
}

function resolveCountryLabel(countryId: string, customCountry: string): string {
  if (countryId === 'other') {
    return customCountry.trim();
  }
  return labelForCountryId(countryId);
}

/**
 * Builds human-readable destination labels for DB storage.
 * Never persists the "other" / "أخرى" placeholder — only typed custom names.
 */
function resolveDestinationLabel(
  composite: string,
  formData: FormData,
  customCountry: string,
): string | null {
  const i = composite.indexOf(':');
  if (i < 1) return null;
  const countryId = composite.slice(0, i);
  const cityId = composite.slice(i + 1);

  const countryLabel = resolveCountryLabel(countryId, customCountry);
  if (!countryLabel || countryLabel === 'other' || countryLabel === 'أخرى') {
    return null;
  }

  if (cityId === 'other') {
    const customCity = s(formData.get(`city_other_${countryId}`));
    if (!customCity || customCity === 'other' || customCity === 'أخرى') {
      return null;
    }
    return `${countryLabel} — ${customCity}`;
  }

  if (countryId === 'other') {
    // Custom country with a non-catalog city id should not happen; require city_other
    const customCity = s(formData.get(`city_other_${countryId}`)) || cityId;
    if (!customCity || customCity === 'other' || customCity === 'أخرى') {
      return null;
    }
    return `${countryLabel} — ${customCity}`;
  }

  const labeled = labelForCityComposite(composite);
  if (
    !labeled ||
    labeled.includes(':other') ||
    labeled.endsWith('— أخرى') ||
    labeled === 'أخرى' ||
    labeled === 'other'
  ) {
    return null;
  }
  return labeled;
}

function sanitizeDestinationsPayload(
  citiesNormalized: string[],
  formData: FormData,
  customCountry: string,
): { ok: true; destinations: string[] } | { ok: false; error: string } {
  const destinations: string[] = [];

  for (const composite of citiesNormalized) {
    // Skip placeholder-only composites that somehow lack a custom value
    const label = resolveDestinationLabel(composite, formData, customCountry);
    if (!label) {
      if (composite.includes(':other') || composite.startsWith('other:')) {
        return { ok: false, error: ar.tripForm.otherCityRequired };
      }
      return { ok: false, error: ar.errors.trip.cityRequired };
    }
    destinations.push(label);
  }

  // Final guard: never insert raw placeholders into Supabase
  const leaked = destinations.filter(
    (d) =>
      d === 'other' ||
      d === 'أخرى' ||
      d.endsWith('— أخرى') ||
      d.endsWith('— other') ||
      /:other\b/i.test(d),
  );
  if (leaked.length > 0) {
    return { ok: false, error: ar.tripForm.otherCityRequired };
  }

  if (destinations.length === 0) {
    return { ok: false, error: ar.errors.trip.cityRequired };
  }

  return { ok: true, destinations };
}

function buildFinalThoughts(
  dreamFeeling: string,
  visitedBefore: Record<string, 'yes' | 'no'>,
  customCountry: string,
): string {
  const lines = [dreamFeeling];

  const visitLines = Object.entries(visitedBefore).map(([countryId, answer]) => {
    const label = resolveCountryLabel(countryId, customCountry) || countryId;
    return `${label}: ${answer === 'yes' ? 'سبق الزيارة' : 'لم يسبق الزيارة'}`;
  });
  if (visitLines.length > 0) {
    lines.push(`زيارات سابقة:\n${visitLines.join('\n')}`);
  }

  return lines.join('\n\n');
}

export async function submitCustomerLead(formData: FormData): Promise<CustomerLeadState> {
  try {
    const serviceKeyError = assertServiceRoleKeyConfigured();
    if (serviceKeyError) {
      return { ok: false, error: serviceKeyError };
    }

    const admin = createSupabaseAdminClient();

    const full_name = s(formData.get('full_name'));
    const phone_wa_raw = s(formData.get('phone_wa'));
    const phone_wa = canonicalizePhoneWa(phone_wa_raw) || phone_wa_raw;
    const sourceRaw = s(formData.get('source')) || null;
    const lead_source = mapTripFormSourceToLeadSource(sourceRaw);
    const referral_code = normalizeAffiliateRef(s(formData.get('referral_code')));
    const dream_feeling = s(formData.get('dream_feeling'));

    const destCountries = all(formData, 'dest_countries');
    const cities = all(formData, 'cities');
    const customCountry = s(formData.get('dest_countries_other'));
    const travel_date = s(formData.get('travel_start_date')) || null;
    const travel_days_raw = s(formData.get('travel_days'));
    const travelers_count_raw = s(formData.get('travelers_count'));
    const budget = s(formData.get('budget_range')) || null;

    const interests = mergeOtherPref(all(formData, 'interests'), s(formData.get('interests_other')));
    const daily_pace = s(formData.get('pace')) || null;
    const walking_readiness = s(formData.get('walking')) || null;
    const day_start_time = s(formData.get('day_start')) || null;
    const food_preferences = mergeOtherPref(
      all(formData, 'food_prefs'),
      s(formData.get('food_prefs_other')),
    );
    const accommodation_type = mergeOtherPref(
      all(formData, 'lodging_prefs'),
      s(formData.get('lodging_prefs_other')),
    );

    if (!full_name || !phone_wa) {
      return { ok: false, error: ar.errors.trip.namePhone };
    }

    if (!dream_feeling) {
      return { ok: false, error: ar.errors.trip.dreamRequired };
    }

    if (destCountries.length === 0) {
      return { ok: false, error: ar.errors.trip.countryRequired };
    }

    if (destCountries.includes('other') && !customCountry) {
      return { ok: false, error: ar.tripForm.otherCountryRequired };
    }

    if (
      destCountries.includes('other') &&
      (customCountry === 'أخرى' ||
        customCountry === 'Other' ||
        customCountry.toLowerCase() === 'other')
    ) {
      return { ok: false, error: ar.tripForm.otherCountryRequired };
    }

    const citiesNormalized = cities.filter((row) => {
      const i = row.indexOf(':');
      if (i < 1) return false;
      return destCountries.includes(row.slice(0, i));
    });

    if (citiesNormalized.length === 0) {
      return { ok: false, error: ar.errors.trip.cityRequired };
    }

    for (const composite of citiesNormalized) {
      if (!composite.endsWith(':other')) continue;
      const countryId = composite.slice(0, composite.lastIndexOf(':'));
      const customCity = s(formData.get(`city_other_${countryId}`));
      if (
        !customCity ||
        customCity === 'أخرى' ||
        customCity === 'Other' ||
        customCity.toLowerCase() === 'other'
      ) {
        return { ok: false, error: ar.tripForm.otherCityRequired };
      }
    }

    const visitedBefore: Record<string, 'yes' | 'no'> = {};
    for (const cid of destCountries) {
      const raw = s(formData.get(`visited_before_${cid}`));
      if (raw !== 'yes' && raw !== 'no') {
        return {
          ok: false,
          error: ar.errors.trip.visitNotAnswered.replace(
            '{country}',
            resolveCountryLabel(cid, customCountry),
          ),
        };
      }
      visitedBefore[cid] = raw;
    }

    const travel_days = Math.min(90, Math.max(1, parseInt(travel_days_raw || '7', 10) || 7));
    const travelers_count = Math.min(40, Math.max(1, parseInt(travelers_count_raw || '2', 10) || 2));

    const sanitized = sanitizeDestinationsPayload(citiesNormalized, formData, customCountry);
    if (!sanitized.ok) {
      return { ok: false, error: sanitized.error };
    }
    const destinations = sanitized.destinations;

    const row: LeadsInsertRow = {
      full_name,
      email: null,
      phone_wa,
      age: null,
      destinations,
      travel_date,
      travel_days,
      travelers_count,
      budget,
      interests,
      // Design-your-trip = private VIP path (never Group)
      travel_style: 'Private',
      daily_pace,
      walking_readiness,
      day_start_time,
      food_preferences,
      accommodation_type,
      final_thoughts: buildFinalThoughts(dream_feeling, visitedBefore, customCountry),
      form_type: 'trip_log',
      status: 'radar_pending',
    };

    if (lead_source) {
      row.lead_source = lead_source;
    }

    if (referral_code) {
      row.referral_code = referral_code;
    }

    const supabase = admin;
    let insertedLead: InsertedLeadRow | null = null;
    let { data: inserted, error } = await supabase
      .from('leads')
      .insert(row as never)
      .select('id, full_name, phone_wa, email, referral_code')
      .single();

    if (error && /lead_source|column|schema cache|does not exist/i.test(error.message ?? '')) {
      const { lead_source: _dropSource, ...withoutSource } = row;
      ({ data: inserted, error } = await supabase
        .from('leads')
        .insert(withoutSource as never)
        .select('id, full_name, phone_wa, email, referral_code')
        .single());
    }

    if (error && referral_code && (error.message ?? '').toLowerCase().includes('referral_code')) {
      const { referral_code: _drop, ...withoutRef } = row;
      ({ data: inserted, error } = await supabase
        .from('leads')
        .insert(withoutRef as never)
        .select('id, full_name, phone_wa, email')
        .single());
    }

    if (!error && inserted?.id) {
      insertedLead = mapInsertedLeadRow(inserted);
    }

    if (error && !insertedLead) {
      console.error('Supabase Error:', error);
      return {
        ok: false,
        error: formatSupabaseInsertError(error),
      };
    }

    // Insert appeared to succeed but select returned nothing — reclaim only a brand-new row
    if (!insertedLead && phone_wa) {
      const since = new Date(Date.now() - 120_000).toISOString();
      const fallback = await supabase
        .from('leads')
        .select('id, full_name, phone_wa, email, referral_code, created_at')
        .eq('phone_wa', phone_wa)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fallback.data?.id) {
        insertedLead = mapInsertedLeadRow(fallback.data);
      }
    }

    if (!insertedLead?.id) {
      return { ok: false, error: ar.errors.trip.dbSaveFailed };
    }

    const dashboardUrl = `${String(
      process.env.NEXT_PUBLIC_SITE_URL ??
        'https://wanderloom-travel.vercel.app',
    ).replace(/\/$/, '')}/crm/radar`;
    const destinationText = destinations.length
      ? destinations.join('، ')
      : destCountries.map((cid) => resolveCountryLabel(cid, customCountry)).join('، ');

    await sendEmailAlert(
      '✈️ طلب رحلة جديد بانتظار المراجعة - Wanderloom',
      `
        <div dir="rtl" style="background:#f7f5ef;padding:32px;font-family:Arial,Tahoma,sans-serif;color:#17251d">
          <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e8dcc0;border-radius:20px;overflow:hidden">
            <div style="background:#10251b;padding:24px 28px;color:#ffffff">
              <div style="color:#c4a464;font-size:12px;font-weight:700;letter-spacing:2px">WANDERLOOM TRIP REQUEST</div>
              <h1 style="margin:10px 0 0;font-size:22px">طلب رحلة جديد</h1>
            </div>
            <div style="padding:28px">
              <p style="margin:0 0 22px;color:#5d665f;line-height:1.8">وصل طلب تصميم رحلة جديد وهو الآن بانتظار المراجعة في الرادار.</p>
              <table role="presentation" style="width:100%;border-collapse:collapse;font-size:15px">
                <tr><td style="padding:12px;border-bottom:1px solid #eee;color:#6b746e">اسم العميل</td><td style="padding:12px;border-bottom:1px solid #eee;font-weight:700">${escapeEmailHtml(full_name)}</td></tr>
                <tr><td style="padding:12px;border-bottom:1px solid #eee;color:#6b746e">رقم الجوال</td><td dir="ltr" style="padding:12px;border-bottom:1px solid #eee;font-weight:700;text-align:right">${escapeEmailHtml(phone_wa)}</td></tr>
                <tr><td style="padding:12px;border-bottom:1px solid #eee;color:#6b746e">الوجهات</td><td style="padding:12px;border-bottom:1px solid #eee;font-weight:700">${escapeEmailHtml(destinationText)}</td></tr>
                <tr><td style="padding:12px;color:#6b746e">التاريخ التقريبي</td><td style="padding:12px;font-weight:700">${escapeEmailHtml(travel_date || 'غير محدد')}</td></tr>
              </table>
              <div style="margin-top:26px;text-align:center">
                <a href="${dashboardUrl}" style="display:inline-block;background:#c4a464;color:#10251b;text-decoration:none;padding:13px 24px;border-radius:999px;font-weight:700">فتح رادار الطلبات</a>
              </div>
            </div>
          </div>
        </div>
      `,
    );

    try {
      const siteOrigin =
        String(process.env.NEXT_PUBLIC_SITE_URL ?? '').trim() ||
        'https://wanderloom-travel.vercel.app';
      const automation = await runRegistrationAutomationPipeline({
        leadId: insertedLead.id,
        fullName: insertedLead.full_name,
        phoneWa: insertedLead.phone_wa || phone_wa,
        email: insertedLead.email,
        referralCode: insertedLead.referral_code ?? null,
        source: 'website_trip_request',
        origin: siteOrigin,
      });
      if (!automation.intake) {
        console.warn(
          '[submitCustomerLead] intake not ready:',
          automation.errors.join('; ') || 'unknown',
        );
      }
    } catch (intakeErr) {
      console.error('[submitCustomerLead] registration automation:', intakeErr);
      // Lead is already saved — do not fail the user for WhatsApp/notification issues.
      // Still attempt legacy intake so DNA token exists (no second WhatsApp attempt here).
      try {
        await runWebsiteLeadIntakeAutomation(admin, {
          id: insertedLead.id,
          full_name: insertedLead.full_name,
          phone_wa: insertedLead.phone_wa || phone_wa,
          email: insertedLead.email,
          referral_code: insertedLead.referral_code ?? null,
        });
      } catch (fallbackErr) {
        console.error('[submitCustomerLead] client intake fallback:', fallbackErr);
      }
    }

    revalidatePath('/');
    revalidatePath('/sessions');
    revalidatePath('/crm/radar');
    return {
      ok: true,
      message: ar.success.tripLeadSent,
    };
  } catch (error) {
    console.error('Supabase Error:', error);
    return {
      ok: false,
      error: formatThrownError(error),
    };
  }
}

export type EnsureLeadClientActionResult =
  | { ok: true; clientId: number; reusedExisting: boolean }
  | { ok: false; error: string };

/** يُنشئ/يربط عميلاً لطلب leads — Smart recognition by phone_wa (returning customers) */
export async function ensureLeadClientAction(
  leadId: string,
  fallback?: { name?: string | null; phone?: string | null; email?: string | null },
): Promise<EnsureLeadClientActionResult> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return { ok: false, error: serviceKeyError };
  }

  const key = String(leadId ?? '').trim();
  if (!key) {
    return { ok: false, error: 'معرّف الطلب غير صالح.' };
  }

  try {
    const result = await ensureLeadClientIntakeAdmin(key);
    revalidatePath('/crm/radar');
    revalidatePath('/crm/clients');
    revalidatePath('/crm/pipeline');
    revalidatePath('/crm');
    revalidatePath('/crm', 'layout');
    return {
      ok: true,
      clientId: result.clientId,
      reusedExisting: result.reusedExisting,
    };
  } catch (err) {
    console.warn('[ensureLeadClientAction] primary failed, directory heal:', err);
    try {
      const result = await ensureClientFromDirectoryFieldsAdmin({
        leadId: key,
        name: fallback?.name,
        phone: fallback?.phone,
        email: fallback?.email,
      });
      revalidatePath('/crm/clients');
      revalidatePath('/crm');
      revalidatePath('/crm', 'layout');
      return {
        ok: true,
        clientId: result.clientId,
        reusedExisting: result.reusedExisting,
      };
    } catch (healErr) {
      console.error('[ensureLeadClientAction] self-heal failed:', healErr);
      const primaryMsg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message?: unknown }).message ?? '')
            : '';
      const healMsg =
        healErr instanceof Error
          ? healErr.message
          : typeof healErr === 'object' && healErr && 'message' in healErr
            ? String((healErr as { message?: unknown }).message ?? '')
            : '';
      return {
        ok: false,
        error:
          healMsg ||
          primaryMsg ||
          'تعذر ربط ملف العميل بالطلب — راجع سجلات الخادم لتفاصيل Supabase.',
      };
    }
  }
}

/**
 * يضمن صف clients لكل طلب تجاوز الرادار (awaiting_dna فما بعد)
 * — يصلح الفجوة عندما تُحدَّث leads.status دون إنشاء عميل.
 */
export async function syncPipelineLeadsToClientsAction(): Promise<
  { ok: true; synced: number } | { ok: false; error: string }
> {
  const serviceKeyError = assertServiceRoleKeyConfigured();
  if (serviceKeyError) {
    return { ok: false, error: serviceKeyError };
  }

  try {
    const admin = createSupabaseAdminClient();
    // Do NOT select leads.client_id — column may be missing until clients_intake_pipeline.sql
    const { data, error } = await admin
      .from('leads')
      .select('id, status, phone_wa, full_name')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return { ok: false, error: error.message || 'تعذر قراءة الطلبات.' };
    }

    const orphans = (data ?? []).filter((row) => {
      const status = normalizeLeadStatus((row as { status?: unknown }).status);
      return CLIENT_DATABASE_LEAD_STATUSES.includes(status);
    });

    let synced = 0;
    for (const row of orphans.slice(0, 40)) {
      const leadId = String((row as { id?: unknown }).id ?? '').trim();
      if (!leadId) continue;
      try {
        await ensureLeadClientIntakeAdmin(leadId);
        synced += 1;
      } catch (err) {
        console.warn('[syncPipelineLeadsToClients]', leadId, err);
      }
    }

    revalidatePath('/crm/clients');
    revalidatePath('/crm');
    revalidatePath('/crm', 'layout');
    return { ok: true, synced };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'تعذر مزامنة العملاء من الطلبات.',
    };
  }
}
