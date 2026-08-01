"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button, formatRubles } from "@mangal/design-system";
import type { CatalogProduct } from "@mangal/contracts";

export function ModifierDialog({ product, onClose, onConfirm }: {
  product: CatalogProduct | null;
  onClose: () => void;
  onConfirm: (modifierOptionIds: string[]) => void;
}) {
  const [selection, setSelection] = useState<{ productId: string; ids: Set<string> }>({ productId: "", ids: new Set() });
  const selected = useMemo(() => selection.productId === product?.id ? selection.ids : new Set<string>(), [selection, product?.id]);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (product) requestAnimationFrame(() => closeButton.current?.focus());
  }, [product]);

  useEffect(() => {
    if (!product) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [product, onClose]);

  const valid = useMemo(() => product?.modifiers.every((group) => {
    const count = group.options.filter((option) => selected.has(option.id)).length;
    return count >= group.minSelect && (group.maxSelect === null || count <= group.maxSelect);
  }) ?? false, [product, selected]);

  function toggle(groupId: string, optionId: string, single: boolean) {
    setSelection((current) => {
      const next = new Set(current.productId === product?.id ? current.ids : []);
      const group = product?.modifiers.find((item) => item.id === groupId);
      if (single && group) group.options.forEach((option) => next.delete(option.id));
      if (!single && next.has(optionId)) next.delete(optionId); else next.add(optionId);
      return { productId: product?.id ?? "", ids: next };
    });
  }

  return (
    <AnimatePresence>
      {product ? (
        <motion.div className="fixed inset-0 z-[130] grid place-items-end bg-black/70 p-0 md:place-items-center md:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
          <motion.section role="dialog" aria-modal="true" aria-labelledby="modifier-title" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 34 }} className="max-h-[92dvh] w-full overflow-y-auto border hairline bg-[#fdfaf4] p-5 md:max-w-xl md:rounded-[4px] md:p-8">
            <div className="flex items-start justify-between gap-6">
              <div><p className="eyebrow">Настройте блюдо</p><h2 id="modifier-title" className="display mt-2 text-4xl leading-none">{product.name}</h2></div>
              <button ref={closeButton} onClick={onClose} aria-label="Закрыть" className="grid h-11 w-11 place-items-center border border-[var(--line)] bg-white text-2xl rounded-[4px]">×</button>
            </div>
            <div className="mt-8 space-y-8">
              {product.modifiers.map((group) => (
                <fieldset key={group.id}>
                  <legend className="mb-3 flex w-full justify-between text-sm font-semibold"><span>{group.name}</span><span className="text-[var(--muted)]">{group.required ? "Обязательно" : "По желанию"}</span></legend>
                  <div className="grid gap-2">
                    {group.options.map((option) => (
                      <label key={option.id} className="flex min-h-12 items-center justify-between border border-[var(--line)] bg-white px-4 py-3 rounded-[4px] has-[:checked]:border-[var(--ember)]">
                        <span className="flex items-center gap-3 cursor-pointer"><input type={group.selectionMode === "SINGLE" ? "radio" : "checkbox"} name={group.id} checked={selected.has(option.id)} onChange={() => toggle(group.id, option.id, group.selectionMode === "SINGLE")} disabled={!option.isAvailable} className="accent-[var(--ember)]" />{option.name}</span>
                        <span className="mono text-xs">{option.priceDeltaKopecks ? `+ ${formatRubles(option.priceDeltaKopecks)}` : "0 ₽"}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
            <Button disabled={!valid} className="mt-8 w-full" onClick={() => onConfirm([...selected].sort())}>Добавить в корзину</Button>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
