"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CartIcon, formatRubles } from "@mangal/design-system";
import type { PublicCatalogResponse } from "@mangal/contracts";
import { useCart } from "@/store/cart";

export function CartDrawer({ catalog, open, onClose }: { catalog: PublicCatalogResponse; open: boolean; onClose: () => void }) {
  const items = useCart((state) => state.items);
  const setQuantity = useCart((state) => state.setQuantity);
  const panel = useRef<HTMLElement>(null);
  const products = useMemo(() => new Map(catalog.categories.flatMap((category) => category.products).map((product) => [product.id, product])), [catalog]);
  const total = items.reduce((sum, item) => {
    const product = products.get(item.productId);
    if (!product) return sum;
    const base = product.pricingType === "FIXED" ? product.basePriceKopecks : product.unitPriceKopecks;
    const options = product.modifiers.flatMap((group) => group.options);
    const modifier = options.filter((option) => item.modifierOptionIds.includes(option.id)).reduce((amount, option) => amount + option.priceDeltaKopecks, 0);
    return sum + ((base ?? 0) + modifier) * item.quantity;
  }, 0);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>("button, a, input");
    requestAnimationFrame(() => first?.focus());
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panel.current) return;
      const focusable = [...panel.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled)")];
      if (!focusable.length) return;
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey ? (index <= 0 ? focusable.length - 1 : index - 1) : (index >= focusable.length - 1 ? 0 : index + 1);
      event.preventDefault(); focusable[next]?.focus();
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-[120] bg-black/65" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
          <motion.aside ref={panel} role="dialog" aria-modal="true" aria-labelledby="cart-title" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 330, damping: 34 }} className="ml-auto flex h-full w-full max-w-lg flex-col border-l hairline bg-[#fdfaf4] p-5 sm:p-8">
            <div className="flex items-center justify-between"><h2 id="cart-title" className="display text-4xl">Корзина</h2><div className="flex gap-4 items-center"><button onClick={() => useCart.getState().clear()} className="text-[var(--ember)] text-sm underline hover:no-underline">Очистить всё</button><button onClick={onClose} className="grid h-11 w-11 place-items-center border border-[var(--line)] text-2xl" aria-label="Закрыть корзину">×</button></div></div>
            <div className="mt-7 flex-1 overflow-y-auto" aria-live="polite">
              {!items.length ? <div className="grid min-h-64 place-items-center text-center text-[var(--muted)]"><div><CartIcon className="mx-auto mb-4 h-8 w-8" /><p>Здесь пока тихо.<br />Выберите блюдо из меню.</p></div></div> : null}
              {items.map((line) => {
                const product = products.get(line.productId);
                if (!product) return null;
                const selected = product.modifiers.flatMap((group) => group.options).filter((option) => line.modifierOptionIds.includes(option.id));
                return <article key={`${line.productId}:${line.unit}:${line.modifierOptionIds.join(",")}`} className="border-t border-[var(--line)] py-5 first:border-t-0">
                  <div className="flex justify-between gap-4"><h3 className="font-semibold">{product.name}</h3><span className="mono text-sm">{product.displayPriceLabel}</span></div>
                  {selected.length ? <p className="mt-2 text-xs text-[var(--muted)]">{selected.map((option) => option.name).join(", ")}</p> : null}
                  <div className="mt-4 flex items-center gap-1"><button aria-label="Уменьшить количество" className="h-10 w-10 border border-[var(--line)] bg-white" onClick={() => setQuantity(line, line.quantity - 1)}>−</button><output className="mono grid h-10 min-w-12 place-items-center">{line.quantity}{line.unit === "KILOGRAM" ? " кг" : ""}</output><button aria-label="Увеличить количество" className="h-10 w-10 border border-[var(--line)] bg-white" onClick={() => setQuantity(line, line.quantity + 1)}>+</button></div>
                </article>;
              })}
            </div>
            <div className="border-t border-[var(--line)] pt-5"><div className="flex justify-between"><span>Предварительная сумма</span><strong className="mono">{formatRubles(total)}</strong></div><p className="mt-2 text-xs leading-5 text-[var(--muted)]">Финальная цена и доступность повторно проверяются сервером при оформлении.</p>{items.length && catalog.store.deliveryZones.length ? <Link href="/checkout" onClick={onClose} className="mt-5 grid min-h-12 w-full place-items-center rounded-[4px] bg-[var(--ember)] px-5 font-semibold text-white transition-colors hover:bg-[#b03010]">Перейти к оформлению</Link> : <span className="mt-5 grid min-h-12 w-full place-items-center rounded-[4px] bg-gray-300 px-5 font-semibold text-[var(--charcoal)] opacity-50 cursor-not-allowed">Перейти к оформлению</span>}{!catalog.store.deliveryZones.length ? <p className="mt-3 text-xs text-[var(--copper)]">Зоны доставки ещё не подтверждены оператором.</p> : null}</div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
