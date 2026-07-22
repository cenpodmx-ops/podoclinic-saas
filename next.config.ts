import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ["@prisma/client", "@node-rs/argon2", "facturapi"],
  poweredByHeader: false,
  compress: true,
  // Desactivar caché agresivo del CDN de Vercel para que los cambios
  // se reflejen inmediatamente sin necesidad de hard refresh
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        ],
      },
    ]
  },
};

export default nextConfig;
