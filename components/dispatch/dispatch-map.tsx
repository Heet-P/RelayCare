"use client";

import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export type MapPin = { id: string; caseNumber: string; label: string; lat: number; lng: number; needsTechnician: boolean };

// Mapbox GL is large: load it only when the dispatch map is shown.
const Inner = lazy(() => import("./dispatch-map-inner"));

export function DispatchMap({ pins }: { pins: MapPin[] }) {
  if (!pins.length || !process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return null;
  return (
    <Suspense fallback={<Skeleton className="h-80 w-full rounded-lg" />}>
      <Inner pins={pins} />
    </Suspense>
  );
}
