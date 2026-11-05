import { HandoffV1 } from "@/lib/cases/handoff";
import { PRIORITY_LABEL } from "@/lib/cases/labels";
import { date } from "@/lib/format";

/**
 * The structured handoff, as the next person receives it (spec §13 "memorable demo moment").
 * Renders the stored snapshot, not live case data, so it shows exactly what was handed over.
 */
export function HandoffCard({ snapshot, compact = false }: { snapshot: unknown; compact?: boolean }) {
  const parsed = HandoffV1.safeParse(snapshot);
  if (!parsed.success) return <p className="text-sm text-muted-foreground">This handoff uses an older format.</p>;
  const h = parsed.data;
  return (
    <article className="overflow-hidden panel rounded-xl">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b bg-secondary/60 px-4 py-3">
        <p className="font-tag text-base font-semibold">{h.case}</p>
        <p className="text-xs text-muted-foreground">
          Prepared by {h.preparedBy}, {date(h.preparedAt)}
          {h.priority !== "normal" && <span className="ml-2 font-semibold text-warning">{PRIORITY_LABEL[h.priority]} priority</span>}
        </p>
      </header>
      <dl className="divide-y text-sm">
        <Field label="Product">
          {h.product}
          {h.serialNumber && <span className="font-tag block text-muted-foreground">Serial {h.serialNumber}</span>}
        </Field>
        <Field label="Customer complaint">
          <span className="whitespace-pre-line">{h.complaint}</span>
        </Field>
        <Field label="Symptoms">
          <List items={h.symptoms} />
        </Field>
        {h.troubleshooting.length > 0 && (
          <Field label="Already tried">
            <List items={h.troubleshooting} />
          </Field>
        )}
        <Field label="Warranty">{h.warranty}</Field>
        {!compact && (
          <Field label="Customer">
            {h.customer.name}
            {h.customer.phone && (
              <a href={`tel:${h.customer.phone.replace(/\s/g, "")}`} className="font-tag block text-primary underline-offset-4 hover:underline">
                {h.customer.phone}
              </a>
            )}
            {h.customer.address && <span className="block text-muted-foreground">{h.customer.address}</span>}
          </Field>
        )}
        {h.evidence.length > 0 && (
          <Field label="Evidence">
            <ul className="flex flex-wrap gap-x-3">
              {h.evidence.map((e) => (
                <li key={e.id}>
                  <a href={`/api/attachments/${e.id}`} target="_blank" rel="noreferrer" className="text-primary underline-offset-4 hover:underline">
                    {e.fileName}
                  </a>
                </li>
              ))}
            </ul>
          </Field>
        )}
        {h.notes && <Field label="Notes">{h.notes}</Field>}
      </dl>
      <footer className="border-t bg-primary px-4 py-3 text-primary-foreground">
        <p className="text-xs opacity-80">Required action</p>
        <p className="font-semibold">{h.actionRequired}</p>
      </footer>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-0.5 pl-5">
      {items.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ul>
  );
}
