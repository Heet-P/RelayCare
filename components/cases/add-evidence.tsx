"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { uploadEvidence } from "@/lib/evidence-upload";

/** Add photos/files to an existing case (camera on phones). */
export function AddEvidence({ caseId, label = "Add photos" }: { caseId: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function upload(files: File[]) {
    let done = 0;
    for (const [i, f] of files.entries()) {
      setBusy(`Uploading ${i + 1} of ${files.length}…`);
      try {
        await uploadEvidence(caseId, f);
        done++;
      } catch (e) {
        toast.error(`${f.name}: ${(e as Error).message}`);
      }
    }
    setBusy(null);
    if (done) {
      toast.success(done === 1 ? "Photo added" : `${done} files added`);
      router.refresh();
    }
  }

  return (
    <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border bg-card px-4 text-sm font-medium hover:bg-accent has-disabled:opacity-60">
      <Camera className="size-4" aria-hidden />
      {busy ?? label}
      <input
        type="file"
        multiple
        accept="image/*,video/mp4,video/quicktime,application/pdf"
        className="sr-only"
        disabled={!!busy}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void upload(files);
        }}
      />
    </label>
  );
}
