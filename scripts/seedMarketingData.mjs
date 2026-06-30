/**
 * استيراد بيانات التسويق من ملفات CSV إلى Supabase
 *
 * 1. نفّذ supabase/sql/marketing_hub.sql في Supabase SQL Editor
 * 2. ضع ملفات CSV في data/marketing-csv/
 * 3. شغّل: npm run seed:marketing
 *
 * الملفات المتوقعة (أي منها اختياري):
 *   data/marketing-csv/ai-prompts.csv
 *   data/marketing-csv/human-scripts.csv
 *   data/marketing-csv/calendar.csv
 *   data/marketing-csv/brand-identity.csv
 *
 * يمكن أيضاً وضع عدة ملفات في:
 *   data/marketing-csv/ai/*.csv
 *   data/marketing-csv/human/*.csv
 *   data/marketing-csv/calendar/*.csv
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, extname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CSV_ROOT = join(ROOT, 'data', 'marketing-csv');

function loadEnvLocal() {
  const envPath = join(ROOT, '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

/** RFC4180-ish CSV parser */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field.trim());
      field = '';
    } else if (c === '\n' || (c === '\r' && next === '\n')) {
      row.push(field.trim());
      field = '';
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      if (c === '\r') i++;
    } else if (c !== '\r') {
      field += c;
    }
  }

  if (field.length || row.length) {
    row.push(field.trim());
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? '';
    });
    return obj;
  });
}

function normalizeHeader(h) {
  return String(h)
    .trim()
    .toLowerCase()
    .replace(/\ufeff/g, '')
    .replace(/\s+/g, '_');
}

function pick(row, aliases, fallback = '') {
  for (const key of aliases) {
    const v = row[normalizeHeader(key)];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return fallback;
}

function splitList(value) {
  if (!value) return [];
  return String(value)
    .split(/\||\n|;(?=\s)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeCategory(value) {
  const v = String(value || 'local').toLowerCase();
  if (['seasonal', 'local', 'shareable'].includes(v)) return v;
  if (v.includes('season')) return 'seasonal';
  if (v.includes('share')) return 'shareable';
  return 'local';
}

function collectCsvFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...collectCsvFiles(full));
    else if (extname(entry).toLowerCase() === '.csv') out.push(full);
  }
  return out;
}

function classifyFile(filePath) {
  const name = basename(filePath).toLowerCase();
  const parent = basename(dirname(filePath)).toLowerCase();
  const hay = `${parent}/${name}`;

  if (/ai|prompt|midjourney|sora|factory/.test(hay)) return 'ai';
  if (/human|script|playbook|tiktok|instagram|reel|carousel/.test(hay)) return 'human';
  if (/calendar|schedule|content_plan/.test(hay)) return 'calendar';
  if (/brand|identity|scarf|slogan/.test(hay)) return 'brand';
  return 'unknown';
}

function readCsvRecords(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  return parseCsv(raw);
}

async function seedAi(supabase, records, sortStart) {
  const rows = records
    .map((row, index) => ({
      category: normalizeCategory(pick(row, ['category', 'type', 'تصنيف', 'نوع'])),
      campaign: pick(row, ['campaign', 'title', 'name', 'حملة', 'اسم_الحملة']),
      visual_prompt: pick(row, ['visual_prompt', 'prompt', 'visualprompt', 'برومبت', 'ai_prompt']),
      caption: pick(row, ['caption', 'text', 'copy', 'كابشن', 'النص']),
      hashtags: pick(row, ['hashtags', 'tags', 'هاشتاج', 'هاشتاقات']),
      status: pick(row, ['status', 'الحالة'], 'جاهز للتوليد'),
      sort_order: sortStart + index,
    }))
    .filter((r) => r.visual_prompt || r.campaign);

  if (!rows.length) return 0;
  const { error } = await supabase.from('marketing_ai_prompts').insert(rows);
  if (error) throw new Error(`AI prompts: ${error.message}`);
  return rows.length;
}

