# Changelog sécurité PiloteERP

Chronologie courte de la campagne ; voir [`README.md`](README.md) pour la trace complète.

| Date | Changement | Findings | Impact | Référence |
|---|---|---|---|---|
| 12–18/09/2026 | Construction du socle métier, comptes, multi-instance | prérequis | application et deux clients préparés | historique Git |
| 19/09/2026 | Audit sécurité, données, qualité et production | SEC-01 à SEC-29 | 29 risques recensés avant données réelles | [`docs/audit/01-securite.md`](../audit/01-securite.md) |
| 19/09/2026 | Garde-fous production-like et fixtures | SEC-01 à SEC-07, SEC-20 | base de tests de non-régression | [`00-guardrails.md`](00-guardrails.md) |
| 19–20/09/2026 | Corrections applicatives authz, intégrité, exports, dépendances | SEC-01 à SEC-19, SEC-27 à SEC-29 | chemins HTTP et invariants renforcés | [`01`–`19`](.) et [`27`–`29`](.) |
| 20/09/2026 | Configuration production et backups VPS | SEC-20, SEC-24, SEC-26 | mode démo désactivé, point de retour validé | [`102-vps-prod-env.md`](102-vps-prod-env.md) |
| 20/09/2026 | Loopback Next et firewall OS | SEC-22 | ports internes filtrés, SSH/HTTP/HTTPS conservés | [`103-vps-network.md`](103-vps-network.md) |
| 20/09/2026 | Isolation Unix et systemd | SEC-21 | comptes dédiés, code non inscriptible, protections effectives | [`104-vps-unix-systemd.md`](104-vps-unix-systemd.md) |
| 20/09/2026 | Redaction Nginx et validation sentinelles | SEC-23 | `pilote_safe` actif, sentinelles absentes des logs | [`105-vps-nginx-tokens.md`](105-vps-nginx-tokens.md) |
| 20/09/2026 | État courant | SEC-23/26 | rotation apiToken/ICS et restauration réelle restent ouvertes | [`README.md`](README.md) |
