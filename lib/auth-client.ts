"use client";

import { createAuthClient } from "better-auth/react";
import { BASE_PATH } from "./base-path";

// Client better-auth côté navigateur : adresse relative au sous-chemin de déploiement.
export const authClient = createAuthClient({ basePath: `${BASE_PATH}/api/auth` });
