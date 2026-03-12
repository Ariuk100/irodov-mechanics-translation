import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gzip/Brotli compress all responses
  compress: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
    // Serve modern formats (AVIF → WebP → JPEG) — smaller payloads
    formats: ["image/avif", "image/webp"],
    // Longer browser cache for optimized images (1 week)
    minimumCacheTTL: 604800,
  },

  async headers() {
    return [
      {
        // Static assets: long-lived cache (Next.js already hashes filenames)
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Public images (book diagrams, etc.)
        source: "/images/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
      {
        // PDF files
        source: "/pdfs/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          // Allow Firebase Google Sign-In popup to communicate with the opener
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        ],
      },
    ];
  },
};

export default nextConfig;
