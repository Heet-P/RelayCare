import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Private evidence storage (Supabase Storage; spec asked for R2, swap here if needed).
 * The bucket is private: files are only reachable through short-lived signed URLs that
 * RelayCare issues after its own access check.
 */
export const EVIDENCE_BUCKET = "case-evidence";
const DOWNLOAD_TTL_SECONDS = 300;

const bucket = () => supabaseAdmin().storage.from(EVIDENCE_BUCKET);

/** One-time upload URL for a key RelayCare chose (the client never picks the path). */
export async function signedUpload(objectKey: string) {
  const { data, error } = await bucket().createSignedUploadUrl(objectKey);
  if (error) throw error;
  return { path: data.path, token: data.token, signedUrl: data.signedUrl };
}

export async function signedDownload(objectKey: string, downloadName?: string) {
  const { data, error } = await bucket().createSignedUrl(objectKey, DOWNLOAD_TTL_SECONDS, downloadName ? { download: downloadName } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

/** Size and type of an uploaded object, or null if it does not exist. */
export async function objectInfo(objectKey: string) {
  const { data, error } = await bucket().info(objectKey);
  if (error || !data) return null;
  return { size: data.size ?? 0, contentType: data.contentType ?? "" };
}

/** Lowercase, ASCII-safe file name for object keys (display name is stored separately). */
export const safeName = (name: string) =>
  name.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(-80).toLowerCase() || "file";
