import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Point d'entrée better-auth (connexion, déconnexion, session, réinitialisation).
export const { GET, POST } = toNextJsHandler(auth);
