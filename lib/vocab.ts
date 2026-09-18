// Les mots de l'outil, une fois pour toutes (lot I) : « édition » à la CRESS, « action » chez TLST… Le code métier n'écrit
// jamais ces mots en dur dans ce qui s'affiche : il passe par V et ces helpers (scripts/check-vocab.mjs y veille). Les
// commentaires de code gardent les mots CRESS. Les clés techniques (routes, data-testid, colonnes) ne bougent pas.
import { client } from "@/config/clients";
import type { Word } from "@/config/clients/types";

export type { Word };

export const V = {
  ...client.vocab,
  org: { one: client.shortName, many: client.shortName, gender: client.orgGender } as Word,
  orgLong: client.longName,
};

// Élision : voyelle ou h muet en tête (« l'édition », « d'équipe »). Les sigles en capitales ne s'élident pas (« la CRESS »).
export function elide(s: string): boolean {
  if (/^[A-Z]{2,}$/.test(s)) return false;
  return /^[aeiouyàâäéèêëîïôöùûüh]/i.test(s);
}

export const cap = (w: Word | string): string => {
  const s = typeof w === "string" ? w : w.one;
  return s.charAt(0).toLocaleUpperCase("fr-FR") + s.slice(1);
};
export const Cap = cap;
export const pl = (w: Word): string => w.many;
// « 1 équipe » / « 3 équipes ».
export const nb = (count: number, w: Word): string => `${count} ${count > 1 ? w.many : w.one}`;

export const le = (w: Word): string => (elide(w.one) ? `l'${w.one}` : `${w.gender === "f" ? "la" : "le"} ${w.one}`);
export const les = (w: Word): string => `les ${w.many}`;
export const un = (w: Word): string => `${w.gender === "f" ? "une" : "un"} ${w.one}`;
export const du = (w: Word): string => (elide(w.one) ? `de l'${w.one}` : w.gender === "f" ? `de la ${w.one}` : `du ${w.one}`);
export const des = (w: Word): string => `des ${w.many}`;
export const de = (w: Word): string => (elide(w.one) ? `d'${w.one}` : `de ${w.one}`);
export const au = (w: Word): string => (elide(w.one) ? `à l'${w.one}` : w.gender === "f" ? `à la ${w.one}` : `au ${w.one}`);
export const aux = (w: Word): string => `aux ${w.many}`;
export const ce = (w: Word): string => `${w.gender === "f" ? "cette" : elide(w.one) ? "cet" : "ce"} ${w.one}`;
// « mon pôle » / « mon équipe » (mon devant une voyelle, même au féminin) / « ma coordination ».
export const mon = (w: Word): string => `${w.gender === "f" && !elide(w.one) ? "ma" : "mon"} ${w.one}`;
export const son = (w: Word): string => `${w.gender === "f" && !elide(w.one) ? "sa" : "son"} ${w.one}`;
// « seule la RAF » / « seul le trésorier » (sujet singulier en tête de phrase : cap(seul(V.raf))).
export const seul = (w: Word): string => `${w.gender === "f" ? "seule" : "seul"} ${le(w)}`;
// « aucune édition » / « aucun pôle ».
export const aucun = (w: Word): string => `${w.gender === "f" ? "aucune" : "aucun"} ${w.one}`;
export const tout = (w: Word): string => `${w.gender === "f" ? "toute" : "tout"} ${le(w)}`;
export const tous = (w: Word): string => `${w.gender === "f" ? "toutes" : "tous"} les ${w.many}`;
// Accord d'un adjectif antéposé : adj(V.pole, "nouveau", "nouvelle") → « nouveau pôle » / « nouvelle équipe ».
export const adj = (w: Word, masc: string, fem: string): string => `${w.gender === "f" ? fem : masc} ${w.one}`;
// Accord d'un participe ou adjectif postposé, avec le mot : ppe(V.edition, "validé") → « édition validée ».
export const ppe = (w: Word, base: string): string => `${w.one} ${base}${w.gender === "f" ? "e" : ""}`;
// Seulement la terminaison, pour un adjectif écrit ailleurs dans la phrase.
export const e = (w: Word): string => (w.gender === "f" ? "e" : "");
