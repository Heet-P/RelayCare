import { FileText, Film } from "lucide-react";
import type { CaseView } from "@/lib/db/queries/case-view";
import { AddEvidence } from "./add-evidence";

const PURPOSE: Record<string, string> = { complaint: "From customer", inspection: "Inspection", repair: "Repair", document: "Document" };

/** Case evidence. Files load through /api/attachments/:id (access-checked, short-lived signed URL). */
export function EvidenceGrid({ view, canAdd }: { view: CaseView; canAdd: boolean }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Photos and files</h2>
        {canAdd && <AddEvidence caseId={view.case.id} />}
      </div>
      {view.attachments.length === 0 ? (
        <p className="text-muted-foreground">No photos yet. A clear photo of the problem helps the technician prepare.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {view.attachments.map((a) => (
            <li key={a.id} className="space-y-1">
              <a
                href={`/api/attachments/${a.id}`}
                target="_blank"
                rel="noreferrer"
                className="block aspect-square overflow-hidden rounded-md border bg-muted"
                aria-label={`Open ${a.fileName}`}
              >
                {a.mimeType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element -- access-checked redirect to a signed URL
                  <img src={`/api/attachments/${a.id}`} alt={a.fileName} loading="lazy" className="size-full object-cover" />
                ) : (
                  <span className="grid size-full place-items-center text-muted-foreground">
                    {a.mimeType.startsWith("video/") ? <Film className="size-6" /> : <FileText className="size-6" />}
                  </span>
                )}
              </a>
              <p className="truncate text-xs text-muted-foreground">
                {PURPOSE[a.purpose] ?? a.purpose}, {view.people[a.uploadedBy]?.name ?? ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
