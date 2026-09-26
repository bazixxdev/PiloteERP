// Valide une destination interne sans se fier aux préfixes de chaîne que les
// navigateurs peuvent normaliser différemment (backslash, encodage, contrôles).
// Le résultat est une adresse **dans l'application, sans le sous-chemin** : `router.push` et `redirect()` l'ajoutent
// eux-mêmes (26/09 : le rendre avec le sous-chemin le doublait, /outilcli/tlst/pilote/outilcli/tlst/pilote/…).
// Une destination qui arrive avec le sous-chemin est acceptée et le perd.
export function safeInternalRedirect(value: string | undefined, basePath = ""): string {
  const fallback = "/portefeuille";
  if (!value || /[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://pilote.invalid");
    if (url.origin !== "https://pilote.invalid" || !url.pathname.startsWith("/")) return fallback;
    let pathname = url.pathname;
    if (basePath && (pathname === basePath || pathname.startsWith(`${basePath}/`))) pathname = pathname.slice(basePath.length) || "/";
    if (!pathname.startsWith("/") || pathname.startsWith("//")) return fallback;
    return `${pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
