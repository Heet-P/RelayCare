/**
 * Single-series horizontal bars (magnitude). Built as a table, so it doubles as the accessible
 * table view; one validated hue (--chart-1), 4px rounded data end on the baseline, values in
 * text colours, a native tooltip per bar. One series: the heading names it, no legend.
 */
export function BarList({ title, unit, rows, empty }: { title: string; unit: string; rows: { label: string; value: number; note?: string }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <h3 className="font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">
            {title}, in {unit}
          </caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Item</th>
              <th scope="col">{unit}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="group" title={`${r.label}: ${r.value} ${unit}${r.note ? ` (${r.note})` : ""}`}>
                <th scope="row" className="w-2/5 py-1.5 pr-3 text-left font-normal">
                  {r.label}
                </th>
                <td className="py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-3 flex-1">
                      <div className="h-full rounded-r-[4px] bg-chart-1 group-hover:opacity-80" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
                    </div>
                    <span className="font-tag w-14 text-right">{r.value}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
