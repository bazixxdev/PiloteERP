import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { test } from "node:test";
import { readSpreadsheet } from "../../lib/spreadsheet";

test("lit un XLSX de contacts et conserve les accents", async () => {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Contacts"); ws.addRow(["Nom", "Prénom"]); ws.addRow(["Été", "Zoë"]);
  const rows = await readSpreadsheet(new Uint8Array(await wb.xlsx.writeBuffer()), "contacts.xlsx");
  assert.deepEqual(rows[1], ["Été", "Zoë"]);
});

test("refuse les formats et tailles non supportés avant traitement", async () => {
  await assert.rejects(() => readSpreadsheet(new Uint8Array([1, 2, 3]), "contacts.xls"), /Format non supporté/);
  await assert.rejects(() => readSpreadsheet(new Uint8Array(10 * 1024 * 1024 + 1), "contacts.xlsx"), /trop volumineux/);
});
