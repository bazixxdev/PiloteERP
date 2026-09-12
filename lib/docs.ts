// Documents (EF-J1) : un lien web s'ouvre dans le navigateur ; un chemin serveur (NAS en VPN) se copie dans l'Explorateur.
export function isWebLink(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

export function serverPath(template: string, code: string, year: number): string {
  return template.replace(/\{code\}/g, code).replace(/\{annee\}/g, String(year));
}
