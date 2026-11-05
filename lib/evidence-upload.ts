import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Browser-side evidence upload (customer and technician):
 *   1. ask RelayCare for a signed one-time upload URL (server picks the object key)
 *   2. upload straight to private storage (file never passes through our server)
 *   3. register it; the server verifies the stored object's size and type before recording it
 */
export async function uploadEvidence(caseId: string, file: File): Promise<string> {
  const meta = { fileName: file.name || "photo.jpg", mimeType: file.type, sizeBytes: file.size };
  const post = async (body: object) => {
    const res = await fetch(`/api/cases/${caseId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.issues?.[0]?.message ?? json.error ?? "Upload failed");
    return json;
  };

  const { objectKey, path, token } = await post({ intent: "upload", ...meta });
  const { error } = await supabaseBrowser().storage.from("case-evidence").uploadToSignedUrl(path, token, file, { contentType: file.type });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const checksum = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  const { attachmentId } = await post({ intent: "register", ...meta, objectKey, checksum });
  return attachmentId;
}
