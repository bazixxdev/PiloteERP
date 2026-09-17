import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

// Base de test remise à zéro avant les recettes (DATABASE_URL = base de test, posée par playwright.config.ts ; migrée par la
// commande du serveur de test).
export default function globalSetup() {
  mkdirSync("uploads-test", { recursive: true });
  const env = { ...process.env, UPLOAD_DIR: "./uploads-test" };
  execSync("npx prisma db seed", { stdio: "inherit", env });
}
