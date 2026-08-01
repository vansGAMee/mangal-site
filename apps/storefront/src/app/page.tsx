import { fetchCatalog } from "@/lib/catalog";
import { MenuExplorer } from "@/components/menu-explorer";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const catalog = await fetchCatalog();
  const menuItems = catalog.categories.flatMap((category) => category.products);
  const restaurantJsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: "МАНГАЛ",
    url: process.env.NEXT_PUBLIC_SITE_URL,
    telephone: catalog.store.phoneHref,
    hasMenu: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/#menu`,
  };
  const menuJsonLd = {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: "Меню «МАНГАЛ»",
    hasMenuSection: catalog.categories.map((category) => ({
      "@type": "MenuSection", name: category.name,
      hasMenuItem: category.products.map((product) => ({ "@type": "MenuItem", name: product.name, description: product.compositionText ?? undefined })),
    })),
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd).replace(/</g, "\\u003c") }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(menuJsonLd).replace(/</g, "\\u003c") }} />
    <section className="shell relative min-h-[78dvh] border-b border-white/10 pt-16">
      <div className="grid min-h-[64dvh] gap-10 md:grid-cols-[1.45fr_.55fr] md:items-end">
        <div className="self-center"><p className="eyebrow">Сделано на огне · подготовка от {catalog.store.leadTimeMinutes} минут</p><h1 className="display -ml-[.04em] mt-5 text-[clamp(100px,22vw,330px)] leading-[.58] text-[var(--ivory)]">МАН<br />ГАЛ</h1></div>
        <div className="pb-10 md:pb-20"><p className="max-w-sm text-xl leading-8 text-[#d5d0c8]">Шаурма, бургеры, донеры и мясо на углях. Без выдуманных фотографий и скрытых условий.</p><div className="mt-8 flex items-center gap-4"><a href="#menu" className="inline-flex min-h-12 items-center bg-[var(--ember)] px-6 font-semibold text-black">Смотреть меню</a><a href={`tel:${catalog.store.phoneHref}`} className="mono text-sm">{catalog.store.phoneDisplay}</a></div></div>
      </div>
      <div className="absolute right-0 top-8 mono text-[10px] tracking-[.18em] text-[var(--muted)] [writing-mode:vertical-rl]">CHARCOAL · EMBER · {menuItems.length} MENU ITEMS</div>
    </section>
    <MenuExplorer catalog={catalog} />
  </>;
}
