import ExcelJS from "exceljs";

export const MAX_SPREADSHEET_BYTES = 10 * 1024 * 1024;
export const MAX_SPREADSHEET_ROWS = 20_000;
export const MAX_SPREADSHEET_COLUMNS = 100;

function csvRows(text: string): string[][] {
  const sep = text.split("\n")[0]?.includes(";") ? ";" : ",";
  return text.replace(/\r/g, "").split("\n").filter((l) => l.trim()).map((line) => {
    const out: string[] = []; let cell = ""; let quoted = false;
    for (const ch of line) { if (ch === '"') quoted = !quoted; else if (ch === sep && !quoted) { out.push(cell.trim()); cell = ""; } else cell += ch; }
    out.push(cell.trim()); return out;
  });
}

export async function readSpreadsheet(buf: ArrayBuffer | Uint8Array, name: string): Promise<string[][]> {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (bytes.byteLength === 0) throw new Error("Le fichier est vide.");
  if (bytes.byteLength > MAX_SPREADSHEET_BYTES) throw new Error("Fichier trop volumineux (10 Mo maximum).");
  if (/\.csv$/i.test(name)) return csvRows(new TextDecoder().decode(bytes));
  if (!/\.xlsx$/i.test(name)) throw new Error("Format non supporté : utilisez .xlsx ou .csv.");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(bytes) as never);
  if (wb.worksheets.length === 0 || wb.worksheets.length > 5) throw new Error("Nombre de feuilles non supporté (1 à 5).");
  const sheet = wb.worksheets[0];
  if (sheet.columnCount > MAX_SPREADSHEET_COLUMNS || sheet.rowCount > MAX_SPREADSHEET_ROWS) throw new Error("Le fichier contient trop de lignes ou de colonnes.");
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = Array.from({ length: Math.min(sheet.columnCount, MAX_SPREADSHEET_COLUMNS) }, (_, i) => {
      const v = row.getCell(i + 1).value;
      return v == null ? "" : String(typeof v === "object" && "text" in v ? v.text : v).trim();
    });
    if (values.some(Boolean)) rows.push(values);
  });
  return rows;
}
