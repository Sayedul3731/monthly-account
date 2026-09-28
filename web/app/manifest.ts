import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Doinik Hisab",
    short_name: "Doinik Hisab",
    description: "Track and manage your monthly finances.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f4f0e6",
    theme_color: "#123847",
    icons: [
      {
        src: "/doinik-hisab-logo.png",
        sizes: "300x300",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/doinik-hisab-logo.png",
        sizes: "300x300",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