async function seedHuman(supabase, records, sortStart) {
  const rows = records
    .map((row, index) => ({
      title: pick(row, ['title', 'name', 'script_title', 'العنوان']),
      platform: pick(row, ['platform', 'channel', 'المنصة'], 'Instagram'),
      hook: pick(row, ['hook', 'opening', 'الخطاف']),
      shot_list: splitList(pick(row, ['shot_list', 'shots', 'shotlist', 'زوايا_التصوير', 'shot_list_items'])),
      voiceover_script: pick(row, ['voiceover_script', 'voiceover', 'script', 'التعليق_الصوتي']),
      carousel_structure: pick(row, ['carousel_structure', 'carousel', 'structure', 'هيكل_الكاروسel']),
      status: pick(row, ['status', 'الحالة'], 'بانتظار التصوير'),
      sort_order: sortStart + index,
    }))
    .filter((r) => r.title || r.hook || r.voiceover_script);

  if (!rows.length) return 0;
  const { error } = await supabase.from('marketing_human_scripts').insert(rows);
  if (error) throw new Error(`Human scripts: ${error.message}`);
  return rows.length;
}

async function seedCalendar(supabase, records, sortStart) {
  const rows = records
    .map((row, index) => ({
      month_week: pick(row, ['month_week', 'month', 'week', 'date', 'الأسبوع', 'الشهر']),
      topic: pick(row, ['topic', 'subject', 'الموضوع']),
      format: pick(row, ['format', 'type', 'الصيغة'], 'Reel'),
      platform: pick(row, ['platform', 'channel', 'المنصة'], 'Instagram'),
      sort_order: sortStart + index,
    }))
    .filter((r) => r.topic || r.month_week);

  if (!rows.length) return 0;
  const { error } = await supabase.from('marketing_calendar').insert(rows);
  if (error) throw new Error(`Calendar: ${error.message}`);
  return rows.length;
}

async function seedBrand(supabase, records) {
  const row = records[0];
  if (!row) return 0;

  const payload = {
    slug: 'default',
    slogan: pick(row, ['slogan', 'tagline', 'الشعار', 'السلوجن'], 'واندرلوم: تفصيل لا تنظيم'),
    ai_scarf_prompt_rule: pick(row, [
      'ai_scarf_prompt_rule',
      'scarf_prompt',
      'scarf_rule',
      'signature_scarf',
      'قاعدة_السكارف',
    ]),
    brand_colors: pick(row, ['brand_colors', 'design_rules', 'colors', 'قواعد_التصميم', 'الألوان']),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('brand_identity').upsert(payload, { onConflict: 'slug' });
  if (error) throw new Error(`Brand identity: ${error.message}`);
  return 1;
}

async function countTable(supabase, table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) return 0;
  return count ?? 0;
}

async function main() {
  loadEnvLocal();

  const url = 'https://mkbfanmzhuxreztrafel.supabase.co';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rYmZhbm16aHV4cmV6dHJhZmVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMTA4OTUsImV4cCI6MjA5MjY4Njg5NX0.qn2ygifWchBziK8Le8w-fuuZB3NL_t8FkUoPPA-4CM8';

  const supabase = createClient(url, key);

  if (!existsSync(CSV_ROOT)) {
    console.error(`❌ CSV folder not found: ${CSV_ROOT}`);
    console.error('   Create data/marketing-csv/ and add your CSV files.');
    process.exit(1);
  }

  const files = collectCsvFiles(CSV_ROOT);

  if (!files.length) {
    console.warn(`⚠️  No CSV files in ${CSV_ROOT}`);
    process.exit(0);
  }

  let aiCount = await countTable(supabase, 'marketing_ai_prompts');
  let humanCount = await countTable(supabase, 'marketing_human_scripts');
  let calendarCount = await countTable(supabase, 'marketing_calendar');

  const totals = { ai: 0, human: 0, calendar: 0, brand: 0 };

  for (const file of files) {
    const kind = classifyFile(file);
    const records = readCsvRecords(file);
    console.log(`📄 ${basename(file)} → ${kind} (${records.length} rows)`);

    if (kind === 'ai') {
      totals.ai += await seedAi(supabase, records, aiCount);
      aiCount += records.length;
    } else if (kind === 'human') {
      totals.human += await seedHuman(supabase, records, humanCount);
      humanCount += records.length;
    } else if (kind === 'calendar') {
      totals.calendar += await seedCalendar(supabase, records, calendarCount);
      calendarCount += records.length;
    } else if (kind === 'brand') {
      totals.brand += await seedBrand(supabase, records);
    } else {
      console.warn(`   ↳ Skipped (unknown type). Rename to include ai|human|calendar|brand`);
    }
  }

  console.log('\n✅ Seed complete');
  console.log(`   AI prompts:      +${totals.ai}`);
  console.log(`   Human scripts:   +${totals.human}`);
  console.log(`   Calendar slots:  +${totals.calendar}`);
  console.log(`   Brand identity:  ${totals.brand ? 'updated' : 'unchanged'}`);
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
