// Valide une destination interne sans se fier aux préfixes de chaîne que les
// navigateurs peuvent normaliser différemment (backslash, encodage, contrôles).
export function safeInternalRedirect(value: string | undefined, basePath = ""): string {
  const fallback = `${basePath}/portefeuille` || "/portefeuille";
  if (!value || /[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://pilote.invalid");
    if (url.origin !== "https://pilote.invalid" || !url.pathname.startsWith("/")) return fallback;
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (basePath && !url.pathname.startsWith(`${basePath}/`) && url.pathname !== basePath) return fallback;
    return path;
  } catch {
    return fallback;
  }
}
