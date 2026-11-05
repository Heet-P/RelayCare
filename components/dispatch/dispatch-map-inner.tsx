"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import type { MapPin } from "./dispatch-map";

/** Mapbox map of open cases. Loaded lazily (heavy dependency) by DispatchMap. */
export default function DispatchMapInner({ pins }: { pins: MapPin[] }) {
  const el = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!el.current || !pins.length) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
    const map = new mapboxgl.Map({
      container: el.current,
      style: resolvedTheme === "dark" ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11",
      center: [pins[0].lng, pins[0].lat],
      zoom: 11,
      attributionControl: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    const bounds = new mapboxgl.LngLatBounds();
    for (const p of pins) {
      const dot = document.createElement("a");
      dot.href = `/dashboard/cases/${p.id}`;
      dot.setAttribute("aria-label", `${p.caseNumber}: ${p.label}`);
      // Signal yellow = waiting for a technician (the baton is with dispatch); petrol = booked.
      dot.style.cssText = `display:block;width:18px;height:18px;border-radius:9999px;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35);background:${p.needsTechnician ? "#f5b800" : "#145b6f"}`;
      new mapboxgl.Marker({ element: dot })
        .setLngLat([p.lng, p.lat])
        .setPopup(new mapboxgl.Popup({ offset: 14, closeButton: false }).setText(`${p.caseNumber}, ${p.label}`))
        .addTo(map);
      bounds.extend([p.lng, p.lat]);
    }
    if (pins.length > 1) map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 0 });
    return () => map.remove();
  }, [pins, resolvedTheme]);

  return <div ref={el} className="h-80 w-full overflow-hidden rounded-lg border" role="region" aria-label="Map of open cases" />;
}
