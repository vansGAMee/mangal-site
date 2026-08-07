import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest { return { name: "Шаверма Воронеж — доставка", short_name: "Шаверма Воронеж", description: "Каталог и заказ доставки", start_url: "/", display: "standalone", background_color: "#0D0D0E", theme_color: "#0D0D0E", lang: "ru", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }] }; }
