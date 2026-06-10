import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/colors",
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
  },
};

export default nextConfig;
