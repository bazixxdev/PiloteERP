import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import type { FullConfig } from "@playwright/test";
import { TLST_DATABASE_URL, TLST_PORT } from "../playwright.config";

// Base de test remise à zéro avant les recettes (DATABASE_URL = base de test, posée par playwright.config.ts ; migrée par la
// commande du serveur de test). Puis une session est ouverte par l'API (compte de démo de la direction) et gardée dans
// tests/.auth/state.json : chaque test démarre connecté ; « Changer d'utilisateur » (mode démo) change la personne.
export default async function globalSetup(config: FullConfig) {
  mkdirSync("uploads-test", { recursive: true });
  mkdirSync("tests/.auth", { recursive: true });
  const env = { ...process.env, UPLOAD_DIR: "./uploads-test" };
  // Le setup doit être autonome, y compris lorsque BASE_URL pointe vers un
  // serveur déjà démarré qui n'a pas exécuté les migrations de cette base.
  execSync("npx prisma migrate reset --force --skip-seed", { stdio: "inherit", env });
  execSync("npx prisma db seed", { stdio: "inherit", env });

  const baseURL = config.projects[0].use.baseURL ?? "http://localhost:3100";
  await signIn(baseURL, "claire.vasseur@exemple.fr", "tests/.auth/state.json");

  // Instance TLST (lot I) : sa base, son seed, sa session (la coordinatrice du seed TLST).
  if (config.projects.some((p) => p.name === "tlst")) {
    mkdirSync("uploads-test-tlst", { recursive: true });
    execSync("npx prisma migrate reset --force --skip-seed && npx prisma db seed", { stdio: "inherit", env: { ...env, DATABASE_URL: TLST_DATABASE_URL, NEXT_PUBLIC_CLIENT: "tlst", UPLOAD_DIR: "./uploads-test-tlst" } });
    await signIn(`http://localhost:${TLST_PORT}`, "anne.lefort@exemple.fr", "tests/.auth/state-tlst.json");
  }
}

async function signIn(baseURL: string, email: string, stateFile: string) {
  const res = await fetch(`${baseURL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseURL },
    body: JSON.stringify({ email, password: process.env.DEMO_PASSWORD ?? "pilote-demo-2026" }),
  });
  if (!res.ok) throw new Error(`Connexion de test refusée (${email}) : HTTP ${res.status} ${await res.text()}`);
  const cookies = res.headers.getSetCookie().map((c) => {
    const [pair, ...attrs] = c.split(";");
    const [name, ...v] = pair.split("=");
    const value = v.join("=");
    const path = attrs.map((a) => a.trim()).find((a) => a.toLowerCase().startsWith("path="))?.slice(5) ?? "/";
    return { name: name.trim(), value, domain: "localhost", path, expires: -1, httpOnly: true, secure: false, sameSite: "Lax" as const };
  });
  if (!cookies.some((c) => c.name.includes("session_token"))) throw new Error("Pas de cookie de session dans la réponse de connexion.");
  writeFileSync(stateFile, JSON.stringify({ cookies, origins: [] }, null, 2));
}
