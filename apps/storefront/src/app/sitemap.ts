import type { MetadataRoute } from "next";
import { fetchCatalog } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> { const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"; const catalog = await fetchCatalog(); return [{ url: base, changeFrequency: "daily", priority: 1 }, ...catalog.categories.flatMap((category) => category.products).map((product) => ({ url: `${base}/menu/${product.slug}`, changeFrequency: "weekly" as const, priority: .7 })), ...["privacy", "marketing", "offer", "terms", "cookies"].map((slug) => ({ url: `${base}/legal/${slug}`, changeFrequency: "monthly" as const, priority: .3 }))]; }
