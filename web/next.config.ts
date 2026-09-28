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
    return [
      {
        source: "/sw.js",
        headers: [
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
