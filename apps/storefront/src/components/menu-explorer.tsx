"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowIcon, Button, CartIcon } from "@mangal/design-system";
import type { CatalogProduct, PublicCatalogResponse } from "@mangal/contracts";
import { useCart } from "@/store/cart";
import { ModifierDialog } from "./modifier-dialog";
import { CartDrawer } from "./cart-drawer";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function MenuExplorer({ catalog }: { catalog: PublicCatalogResponse }) {
  const root = useRef<HTMLElement>(null);
  const [activeCategory, setActiveCategory] = useState(catalog.categories[0]?.slug ?? "");
  const [modifierProduct, setModifierProduct] = useState<CatalogProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const add = useCart((state) => state.add);
  const count = useCart((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const category = catalog.categories.find((item) => item.slug === activeCategory) ?? catalog.categories[0];

  useGSAP(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.from("[data-menu-heading]", { y: 44, opacity: 0, duration: .9, ease: "power3.out", scrollTrigger: { trigger: "[data-menu-heading]", start: "top 85%" } });
    gsap.from("[data-product-card]", { y: 30, opacity: 0, duration: .65, stagger: .07, ease: "power3.out", scrollTrigger: { trigger: "[data-product-grid]", start: "top 82%" } });
  }, { scope: root, dependencies: [activeCategory], revertOnUpdate: true });

  function beginAdd(product: CatalogProduct) {
    if (!product.isOrderable || !product.isAvailable) return;
    if (product.modifiers.length) setModifierProduct(product);
    else {
      add({ productId: product.id, quantity: 1, unit: product.saleUnit, modifierOptionIds: [] });
      setCartOpen(true);
    }
  }

  return (
    <section ref={root} id="menu" className="shell scroll-mt-10 pt-24">
      <div className="grid gap-8 border-b border-white/10 pb-9 md:grid-cols-[.8fr_1.2fr] md:items-end"><p className="eyebrow">Фактическое меню · 33 позиции</p><h2 data-menu-heading className="display text-[clamp(52px,9vw,128px)] leading-[.77]">Еда с характером огня</h2></div>
      <div className="sticky top-0 z-30 -mx-4 flex items-center gap-2 overflow-x-auto border-b border-white/10 bg-[#0d0d0e]/95 px-4 py-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {catalog.categories.map((item) => <button key={item.slug} onClick={() => setActiveCategory(item.slug)} aria-pressed={activeCategory === item.slug} className={`shrink-0 rounded-full border px-4 py-2 text-xs transition-colors ${activeCategory === item.slug ? "border-[var(--ember)] bg-[var(--ember)] text-black" : "border-white/15"}`}>{item.name}</button>)}
        <button onClick={() => setCartOpen(true)} aria-label={`Корзина, товаров: ${count}`} className="ml-auto flex min-h-10 shrink-0 items-center gap-2 border border-white/15 px-3"><CartIcon className="h-5 w-5" /><span className="mono text-xs">{count}</span></button>
      </div>
      {category ? <div data-product-grid className="grid md:grid-cols-2 xl:grid-cols-3">
        {category.products.map((product, index) => <article data-product-card key={product.id} className={`group relative border-b border-white/10 py-7 md:px-6 ${index % 3 !== 2 ? "xl:border-r" : ""} md:[&:nth-child(odd)]:border-r xl:[&:nth-child(odd)]:border-r-0`}>
          <Link href={`/menu/${product.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-[#181717]"><Image src={product.imagePath} alt="Нейтральная редакционная иллюстрация — фото блюда не предоставлено" fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.025]" /><span className="absolute bottom-3 left-3 border border-white/20 bg-black/75 px-2 py-1 text-[10px] uppercase tracking-wider">Editorial image</span></Link>
          <div className="mt-5 flex items-start justify-between gap-4"><div><Link href={`/menu/${product.slug}`}><h3 className="display text-3xl leading-[.95]">{product.name}</h3></Link>{product.compositionText ? <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{product.compositionText}</p> : null}{product.portionNote ? <p className="mono mt-3 text-xs text-[var(--copper)]">{product.portionNote}</p> : null}</div><span className="mono shrink-0 text-sm text-[var(--copper)]">{product.displayPriceLabel}</span></div>
          <Button className="mt-6 w-full bg-transparent text-[var(--ivory)] ring-1 ring-inset ring-white/15 hover:bg-[var(--ember)] hover:text-black disabled:hover:bg-transparent disabled:hover:text-[var(--ivory)]" disabled={!product.isOrderable || !product.isAvailable} onClick={() => beginAdd(product)}>{product.isOrderable ? <>Добавить <ArrowIcon className="h-5 w-5" /></> : "Цена уточняется"}</Button>
        </article>)}
      </div> : null}
      <ModifierDialog product={modifierProduct} onClose={() => setModifierProduct(null)} onConfirm={(ids) => { if (!modifierProduct) return; add({ productId: modifierProduct.id, quantity: 1, unit: modifierProduct.saleUnit, modifierOptionIds: ids }); setModifierProduct(null); setCartOpen(true); }} />
      <CartDrawer catalog={catalog} open={cartOpen} onClose={() => setCartOpen(false)} />
    </section>
  );
}
