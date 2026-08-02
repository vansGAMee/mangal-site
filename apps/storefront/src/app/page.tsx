import Image from "next/image";
import { headers } from "next/headers";
import { MenuExplorer } from "@/components/menu-explorer";
import { fetchCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const catalog = await fetchCatalog();
  const profile = catalog.store.profile;
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const restaurantJsonLd = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: profile.name,
    url: siteUrl,
    ...(profile.phoneHref ? { telephone: profile.phoneHref } : {}),
    ...(profile.email ? { email: profile.email } : {}),
    ...(profile.address
      ? { address: { "@type": "PostalAddress", streetAddress: profile.address } }
      : {}),
    hasMenu: `${siteUrl}/#menu`,
  };
  const menuJsonLd = {
    "@context": "https://schema.org",
    "@type": "Menu",
    name: `Меню «${profile.name}»`,
    hasMenuSection: catalog.categories.map((category) => ({
      "@type": "MenuSection",
      name: category.name,
      hasMenuItem: category.products.map((product) => ({
        "@type": "MenuItem",
        name: product.name,
        ...(product.compositionText ? { description: product.compositionText } : {}),
        ...productOffer(product, profile.currency),
      })),
    })),
  };
  const fulfillment = [
    catalog.store.pickupEnabled ? (catalog.store.pickupLabel ?? "Самовывоз") : null,
    catalog.store.deliveryEnabled && catalog.store.deliveryZones.length ? "Доставка" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <>
      <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(restaurantJsonLd) }} />
      <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(menuJsonLd) }} />
      <section className="shell border-b hairline pb-14 pt-10 md:pb-20 md:pt-16">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
          <div>
            <p className="eyebrow mb-5">Готовим после заказа · от {catalog.store.leadTimeMinutes} минут</p>
            <h1 className="display max-w-5xl text-[clamp(76px,15vw,218px)] leading-[.68] uppercase">
              {profile.name}
            </h1>
            {profile.description ? (
              <p className="mt-10 max-w-2xl text-base leading-7 text-[var(--muted)] md:text-lg">
                {profile.description}
              </p>
            ) : null}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#menu" className="inline-flex min-h-12 items-center justify-center rounded-[4px] bg-[var(--ember)] px-7 font-semibold text-[var(--button-fg)] transition-[filter] hover:brightness-90">
                Смотреть меню
              </a>
              {profile.phoneHref && profile.phoneDisplay ? (
                <a href={`tel:${profile.phoneHref}`} className="inline-flex min-h-12 items-center justify-center rounded-[4px] border hairline px-6 font-medium transition-colors hover:border-[var(--ember)]">
                  {profile.phoneDisplay}
                </a>
              ) : null}
            </div>
          </div>

          <div className="relative min-h-80 overflow-hidden border hairline bg-[var(--surface)]">
            {profile.heroImagePath ? (
              <Image
                src={profile.heroImagePath}
                alt={`Обложка ${profile.name}`}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 42vw"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col justify-between p-7">
                <span className="mono text-xs uppercase tracking-[.22em] text-[var(--muted)]">Editorial placeholder</span>
                <div>
                  <div className="mb-6 h-px w-24 bg-[var(--ember)]" />
                  <p className="display max-w-md text-5xl leading-[.9]">Фотография заведения появится после загрузки владельцем</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-14 grid gap-px border hairline bg-[var(--line)] md:grid-cols-3">
          <EditorialStep number="01" title="Выберите блюда">Цена в корзине предварительная; сервер пересчитает актуальный каталог.</EditorialStep>
          <EditorialStep number="02" title="Способ получения">{fulfillment.length ? fulfillment.join(" · ") : "Способы получения настраивает владелец."}</EditorialStep>
          <EditorialStep number="03" title="Подтвердите заказ">Оплата подтверждается только проверенным состоянием эквайера.</EditorialStep>
        </div>
      </section>
      <MenuExplorer catalog={catalog} />
    </>
  );
}

function EditorialStep({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <article className="bg-[var(--page-bg)] p-6 md:p-8">
      <span className="mono text-xs text-[var(--ember)]">{number}</span>
      <h2 className="display mt-4 text-3xl">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{children}</p>
    </article>
  );
}

function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function productOffer(
  product: PublicCatalogProduct,
  currency: string,
): Record<string, unknown> {
  const priceKopecks = product.basePriceKopecks ?? product.unitPriceKopecks;
  if (!product.isOrderable || product.requiresPriceConfirmation || priceKopecks === null) return {};
  return {
    offers: {
      "@type": "Offer",
      priceCurrency: currency,
      price: priceKopecks / 100,
      availability: product.isAvailable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };
}

type PublicCatalogProduct = Awaited<ReturnType<typeof fetchCatalog>>["categories"][number]["products"][number];
