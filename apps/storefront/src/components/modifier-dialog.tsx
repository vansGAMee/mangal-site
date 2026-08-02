"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button, formatRubles } from "@mangal/design-system";
import type { CatalogProduct } from "@mangal/contracts";

export function ModifierDialog({ product, onClose, onConfirm }: {
  product: CatalogProduct | null;
  onClose: () => void;
  onConfirm: (modifierOptionIds: string[]) => void;
}) {
  const reducedMotion = useReducedMotion();
  const [selection, setSelection] = useState<{ productId: string; ids: Set<string> }>({ productId: "", ids: new Set() });
  const selected = useMemo(() => selection.productId === product?.id ? selection.ids : new Set<string>(), [selection, product?.id]);
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!product) return;
    const previous = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => closeButton.current?.focus());
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panel.current) return;
      const focusable = [...panel.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)")];
      if (!focusable.length) return;
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey
        ? (index <= 0 ? focusable.length - 1 : index - 1)
        : (index >= focusable.length - 1 ? 0 : index + 1);
      event.preventDefault();
      focusable[next]?.focus();
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
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
          <motion.section ref={panel} role="dialog" aria-modal="true" aria-labelledby="modifier-title" initial={{ y: reducedMotion ? 0 : 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: reducedMotion ? 0 : 60, opacity: 0 }} transition={reducedMotion ? { duration: 0.12 } : { type: "spring", stiffness: 380, damping: 34 }} className="max-h-[92dvh] w-full overflow-y-auto border hairline bg-[var(--page-bg)] p-5 md:max-w-xl md:rounded-[4px] md:p-8">
            <div className="flex items-start justify-between gap-6">
              <div><p className="eyebrow">Настройте блюдо</p><h2 id="modifier-title" className="display mt-2 text-4xl leading-none">{product.name}</h2></div>
              <button ref={closeButton} onClick={onClose} aria-label="Закрыть" className="grid h-11 w-11 place-items-center rounded-[4px] border border-[var(--line)] bg-[var(--surface-raised)] text-2xl">×</button>
            </div>
            <div className="mt-8 space-y-8">
              {product.modifiers.map((group) => (
                <fieldset key={group.id}>
                  <legend className="mb-3 flex w-full justify-between text-sm font-semibold"><span>{group.name}</span><span className="text-[var(--muted)]">{group.required ? "Обязательно" : "По желанию"}</span></legend>
                  <div className="grid gap-2">
                    {group.options.map((option) => (
                      <label key={option.id} className="flex min-h-12 items-center justify-between rounded-[4px] border border-[var(--line)] bg-[var(--surface)] px-4 py-3 has-[:checked]:border-[var(--ember)]">
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
