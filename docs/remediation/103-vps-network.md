# VPS-02 — Loopback Next et firewall réel

Date : 2026-09-20  
Hôte : `srv771239` (`195.35.25.148`)

## Périmètre

Ce lot a traité uniquement l’écoute réseau de Next et le firewall OS. Aucun changement d’isolation Unix, de hardening systemd, de Nginx/log redaction, de token, de sauvegarde ou d’ownership global n’a été effectué.

## Réseau avant modification

- interfaces : loopback, `eth0` IPv4/IPv6 public, Docker bridge et veth ;
- SSH : `0.0.0.0:22` et `[::]:22`, session courante confirmée sur le port 22 ; `sshd -T` confirme `port 22` ;
- Nginx : `0.0.0.0/[::]:80,443` ;
- Next CRESS : `*:3002` ;
- Next TLST : `*:3003` ;
- PostgreSQL : `127.0.0.1:5432` et `[::1]:5432` ;
- UFW : inactif ;
- iptables : politique INPUT ACCEPT ;
- ip6tables : politique INPUT ACCEPT ;
- règles Docker présentes uniquement pour le forwarding/bridge.

| Service | Adresse avant | Port | Exposé publiquement avant | Attendu |
|---|---|---:|---|---|
| SSH | `0.0.0.0`, `::` | 22 | Oui | Oui |
| Nginx HTTP | `0.0.0.0`, `::` | 80 | Oui | Oui |
| Nginx HTTPS | `0.0.0.0`, `::` | 443 | Oui | Oui |
| Next CRESS | `*` | 3002 | Oui | Non |
| Next TLST | `*` | 3003 | Oui | Non |
| PostgreSQL | `127.0.0.1`, `::1` | 5432 | Non | Non |

## Loopback après modification

Le package actif de chaque instance a été corrigé avec la commande explicite `next start --hostname 127.0.0.1`. Une sauvegarde préalable des `package.json` est disponible sous `/var/backups/pilote-vps02-20260920-193715/`.

| Instance | Écoute après | Résultat |
|---|---|---|
| CRESS | `127.0.0.1:3002` uniquement | PASS |
| TLST | `127.0.0.1:3003` uniquement | PASS |

Aucun listener `0.0.0.0`, `*` ou `[::]` n’est présent sur 3002/3003 après correction. Les deux services systemd sont actifs. HTTPS via Nginx répond pour les deux domaines.

## Firewall OS

UFW a été activé uniquement après identification et autorisation explicite du port SSH réel.

- politique incoming : `deny` ;
- politique outgoing : `allow` ;
- politique routed : `deny` ;
- règles autorisées : `22/tcp`, `80/tcp`, `443/tcp`, en IPv4 et IPv6 ;
- logging UFW : low.

Un état de rollback est disponible sous `/var/backups/pilote-vps02-firewall-20260920-193752/`, comprenant les états UFW, iptables/ip6tables et sockets avant activation. Aucune règle supplémentaire n’était active avant UFW ; le firewall Hostinger n’est pas accessible via les connecteurs/outils disponibles, donc son état ne peut pas être confirmé par API.

## Anti-lockout et contrôles externes

- session SSH courante conservée ;
- nouvelle connexion SSH indépendante sur le port 22 : PASS ;
- contrôle externe ciblé IPv4 : 22 OPEN, 80 OPEN, 443 OPEN ;
- contrôle externe ciblé : 3002, 3003 et 5432 CLOSED_OR_FILTERED ;
- aucune modification de configuration PostgreSQL : son écoute était déjà limitée au loopback.

## Smoke tests après firewall

| Test | CRESS | TLST |
|---|---:|---:|
| HTTPS racine | `302` | `302` |
| HTTPS `/connexion` | `401` | `401` |
| service actif | PASS | PASS |
| erreur récente Next/DB/Better Auth/proxy | aucune détectée | aucune détectée |

Le code `401` sur `/connexion` est une réponse applicative protégée et confirme que la chaîne HTTPS/proxy atteint l’application ; aucun login avec compte réel n’a été exécuté.

## Rollback

Rollback disponible pour la configuration Next et le firewall. Il n’a pas été utilisé : CRESS puis TLST ont été validés séquentiellement, et la nouvelle connexion SSH a réussi après activation UFW.

## Verdict

**VPS-02 CONFORME** — Next CRESS/TLST est limité au loopback, le firewall OS autorise uniquement SSH/HTTP/HTTPS nécessaires, PostgreSQL et les ports Next sont inaccessibles depuis l’extérieur.
