import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ["@prisma/client", "@node-rs/argon2", "facturapi"],
  // Optimizaciones de rendimiento
  poweredByHeader: false,
  compress: true,
};

export default nextConfig;
