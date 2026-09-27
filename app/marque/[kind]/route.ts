import { prisma } from "@/lib/db";

const KEYS: Record<string, "logo" | "logo_small"> = { logo: "logo", "logo-petit": "logo_small" };

// Logos téléversés (spec connexion § 3) : publics (la page de connexion les affiche), toujours en PNG (convertis à l'envoi),
// cache long — l'adresse change avec ?v=<date de mise à jour> à chaque remplacement. Route volontairement sans garde
// (KEYS ci-dessus) : voir tests/unit/guardrails.test.ts (ROUTE_EXCEPTIONS) et .agents/rules/securite-autorisation.md.
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const kind = (await params).kind;
  const key = Object.hasOwn(KEYS, kind) ? KEYS[kind] : undefined;
  if (!key) return new Response("Introuvable", { status: 404 });
  const row = await prisma.brandAsset.findUnique({ where: { key }, select: { png: true } });
  if (!row) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(row.png), {
    headers: { "Content-Type": "image/png", "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
