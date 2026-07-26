import { createAdminClient, loadE2EEnv } from './env';

export type SeededLead = {
  id: string;
  fullName: string;
  phoneWa: string;
};

/**
 * Insert a radar_pending lead so the journey can approve a known fixture.
 * Marker prefix keeps fixtures easy to find/clean: `[E2E-JOURNEY] …`
 */
export async function seedRadarPendingLead(): Promise<SeededLead> {
  const env = loadE2EEnv();
  const admin = createAdminClient(env);
  const stamp = Date.now();
  const fullName = `[E2E-JOURNEY] أفراح ${stamp}`;
  // Unique SA-looking mobile (not a real customer number)
  const phoneWa = `9665${String(stamp).slice(-8)}`;

  const payload = {
    full_name: fullName,
    phone_wa: phoneWa,
    status: 'radar_pending',
    destinations: ['كوريا الجنوبية'],
    travel_date: null,
    travelers_count: 2,
    travel_days: 5,
    source: 'e2e_core_journey',
  };

  const { data, error } = await admin.from('leads').insert(payload).select('id').single();

  if (error || !data?.id) {
    // Minimal fallback if some columns are missing
    const minimal = {
      full_name: fullName,
      phone_wa: phoneWa,
      status: 'radar_pending',
    };
    const retry = await admin.from('leads').insert(minimal).select('id').single();
    if (retry.error || !retry.data?.id) {
      throw new Error(
        `Failed to seed E2E lead: ${error?.message || retry.error?.message || 'unknown'}`,
      );
    }
    return { id: String(retry.data.id), fullName, phoneWa };
  }

  return { id: String(data.id), fullName, phoneWa };
}
