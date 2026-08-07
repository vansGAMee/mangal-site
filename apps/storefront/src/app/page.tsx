import { fetchCatalog } from "@/lib/catalog";
import { MenuExplorer } from "@/components/menu-explorer";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const catalog = await fetchCatalog();
  const restaurantJsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: "Шаверма Воронеж",
    url: process.env.NEXT_PUBLIC_SITE_URL,
    hasMenu: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/#menu`,
  };
  const menuJsonLd = {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: "Меню «Шаверма Воронеж»",
    hasMenuSection: catalog.categories.map((category) => ({
      "@type": "MenuSection", name: category.name,
      hasMenuItem: category.products.map((product) => ({ "@type": "MenuItem", name: product.name, description: product.compositionText ?? undefined })),
    })),
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantJsonLd).replace(/</g, "\\u003c") }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(menuJsonLd).replace(/</g, "\\u003c") }} />
    <section className="shell pt-8 pb-12 md:pt-14 md:pb-16 border-b hairline">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="eyebrow mb-4 text-[var(--ember)] font-medium tracking-wider">СОЧНО · БЫСТРО · ВКУСНО · {catalog.store.leadTimeMinutes} МИН</p>
          <h1 className="display text-5xl md:text-7xl leading-[1.05] mb-5 text-[var(--charcoal)]">Шаверма Воронеж</h1>
          <p className="text-base md:text-lg leading-relaxed text-[var(--muted)] max-w-lg mb-7">
            Сочная шаурма, легендарные бургеры, донеры и блюда на мангале с доставкой до двери.
          </p>
          
          <div className="flex flex-wrap items-center gap-4 mb-8">
            <a href="#menu" className="inline-flex min-h-12 items-center justify-center rounded-[6px] bg-[var(--ember)] px-8 font-medium text-white transition-colors hover:bg-[#b03010] shadow-sm">
              Смотреть меню
            </a>
          </div>

          <div className="pt-6 border-t hairline grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[var(--muted)]">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--ember)]"></span>
              <span>Готовим после заказа</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--ember)]"></span>
              <span>Самовывоз и доставка</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--ember)]"></span>
              <span>Актуальное меню и цены</span>
            </div>
          </div>
        </div>

        {/* Hero Right Composition */}
        <div className="relative group">
          <div className="relative aspect-[4/3] sm:aspect-[16/10] overflow-hidden rounded-[12px] border hairline bg-[#ebe6dd] shadow-md">
            <img 
              src="/images/demo/hero-grill.jpg" 
              alt="Мясо на открытом огне" 
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white">
              <span className="text-xs font-medium tracking-wide bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-[4px] border border-white/10">
                Сочный шашлык на углях
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* How to Order Block */}
      <div className="mt-14 pt-10 border-t hairline">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h2 className="display text-2xl text-[var(--charcoal)]">Как сделать заказ</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-[8px] bg-white border hairline shadow-xs">
            <span className="mono text-xs text-[var(--ember)] font-semibold mb-2 block">01</span>
            <h3 className="font-medium text-base mb-1 text-[var(--charcoal)]">Выберите блюда</h3>
            <p className="text-xs leading-5 text-[var(--muted)]">Добавьте нужный шашлык, шаурму или напитки в корзину в пару кликов.</p>
          </div>
          <div className="p-5 rounded-[8px] bg-white border hairline shadow-xs">
            <span className="mono text-xs text-[var(--ember)] font-semibold mb-2 block">02</span>
            <h3 className="font-medium text-base mb-1 text-[var(--charcoal)]">Способ получения</h3>
            <p className="text-xs leading-5 text-[var(--muted)]">Выберите самовывоз из заведения или доставку курьером до вашей двери.</p>
          </div>
          <div className="p-5 rounded-[8px] bg-white border hairline shadow-xs">
            <span className="mono text-xs text-[var(--ember)] font-semibold mb-2 block">03</span>
            <h3 className="font-medium text-base mb-1 text-[var(--charcoal)]">Подтвердите заказ</h3>
            <p className="text-xs leading-5 text-[var(--muted)]">Заказ отправляется напрямую на кухню. Готовим быстро и к точному времени.</p>
          </div>
        </div>
      </div>
    </section>
    <MenuExplorer catalog={catalog} />
  </>;
}
