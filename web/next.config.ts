import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiOrigin = process.env.API_PROXY_ORIGIN?.trim().replace(/\/$/, "");

    return apiOrigin
      ? [
          {
            source: "/api/:path*",
            destination: `${apiOrigin}/:path*`,
          },
        ]
      : [];
  },
  async headers() {
    const apiOrigin = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
    const connectSource = apiOrigin ? ` ${apiOrigin}` : "";
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      {
        key: "Content-Security-Policy",
        value: `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'${connectSource};`,
      },
      ...(process.env.NODE_ENV === "production"
        ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
        : []),
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/sw.js",
        headers: [
          ...securityHeaders,
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
