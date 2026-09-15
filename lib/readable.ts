import type { FieldType } from "@/lib/fields";
import { dayjs, fmtNumber } from "@/lib/format";

export type Option = { value: string; label: string };

// Valeur lisible au repos : nombre avec son unité, date en clair, libellé de la liste, texte tel quel.
// Module sans « use client » : utilisable aussi côté serveur (fiche, exports).
export function readableValue(p: { type: FieldType; value: string | number | boolean | Date | null | undefined; options?: Option[]; suffix?: string }): string {
  const v = p.value;
  if (v === null || v === undefined || v === "") return "";
  switch (p.type) {
    case "number": return `${fmtNumber(Number(v), 2)}${p.suffix ? ` ${p.suffix}` : ""}`;
    case "date": return dayjs(v instanceof Date ? v : String(v)).format("D MMMM YYYY");
    case "select": return p.options?.find((o) => o.value === String(v))?.label ?? String(v);
    case "bool": return v ? "Oui" : "Non";
    default: return String(v);
  }
}
