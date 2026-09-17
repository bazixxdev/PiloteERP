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
// `next build` charge les modules sans servir personne : un secret de circonstance suffit, le vrai est exigé au démarrage.
const building = process.env.NEXT_PHASE === "phase-production-build";
const secret = process.env.BETTER_AUTH_SECRET ?? (isProd && !building ? undefined : "pilote-dev-secret-ne-pas-utiliser-en-production");
if (!secret) throw new Error("BETTER_AUTH_SECRET manquant : générez-le (openssl rand -hex 32) dans le .env du serveur.");

export const DEMO_MODE = process.env.PILOTE_DEMO === "1";
export const SESSION_DAYS = 7;

export const auth = betterAuth({
  appName: "Pilote",
  secret,
  baseURL: process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 3001}${BASE_PATH}/api/auth`,
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
    useSecureCookies: isProd,
    cookiePrefix: "pilote",
  },

  // Anti-force brute : fenêtre glissante en mémoire, plus stricte sur la connexion et la demande de réinitialisation.
  // AUTH_RATE_LIMIT=0 la coupe (tests automatisés, qui enchaînent les connexions) ; jamais en production.
  rateLimit: {
    enabled: process.env.AUTH_RATE_LIMIT !== "0" || isProd,
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
