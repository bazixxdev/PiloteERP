// Seed de l'instance (lot I) : le client vient de NEXT_PUBLIC_CLIENT (cress par défaut) ; `--skeleton` = sans données de démo.
import { PrismaClient } from "@prisma/client";
import path from "node:path";
import { client } from "../config/clients";
import { seedCommon } from "./seeds/common";
import { seedCress } from "./seeds/cress";
import { seedTlst } from "./seeds/tlst";

const prisma = new PrismaClient();
const uploads = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
const skeleton = process.argv.includes("--skeleton");

async function main() {
  const common = await seedCommon(prisma, uploads);
  switch (client.key) { // vocab-ok — l'aiguillage du seed est le seul endroit qui lit la clé (docs/produit.md)
    case "cress": await seedCress(prisma, common, uploads); break;
    case "tlst": await seedTlst(prisma, common, { skeleton }); break;
    default: throw new Error(`Pas de seed pour le client « ${client.key} »`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
