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
    <Link href="/#menu" className="eyebrow">← Вернуться в меню</Link>
    <div className="mt-8 grid gap-10 md:grid-cols-[1.05fr_.95fr] md:items-center">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#181717]"><Image src={product.imagePath} alt="Нейтральная редакционная иллюстрация — фотография блюда не предоставлена" fill priority sizes="(max-width:768px) 100vw, 55vw" className="object-cover" /><span className="absolute bottom-4 left-4 border border-white/20 bg-black/75 px-3 py-2 text-[10px] uppercase tracking-wider">Editorial image · не фото блюда</span></div>
      <div><p className="eyebrow">Меню «МАНГАЛ»</p><h1 className="display mt-5 text-[clamp(58px,8vw,120px)] leading-[.76]">{product.name}</h1><p className="mono mt-8 text-xl text-[var(--copper)]">{product.displayPriceLabel}</p>{product.compositionText ? <p className="mt-7 max-w-xl text-lg leading-8 text-[#c5c0b7]">{product.compositionText}</p> : <p className="mt-7 text-sm text-[var(--muted)]">Состав не был указан в исходном меню и не дополнен предположениями.</p>}{product.portionNote ? <p className="mono mt-4 text-sm">{product.portionNote}</p> : null}<a href="/#menu" className="mt-9 inline-flex min-h-12 items-center bg-[var(--ember)] px-6 font-semibold text-black">Выбрать в меню</a></div>
    </div>
  </section>;
}
