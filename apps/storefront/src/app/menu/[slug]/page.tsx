import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

async function productBySlug(slug: string) {
  const catalog = await fetchCatalog();
  return catalog.categories.flatMap((category) => category.products).find((product) => product.slug === slug);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await productBySlug(slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.compositionText ?? `${product.name} в меню «МАНГАЛ». ${product.displayPriceLabel}.`,
    alternates: { canonical: `/menu/${product.slug}` },
    openGraph: { title: `${product.name} — МАНГАЛ`, description: product.compositionText ?? product.displayPriceLabel },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await productBySlug(slug);
  if (!product) notFound();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const confirmedPriceKopecks = product.basePriceKopecks ?? product.unitPriceKopecks;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.compositionText ?? undefined,
    image: `${siteUrl}${product.imagePath}`,
    ...(product.requiresPriceConfirmation || confirmedPriceKopecks === null ? {} : {
      offers: {
        "@type": "Offer",
        priceCurrency: "RUB",
        price: confirmedPriceKopecks / 100,
        availability: product.isOrderable && product.isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url: `${siteUrl}/menu/${product.slug}`,
      },
    }),
  };
  return <section className="shell py-10 md:py-20">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <Link href="/#menu" className="eyebrow inline-flex hover:text-[var(--ember)] transition-colors">← Вернуться в меню</Link>
    <div className="mt-8 grid gap-10 md:gap-16 md:grid-cols-[1.1fr_.9fr] md:items-start">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#ebe6dd] rounded-[4px]">
        <Image src={product.imagePath} alt="Фотография блюда не предоставлена" fill priority sizes="(max-width:768px) 100vw, 55vw" className="object-cover" />
        <span className="absolute bottom-4 left-4 bg-white/90 px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--charcoal)] border hairline rounded-[2px]">Editorial image · не фото блюда</span>
      </div>
      <div className="md:pt-4">
        <p className="eyebrow mb-4">Меню «МАНГАЛ»</p>
        <h1 className="display text-4xl md:text-6xl leading-tight mb-6">{product.name}</h1>
        <p className="mono text-2xl font-semibold mb-8">{product.displayPriceLabel}</p>
        
        {product.compositionText ? (
          <p className="max-w-xl text-lg leading-relaxed text-[var(--charcoal-raised)] mb-6">{product.compositionText}</p>
        ) : (
          <p className="text-sm text-[var(--muted)] mb-6">Состав не указан.</p>
        )}
        
        {product.portionNote && (
          <p className="mono text-sm text-[var(--muted)] mb-8">{product.portionNote}</p>
        )}
        
        <Link href="/#menu" className="inline-flex min-h-12 items-center justify-center rounded-[4px] bg-[var(--ember)] px-8 font-semibold text-white transition-colors hover:bg-[#b03010]">
          К меню
        </Link>
      </div>
    </div>
  </section>;
}
