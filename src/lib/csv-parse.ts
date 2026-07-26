/**
 * Lightweight CSV parser (quoted fields, commas, UTF-8 BOM).
 * No external dependency — suitable for CRM bulk uploads.
 */

export function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const raw = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = splitCsvLines(raw);
  if (!lines.length) return { headers: [], rows: [] };

  const headers = lines[0].map((h) => h.trim());
  const rows = lines
    .slice(1)
    .map((cols) => cols.map((c) => c.trim()))
    .filter((cols) => cols.some((c) => c.length > 0));

  return { headers, rows };
}

function splitCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        continue;
      }
      field += ch;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function rowsToObjects(
  headers: string[],
  rows: string[][],
): Record<string, string>[] {
  return rows.map((cols) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      const key = h.trim();
      if (!key) return;
      obj[key] = String(cols[i] ?? '').trim();
    });
    return obj;
  });
}

/** Normalize header for alias matching */
export function normalizeHeaderKey(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, '')
    .replace(/[\s\-]+/g, '_');
}

export function pickField(
  row: Record<string, string>,
  aliases: string[],
): string {
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(row)) {
    map.set(normalizeHeaderKey(k), v);
  }
  for (const alias of aliases) {
    const hit = map.get(normalizeHeaderKey(alias));
    if (hit != null && hit !== '') return hit;
  }
  return '';
}
