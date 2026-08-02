import type { MetadataRoute } from "next";
import { fetchCatalog } from "@/lib/catalog";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { store } = await fetchCatalog();
  const profile = store.profile;
  return {
    name: `${profile.name} — заказ еды`,
    short_name: profile.name,
    description: profile.seoDescription,
    start_url: "/",
    display: "standalone",
    background_color: profile.backgroundColor,
    theme_color: profile.backgroundColor,
    lang: "ru",
    icons: [{ src: profile.faviconPath ?? "/icon.svg", sizes: "any" }],
  };
}
