// Sérialisation CSV sûre pour les tableurs : une entrée utilisateur ne doit
// jamais être interprétée comme une formule.
export function csvCell(value: unknown): string {
  const raw = value == null ? "" : value instanceof Date ? value.toISOString() : String(value);
  const safe = /^[\t\r\n ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(";");
}
