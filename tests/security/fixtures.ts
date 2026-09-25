import { type Browser, type BrowserContext, type Page } from "@playwright/test";

export type SecurityActor = {
  key: "contributor" | "pilot" | "raf" | "director" | "disabled" | "resettable";
  name: string;
  email: string;
};

// Comptes fictifs créés par prisma/seeds/cress.ts. Ils restent séparés par session,
// même si le seed local utilise un mot de passe de recette commun.
export const SECURITY_ACTORS: Record<string, SecurityActor> = {
  contributor: { key: "contributor", name: "Lucas Perrin", email: "lucas.perrin@exemple.fr" },
  pilot: { key: "pilot", name: "Thomas Guérin", email: "thomas.guerin@exemple.fr" },
  raf: { key: "raf", name: "Nadia Ferrand", email: "nadia.ferrand@exemple.fr" },
  director: { key: "director", name: "Claire Vasseur", email: "claire.vasseur@exemple.fr" },
  disabled: { key: "disabled", name: "Manon Girard", email: "manon.girard@exemple.fr" },
  // Compte réservé à SEC-09 : son mot de passe est réinitialisé et ses sessions révoquées ; aucune autre spec ne s'en sert,
  // pour que la session partagée des autres acteurs survive quel que soit l'ordre des fichiers.
  resettable: { key: "resettable", name: "Élise Fontaine", email: "elise.fontaine@exemple.fr" },
};

export const ANONYMOUS = { key: "anonymous" as const };
export const INVALID_COOKIE = "pilote.session_token=security-invalid-cookie";

export async function signInActor(baseURL: string, actor: SecurityActor, password: string) {
  const response = await fetch(`${baseURL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseURL },
    body: JSON.stringify({ email: actor.email, password }),
  });
  if (!response.ok) throw new Error(`Connexion de recette refusée pour ${actor.key}: HTTP ${response.status}`);
  const cookies = response.headers.getSetCookie().map((raw) => {
    const [pair, ...attributes] = raw.split(";");
    const [name, ...parts] = pair.split("=");
    const pathAttribute = attributes.find((item) => item.trim().toLowerCase().startsWith("path="));
    return {
      name: name.trim(), value: parts.join("="), domain: "localhost",
      path: pathAttribute?.trim().slice(5) ?? "/", expires: -1,
      httpOnly: true, secure: false, sameSite: "Lax" as const,
    };
  });
  if (!cookies.some((cookie) => cookie.name.includes("session_token"))) throw new Error("Cookie de session absent.");
  return { cookies, origins: [] };
}

export async function contextFor(browser: Browser, actor: SecurityActor, baseURL?: string): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL, storageState: `tests/.security-auth/${actor.key}.json` });
  await context.addInitScript(({ key }) => { window.name = `security-${key}`; }, { key: actor.key });
  return context;
}

export async function pageFor(browser: Browser, actor: SecurityActor, baseURL?: string): Promise<Page> {
  const context = await contextFor(browser, actor, baseURL);
  return context.newPage();
}

export async function expectAnonymous(page: Page, path: string) {
  await page.context().clearCookies();
  const response = await page.request.get(path, { maxRedirects: 0 });
  return response;
}

export async function postServerAction(baseURL: string, actionId: string, args: unknown[], cookie?: string, origin = baseURL) {
  return fetch(baseURL, {
    method: "POST",
    headers: {
      "Next-Action": actionId,
      "Content-Type": "text/plain;charset=UTF-8",
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(args),
  });
}
