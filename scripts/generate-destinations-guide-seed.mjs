/**
 * يولّد supabase/sql/destinations_guide_seed_21_countries.sql من dg-seed-data.mjs
 * التشغيل: node scripts/generate-destinations-guide-seed.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SEED_ROWS } from './dg-seed-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outFile = path.join(root, 'supabase', 'sql', 'destinations_guide_seed_21_countries.sql');

function sqlStr(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

const values = SEED_ROWS.map(
  (r) =>
    `(${sqlStr(r.country_id)}, ${sqlStr(r.city_id)}, ${sqlStr(r.culture)}, ${sqlStr(r.guidelines)}, ${sqlStr(
      r.weather_seasons
    )}, ${sqlStr(r.professional_impression)}, ${sqlStr(r.highlights)})`
).join(',\n');

const sql = `-- دليل الوجهات — 21 دولة (قائمة CRM الحصرية)
-- نفّذ بعد: destinations_guide.sql ثم destinations_guide_add_highlights.sql
-- التوليد: node scripts/generate-destinations-guide-seed.mjs

INSERT INTO public.destinations_guide (
  country_id,
  city_id,
  culture,
  guidelines,
  weather_seasons,
  professional_impression,
  highlights
)
VALUES
${values}
ON CONFLICT (country_id, city_id) DO UPDATE SET
  culture = EXCLUDED.culture,
  guidelines = EXCLUDED.guidelines,
  weather_seasons = EXCLUDED.weather_seasons,
  professional_impression = EXCLUDED.professional_impression,
  highlights = EXCLUDED.highlights,
  updated_at = now();
`;

fs.writeFileSync(outFile, sql, 'utf8');
console.log('Wrote', outFile, `(${SEED_ROWS.length} rows)`);
