// Une fiche dont le cycle de validation est terminé (décision du CODIR posée en couche 4, ou édition validée / clôturée) est
// verrouillée : ses couches 1 à 3 ne changent que par proposition acceptée. Une édition « en cours » sans décision reste ouverte.
export const LOCKED_STATUSES = ["validated", "closed"];
export const isLocked = (e: { status: string; codirDecision?: string | null }) => LOCKED_STATUSES.includes(e.status) || Boolean(e.codirDecision);
