import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel maneja el output automáticamente; standalone es para Docker.
  // Se eliminó output: "standalone" para evitar problemas en Vercel.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Necesario para Prisma en Vercel serverless
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "@node-rs/argon2"],
  },
  // Asegurar que las API routes sean serverless functions
  api: {
    // Body size grande para subida de archivos (fotos clínicas, etc.)
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

export default nextConfig;
