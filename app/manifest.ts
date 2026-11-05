import type { MetadataRoute } from "next";

/** Installable app (technicians add it to their home screen; opens on their jobs). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RelayCare",
    short_name: "RelayCare",
    description: "One purchase. One connected service journey. One resolution.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4f0",
    theme_color: "#1c1917",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
    shortcuts: [{ name: "Your jobs", url: "/technician/jobs" }],
  };
}
