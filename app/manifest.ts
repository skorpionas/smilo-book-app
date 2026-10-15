import type { MetadataRoute } from "next";

// Installable PWA (no service worker — the app is fully online in Iteration 1).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Smilo – registracija",
    short_name: "Smilo",
    description: "Šunų ir kačių kirpyklos registracija",
    lang: "lt",
    start_url: "/calendar",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf7",
    theme_color: "#faf9f5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
