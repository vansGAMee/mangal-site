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
    const cards = gsap.utils.toArray<HTMLElement>("[data-product-card]");
    if (!cards.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.from(cards, {
      y: 36,
      opacity: 0,
      duration: 0.8,
      stagger: 0.07,
      ease: "power3.out",
      scrollTrigger: { trigger: "[data-product-grid]", start: "top 86%", once: true },
    });
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
    <section ref={root} id="menu" className="shell scroll-mt-24 pt-12">
      <div className="grid gap-4 md:grid-cols-[1fr_1.5fr] md:items-end mb-8">
        <div>
          <p className="eyebrow mb-3">Наше меню</p>
          <h2 className="display text-4xl leading-tight">Еда с характером огня</h2>
        </div>
      </div>
      
      <div className="sticky top-16 z-30 -mx-4 flex items-center gap-6 overflow-x-auto border-b hairline bg-[var(--page-bg)] px-4 py-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {catalog.categories.map((item) => (
          <button 
            key={item.slug} 
            onClick={() => setActiveCategory(item.slug)} 
            aria-pressed={activeCategory === item.slug} 
            className={`shrink-0 text-sm font-semibold transition-colors pb-1 border-b-2 ${activeCategory === item.slug ? "border-[var(--ember)] text-[var(--charcoal)]" : "border-transparent text-[var(--muted)] hover:text-[var(--charcoal)]"}`}
          >
            {item.name}
          </button>
        ))}
        {count > 0 && (
          <button onClick={() => setCartOpen(true)} aria-label={`Корзина, товаров: ${count}`} className="ml-auto flex min-h-10 shrink-0 items-center gap-2 rounded-[4px] bg-[var(--ember)] px-4 text-[var(--button-fg)] transition-[filter] hover:brightness-90">
            <CartIcon className="h-5 w-5" /><span className="mono text-xs">{count}</span>
          </button>
        )}
      </div>

      {category ? (
        <div data-product-grid className="grid gap-x-6 gap-y-8 md:grid-cols-2 xl:grid-cols-3 pt-8">
          {category.products.map((product) => (
            <article 
              data-product-card 
              key={product.id} 
              className="group relative flex flex-col justify-between rounded-[var(--radius-card)] border hairline bg-[var(--surface)] p-5 transition-colors duration-200 hover:border-[var(--ember)]"
            >
              <div>
                <Link href={`/menu/${product.slug}`} className="relative block aspect-[4/3] overflow-hidden rounded-[3px] border hairline bg-[var(--surface-raised)]">
                  {product.imagePath && product.imagePath !== "/images/product-placeholder.svg" ? (
                    <>
                      <Image 
                        src={product.imagePath} 
                        alt={product.name}
                        fill 
                        sizes="(max-width:768px) 100vw, 33vw" 
                        className="object-cover transition-transform duration-300 group-hover:scale-105" 
                      />
                    </>
                  ) : (
                    <div className="flex h-full w-full flex-col justify-between p-4">
                      <div className="flex items-center justify-between">
                        <span className="mono text-[10px] uppercase tracking-widest text-[var(--muted)]">{catalog.store.profile.name}</span>
                        <span className="h-px w-10 bg-[var(--ember)]" aria-hidden="true" />
                      </div>
                      <div className="text-center py-4">
                        <p className="display text-xl text-[var(--charcoal)] opacity-90">{product.name}</p>
                        <p className="text-[10px] text-[var(--muted)] mt-1 uppercase tracking-wider">Изображение готовится</p>
                      </div>
                      <div className="mx-auto h-px w-12 bg-[var(--ember)]/50" />
                    </div>
                  )}
                </Link>
                
                <div className="mt-4 flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/menu/${product.slug}`}>
                      <h3 className="display text-xl text-[var(--charcoal)] leading-tight group-hover:text-[var(--ember)] transition-colors">{product.name}</h3>
                    </Link>
                    <span className="mono shrink-0 text-right text-base font-semibold text-[var(--charcoal)]">
                      {product.oldPriceKopecks ? <del className="mr-2 block text-xs font-normal text-[var(--muted)]">{product.oldPriceKopecks / 100} ₽</del> : null}
                      {product.displayPriceLabel}
                    </span>
                  </div>
                  {product.compositionText ? <p className="mt-2 text-xs leading-5 text-[var(--muted)] line-clamp-2">{product.compositionText}</p> : null}
                  {product.portionNote ? <p className="mono mt-2 text-[11px] text-[var(--ember)]">{product.portionNote}</p> : null}
                </div>
              </div>
              
              <Button 
                className={`mt-5 w-full rounded-[4px] ${!product.isOrderable ? "border border-[var(--line)] bg-transparent text-[var(--charcoal)]" : "bg-[var(--ember)] text-[var(--button-fg)]"}`}
                disabled={!product.isOrderable || !product.isAvailable} 
                onClick={() => beginAdd(product)}
              >
                {!product.isAvailable ? "Временно нет" : product.isOrderable ? <>Добавить <ArrowIcon className="h-4 w-4 ml-1" /></> : "Цена уточняется"}
              </Button>
            </article>
          ))}
        </div>
      ) : null}
      <ModifierDialog product={modifierProduct} onClose={() => setModifierProduct(null)} onConfirm={(ids) => { if (!modifierProduct) return; add({ productId: modifierProduct.id, quantity: 1, unit: modifierProduct.saleUnit, modifierOptionIds: ids }); setModifierProduct(null); setCartOpen(true); }} />
      <CartDrawer catalog={catalog} open={cartOpen} onClose={() => setCartOpen(false)} />
    </section>
  );
}
