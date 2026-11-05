import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { serviceCases } from "@/lib/db/schema";

/**
 * Job `case.geocode`: place the service address on the dispatch map (Mapbox Geocoding v6).
 * Best effort: an address Mapbox can't find simply stays off the map.
 */
export async function geocodeCase({ caseId }: Record<string, unknown>) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [kase] = await db.select({ address: serviceCases.serviceAddress }).from(serviceCases).where(eq(serviceCases.id, String(caseId)));
  const a = kase?.address;
  if (!token || !a || (a.lat != null && a.lng != null)) return;
  const q = [a.line1, a.line2, a.city, a.state, a.postcode].filter(Boolean).join(", ");
  if (!q) return;
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&country=${(a.country ?? "IN").toLowerCase()}&limit=1&access_token=${token}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Mapbox geocoding failed (${res.status})`);
  const body = (await res.json()) as { features?: { geometry?: { coordinates?: [number, number] } }[] };
  const coords = body.features?.[0]?.geometry?.coordinates;
  if (!coords) return;
  await db.update(serviceCases).set({ serviceAddress: { ...a, lng: coords[0], lat: coords[1] } }).where(eq(serviceCases.id, String(caseId)));
}
