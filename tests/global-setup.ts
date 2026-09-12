import { execSync } from "node:child_process";

// Base de démo remise à zéro avant les recettes.
export default function globalSetup() {
  execSync("npx prisma db seed", { stdio: "inherit" });
}
