import { readFile } from "node:fs/promises";
import path from "node:path";
import { branding } from "@/lib/branding";

export const dynamic = "force-static";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Favicon du client (lot I) : le PNG de public/clients/<client>/favicon.png, servi par la route /icon que Next référence seule.
export default async function Icon() {
  const file = await readFile(path.join(process.cwd(), "public", branding().logos.favicon));
  return new Response(file, { headers: { "Content-Type": contentType } });
}
