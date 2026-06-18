import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel maneja el output automáticamente; standalone es para Docker.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Necesario para Prisma y otros paquetes nativos en serverless
  serverExternalPackages: ["@prisma/client", "@node-rs/argon2", "facturapi"],
};

export default nextConfig;
