import type { NextConfig } from "next";
import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
} from "next/constants";

const nextConfig: NextConfig = {
  transpilePackages: ["mapbox-gl", "react-map-gl"],
  typescript: {
    ignoreBuildErrors: true,
  },
    images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default function wrappedConfig(phase: string) {
  if (phase === PHASE_DEVELOPMENT_SERVER || phase === PHASE_PRODUCTION_BUILD) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const withPWA = require("@ducanh2912/next-pwa").default({
      dest: "public",
      disable: process.env.NODE_ENV === "development",
      register: true,
      scope: "/",
      sw: "sw.js",
      workboxOptions: {
        disableDevLogs: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "wanderloom-supabase",
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 48,
                maxAgeSeconds: 24 * 60 * 60,
              },
            },
          },
          {
            urlPattern: /\/api\/weather/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "wanderloom-weather",
              expiration: {
                maxEntries: 16,
                maxAgeSeconds: 60 * 60,
              },
            },
          },
          {
            urlPattern: /\/itinerary\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "wanderloom-itinerary-shell",
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 24,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
    });
    return withPWA(nextConfig);
  }
  return nextConfig;
}
