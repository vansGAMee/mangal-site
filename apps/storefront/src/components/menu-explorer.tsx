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
      
      {/* Category navigation - Light Mode */}
      <div className="sticky top-16 z-30 -mx-4 flex items-center gap-6 overflow-x-auto border-b hairline bg-[var(--ivory)]/95 backdrop-blur-sm px-4 py-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
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
          <button onClick={() => setCartOpen(true)} aria-label={`Корзина, товаров: ${count}`} className="ml-auto flex min-h-10 shrink-0 items-center gap-2 rounded-[4px] bg-[var(--ember)] px-4 text-white hover:bg-[#b03010] transition-colors">
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
              className="group relative flex flex-col justify-between rounded-[12px] border hairline bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
            >
              <div>
                {/* Photo / No-photo visual header */}
                <Link href={`/menu/${product.slug}`} className="relative block aspect-[4/3] overflow-hidden rounded-[8px] bg-[#f5efe6] border hairline">
                  {product.imagePath ? (
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
                    <div className="flex h-full w-full flex-col justify-between p-4 bg-gradient-to-br from-[#faf6ee] to-[#ebe3d5]">
                      <div className="flex items-center justify-between">
                        <span className="mono text-[10px] uppercase tracking-widest text-[var(--muted)]">Шаверма Воронеж</span>
                        <span className="h-2 w-2 rounded-full bg-[var(--ember)] opacity-80"></span>
                      </div>
                      <div className="text-center py-4">
                        <p className="display text-xl text-[var(--charcoal)] opacity-90">{product.name}</p>
                        <p className="text-[10px] text-[var(--muted)] mt-1 uppercase tracking-wider">Изображение готовится</p>
                      </div>
                      <div className="h-0.5 w-12 bg-[var(--ember)]/40 rounded-full mx-auto"></div>
                    </div>
                  )}
                </Link>
                
                <div className="mt-4 flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/menu/${product.slug}`}>
                      <h3 className="display text-xl text-[var(--charcoal)] leading-tight group-hover:text-[var(--ember)] transition-colors">{product.name}</h3>
                    </Link>
                    <span className="mono shrink-0 text-base font-semibold text-[var(--charcoal)]">{product.displayPriceLabel}</span>
                  </div>
                  {product.compositionText ? <p className="mt-2 text-xs leading-5 text-[var(--muted)] line-clamp-2">{product.compositionText}</p> : null}
                  {product.portionNote ? <p className="mono mt-2 text-[11px] text-[var(--ember)]">{product.portionNote}</p> : null}
                </div>
              </div>
              
              <Button 
                className={`mt-5 w-full rounded-[6px] transition-colors ${!product.isOrderable ? "bg-transparent text-[var(--charcoal)] border border-[var(--line)] hover:bg-[#f5efe6]" : "bg-[var(--ember)] text-white hover:bg-[#b03010]"}`} 
                disabled={!product.isOrderable || !product.isAvailable} 
                onClick={() => beginAdd(product)}
              >
                {product.isOrderable ? <>Добавить <ArrowIcon className="h-4 w-4 ml-1" /></> : "Цена уточняется"}
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
