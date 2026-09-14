function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180-ish CSV: CRLF row separator, quote only when a field needs it.
 * Every row uses the first row's key order — this codebase's export always
 * calls it with rows of one zod-validated shape, so key order is stable. Pure. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const keys = Object.keys(rows[0]!);
  const lines = [keys.join(','), ...rows.map((row) => keys.map((k) => cell(row[k])).join(','))];
  return lines.join('\r\n');
}
