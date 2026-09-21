import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { prisma } from "./db";
import { BASE_PATH } from "./base-path";

// Comptes et sessions (lot F) : e-mail / mot de passe d'abord (Entra ID viendra comme second fournisseur, même User).
// L'identité d'accès (User) et l'identité métier (Person) restent deux objets reliés par Person.userId.
//
// Variables : BETTER_AUTH_SECRET (obligatoire en production), BETTER_AUTH_URL (adresse publique de l'API d'auth, sous-chemin
// compris : https://cress.bazixx.fr/outilcli/cress/pilote/api/auth),
// PILOTE_DEMO=1 (mode démo : « Changer d'utilisateur » reste disponible aux personnes connectées), AUTH_RATE_LIMIT=0 (tests).

const isProd = process.env.NODE_ENV === "production";
const building = process.env.NEXT_PHASE === "phase-production-build";
const environmentProfile = process.env.PILOTE_ENV_PROFILE ?? "";
const configuredAuthUrl = process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3001}${BASE_PATH}/api/auth`;
let authUrl: URL;
try {
  authUrl = new URL(configuredAuthUrl);
} catch {
  throw new Error("BETTER_AUTH_URL doit être une URL absolue valide.");
}
const isExplicitLocalProfile = ["local", "test", "security-test"].includes(environmentProfile);
const isLoopbackHost = authUrl.hostname === "localhost" || authUrl.hostname === "127.0.0.1" || authUrl.hostname === "[::1]";
const localHttp = isExplicitLocalProfile && isLoopbackHost && authUrl.protocol === "http:";
// Le mode démonstration est réservé au développement et aux profils de recette (SEC-20) : en production, il ne passe
// qu'avec un profil explicite servi en loopback ; une production publique configurée en mode démo refuse de démarrer.
if (isProd && !building && process.env.PILOTE_DEMO === "1" && !(isExplicitLocalProfile && isLoopbackHost)) {
  throw new Error("PILOTE_DEMO=1 est interdit en production.");
}
if (isProd && !building && !isExplicitLocalProfile && authUrl.protocol !== "https:") {
  throw new Error("BETTER_AUTH_URL doit utiliser HTTPS en production.");
}
if (isProd && !building && !isExplicitLocalProfile && process.env.AUTH_RATE_LIMIT === "0") {
  throw new Error("AUTH_RATE_LIMIT=0 est interdit en production.");
}
// `next build` charge les modules sans servir personne : un secret de circonstance suffit, le vrai est exigé au démarrage.
const secret = process.env.BETTER_AUTH_SECRET ?? (isProd && !building ? undefined : "pilote-dev-secret-ne-pas-utiliser-en-production");
if (!secret) throw new Error("BETTER_AUTH_SECRET manquant : générez-le (openssl rand -hex 32) dans le .env du serveur.");

export const DEMO_MODE = process.env.PILOTE_DEMO === "1";
export const SESSION_DAYS = 7;

export const auth = betterAuth({
  appName: "Pilote",
  secret,
  baseURL: configuredAuthUrl,
  basePath: `${BASE_PATH}/api/auth`,
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    // Mot de passe oublié : pas de mail dans le prototype, le lien va dans la boîte d'envoi (admin › Comptes) et l'admin le remet.
    sendResetPassword: async ({ user, url }) => {
      await prisma.mailOutbox.create({ data: {
        kind: "password_reset", to: user.email, subject: "Réinitialisation de votre mot de passe — Pilote",
        body: `Bonjour ${user.name},\n\nPour choisir un nouveau mot de passe, ouvrez ce lien (valable une heure) :\n${url}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
        link: url,
      } });
    },
    // Un reset réussi invalide immédiatement toutes les sessions émises avant le changement.
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
  },

  session: {
    expiresIn: 60 * 60 * 24 * SESSION_DAYS,
    updateAge: 60 * 60 * 24, // prolongée au plus une fois par jour
    // Pas de cache de session dans le cookie : « désactiver » ou « déconnecter partout » coupe l'accès à la requête suivante.
    cookieCache: { enabled: false },
  },

  // En local, le serveur de dev (3001) et ceux des tests (3100, 3200…) ne sont pas à la même adresse que baseURL.
  trustedOrigins: isProd ? [] : ["http://localhost:3001", "http://localhost:3100", "http://localhost:3200", "http://localhost:3300"],

  advanced: {
    // Cookies « Secure » seulement derrière https : un serveur de production servi en http://localhost (les recettes) garde des
    // cookies ordinaires, sinon le navigateur les refuse.
    useSecureCookies: isProd && !localHttp,
    cookiePrefix: "pilote",
  },

  // Anti-force brute : fenêtre glissante en mémoire, plus stricte sur la connexion et la demande de réinitialisation.
  // AUTH_RATE_LIMIT=0 la coupe (tests automatisés, qui enchaînent les connexions) ; jamais sur un déploiement (https).
  rateLimit: {
    enabled: !(process.env.AUTH_RATE_LIMIT === "0" && (!isProd || localHttp)),
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 5 },
    },
  },

  databaseHooks: {
    session: {
      create: {
        // Une personne désactivée ne peut plus ouvrir de session, même avec un bon mot de passe.
        before: async (session) => {
          const p = await prisma.person.findUnique({ where: { userId: session.userId }, select: { active: true } });
          if (!p) throw new APIError("FORBIDDEN", { message: "Ce compte n'est rattaché à aucune personne de l'équipe." });
          if (!p.active) throw new APIError("FORBIDDEN", { message: "Ce compte est désactivé." });
          return { data: session };
        },
        after: async (session) => {
          await prisma.user.update({ where: { id: session.userId }, data: { lastLoginAt: new Date() } });
        },
      },
    },
  },

  plugins: [nextCookies()], // en dernier : laisse les actions serveur poser les cookies
});

export type Auth = typeof auth;
