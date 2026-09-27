"use client";

import { useEffect } from "react";

/** Registers the offline app shell after the page is interactive. */
export default function PwaServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error: unknown) => {
        // PWA support is progressive enhancement; the web app remains usable
        // when a browser blocks service worker registration.
        console.warn("Unable to register the service worker.", error);
      });
  }, []);

  return null;
}
