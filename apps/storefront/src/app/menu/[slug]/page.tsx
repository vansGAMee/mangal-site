import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

async function catalogProduct(slug: string) {
  const catalog = await fetchCatalog();
  const product = catalog.categories
    .flatMap((category) => category.products)
    .find((item) => item.slug === slug);
  return { product, profile: catalog.store.profile };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { product, profile } = await catalogProduct(slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.compositionText ?? `${product.name} в меню «${profile.name}». ${product.displayPriceLabel}.`,
    alternates: { canonical: `/menu/${product.slug}` },
    openGraph: {
      title: `${product.name} — ${profile.name}`,
      description: product.compositionText ?? product.displayPriceLabel,
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { product, profile } = await catalogProduct(slug);
  if (!product) notFound();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const confirmedPriceKopecks = product.basePriceKopecks ?? product.unitPriceKopecks;
  const hasImage = Boolean(product.imagePath && product.imagePath !== "/images/product-placeholder.svg");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.compositionText ? { description: product.compositionText } : {}),
    ...(hasImage ? { image: new URL(product.imagePath, siteUrl).toString() } : {}),
    ...(product.requiresPriceConfirmation || confirmedPriceKopecks === null
      ? {}
      : {
          offers: {
            "@type": "Offer",
            priceCurrency: profile.currency,
            price: confirmedPriceKopecks / 100,
            availability: product.isOrderable && product.isAvailable
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            url: `${siteUrl}/menu/${product.slug}`,
          },
        }),
  };
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <section className="shell py-10 md:py-20">
      <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Link href="/#menu" className="eyebrow inline-flex transition-colors hover:text-[var(--ember)]">← Вернуться в меню</Link>
      <div className="mt-8 grid gap-10 md:grid-cols-[1.1fr_.9fr] md:items-start md:gap-16">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[3px] border hairline bg-[var(--surface)]">
          {hasImage ? (
            <Image src={product.imagePath} alt={product.name} fill priority sizes="(max-width:768px) 100vw, 55vw" className="object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col justify-between p-7">
              <span className="mono text-xs uppercase tracking-[.2em] text-[var(--muted)]">Изображение не предоставлено</span>
              <p className="display max-w-lg text-5xl leading-[.88]">{product.name}</p>
              <div className="h-px w-24 bg-[var(--ember)]" />
            </div>
          )}
        </div>
        <div className="md:pt-4">
          <p className="eyebrow mb-4">Меню «{profile.name}»</p>
          <h1 className="display mb-6 text-4xl leading-tight md:text-6xl">{product.name}</h1>
          <p className="mono mb-8 text-2xl font-semibold">{product.displayPriceLabel}</p>
          {product.compositionText ? (
            <p className="mb-6 max-w-xl text-lg leading-relaxed text-[var(--charcoal-raised)]">{product.compositionText}</p>
          ) : (
            <p className="mb-6 text-sm text-[var(--muted)]">Состав не указан.</p>
          )}
          {product.portionNote ? <p className="mono mb-8 text-sm text-[var(--muted)]">{product.portionNote}</p> : null}
          <Link href="/#menu" className="inline-flex min-h-12 items-center justify-center rounded-[4px] bg-[var(--ember)] px-8 font-semibold text-[var(--button-fg)] transition-[filter] hover:brightness-90">
            К меню
          </Link>
        </div>
      </div>
    </section>
  );
}
