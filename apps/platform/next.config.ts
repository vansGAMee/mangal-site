import type { NextConfig } from "next";

const remotePatterns: NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> = [
  { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
];
for (const value of [process.env.MEDIA_PUBLIC_BASE_URL, process.env.ADMIN_BASE_URL]) {
  if (!value) continue;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") continue;
    remotePatterns.push({
      protocol: url.protocol.slice(0, -1) as "http" | "https",
      hostname: url.hostname,
      ...(url.port ? { port: url.port } : {}),
      pathname: "/media/**",
    });
  } catch {
    // Startup validation reports malformed URLs.
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    "@mangal/contracts",
    "@mangal/catalog-seed",
    "@mangal/design-system",
  ],
  images: { remotePatterns },
};

export default nextConfig;

