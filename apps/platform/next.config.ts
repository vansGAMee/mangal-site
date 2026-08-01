import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    "@mangal/contracts",
    "@mangal/catalog-seed",
    "@mangal/design-system",
  ],
};

export default nextConfig;

