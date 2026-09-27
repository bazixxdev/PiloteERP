// Tâche 19 (guide de l'outil, spec vocabulaire l.16) : « bureau » disparaît chez TLST, la CRESS garde un vrai bureau. Le
// libellé par défaut du référentiel decision_instance/board vient désormais de la config client (lib/refs.ts, V.board) —
// CRESS « Bureau / CA », TLST « CA ». Mais une base déjà seedée avant ce changement peut porter en dur l'ancien libellé par
// défaut « Bureau / CA » dans sa table RefValue (prisma/seeds/common.ts écrit REF_DEFAULTS une fois, à la création de la base) :
// ce script le corrige, sans migration SQL (une migration toucherait aussi la base CRESS, qui garde ce libellé).
//
// Idempotent : ne touche que la ligne family="decision_instance" code="board" qui vaut ENCORE l'ancien défaut exact — une
// valeur déjà personnalisée dans l'admin n'est jamais écrasée, et relancer le script après un premier passage ne fait plus rien.
//
// Jamais lancé automatiquement. À la main, avec DATABASE_URL pointant explicitement la base TLST visée :
//   DATABASE_URL=postgresql://... npx tsx scripts/fix-board-label-tlst.ts           (dry-run : affiche ce qui changerait)
//   DATABASE_URL=postgresql://... npx tsx scripts/fix-board-label-tlst.ts --apply   (écrit)
// Testé uniquement sur pilote_test_tlst (jamais pilote_dev, jamais une base CRESS, jamais sans DATABASE_URL explicite).
//
// Garde de nom de base plutôt que de simple présence de la variable : `@prisma/client` charge lui-même `.env` s'il n'a pas
// déjà `DATABASE_URL` en environnement (comme les commandes npm/prisma, AGENTS.md) — la seule garde fiable est donc de
// n'agir que si le nom de la base cible contient « tlst », jamais d'afficher l'URL en clair (identifiants).
import { tlst } from "../config/clients/tlst";

const FAMILY = "decision_instance";
const CODE = "board";
const OLD_DEFAULT = "Bureau / CA"; // ancien défaut, avant que ce libellé devienne un mot du vocabulaire client (T19)
const NEW_LABEL = tlst.vocab.board.one; // "CA" — source unique : config/clients/tlst.ts

function databaseName(url: string): string | null {
  try {
    return new URL(url).pathname.replace(/^\//, "") || null;
  } catch {
    return null;
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  const dbName = url ? databaseName(url) : null;
  if (!dbName) {
    console.error("✖ DATABASE_URL manquant ou invalide : ce script ne devine jamais la base visée, il faut la passer explicitement.");
    process.exit(1);
  }
  if (!/tlst/i.test(dbName)) {
    console.error(`✖ Ce script ne touche que les bases TLST (la CRESS garde « Bureau / CA ») ; le nom de la base cible (« ${dbName} ») ne contient pas « tlst ».`);
    process.exit(1);
  }

  const apply = process.argv.includes("--apply");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const row = await prisma.refValue.findUnique({ where: { family_code: { family: FAMILY, code: CODE } } });
    if (!row) {
      console.log(`— [${dbName}] aucune ligne ${FAMILY}/${CODE} en base : rien à faire (le libellé par défaut du code, « ${NEW_LABEL} », s'applique déjà).`);
      return;
    }
    if (row.label !== OLD_DEFAULT) {
      console.log(`— [${dbName}] ${FAMILY}/${CODE} vaut déjà « ${row.label} » (≠ ancien défaut « ${OLD_DEFAULT} ») : rien à faire, valeur gardée telle quelle.`);
      return;
    }
    console.log(`[${dbName}] ${apply ? "✔ réécriture" : "(dry-run) réécrirait"} ${FAMILY}/${CODE} : « ${row.label} » → « ${NEW_LABEL} »`);
    if (apply) {
      await prisma.refValue.update({ where: { id: row.id }, data: { label: NEW_LABEL } });
      console.log("✔ fait.");
    } else {
      console.log("Rien écrit — relancer avec --apply pour appliquer.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
