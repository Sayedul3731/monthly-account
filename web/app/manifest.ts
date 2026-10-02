import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "প্রতিদিনের হিসাব",
    short_name: "প্রতিদিনের হিসাব",
    description: "Track and manage your monthly finances.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f4f0e6",
    theme_color: "#123847",
    icons: [
      {
        src: "/protidiner-hisab-logo.png",
        sizes: "300x300",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/protidiner-hisab-logo.png",
        sizes: "300x300",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
