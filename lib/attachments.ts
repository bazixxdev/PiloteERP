import path from "node:path";

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // pièces légères : 5 Mo
export const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/msword", "application/vnd.ms-excel", "text/plain", "text/csv"];

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export const attachmentInclude = { uploadedBy: { select: { name: true } } } as const;
