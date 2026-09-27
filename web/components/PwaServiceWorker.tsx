"use client";

import { useEffect } from "react";

/** Registers the offline app shell after the page is interactive. */
export default function PwaServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    async function register() {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        const registration = await navigator.serviceWorker.ready;
        const assets = Array.from(
          document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
            "script[src], link[rel='stylesheet'][href]",
          ),
        )
          .map((element) =>
            element instanceof HTMLScriptElement ? element.src : element.href,
          )
          .filter(Boolean);
        registration.active?.postMessage({ type: "PRECACHE_ASSETS", urls: assets });
      } catch (error: unknown) {
        // PWA support is progressive enhancement; the web app remains usable
        // when a browser blocks service worker registration.
        console.warn("Unable to register the service worker.", error);
      }
    }

    void register();
  }, []);

  return null;
}
