"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const COOKIE_NAME = "mangal_cookie_consent";

export function CookieConsent() {
  const [decision, setDecision] = useState<"accepted" | "necessary" | null | undefined>(undefined);

  useEffect(() => {
    const value = document.cookie.split("; ").find((item) => item.startsWith(`${COOKIE_NAME}=`))?.split("=")[1];
    const normalized = value === "accepted.cookie-v1" ? "accepted" : value === "necessary.cookie-v1" ? "necessary" : null;
    queueMicrotask(() => setDecision(normalized));
  }, []);

  useEffect(() => {
    if (decision !== "accepted") return;
    const id = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;
    if (!id || document.querySelector("script[data-mangal-metrika]")) return;
    window.ym = window.ym ?? function (...args: unknown[]) { (window.ym!.a = window.ym!.a ?? []).push(args); };
    window.ym.l = Date.now();
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://mc.yandex.ru/metrika/tag.js";
    script.dataset.mangalMetrika = "true";
    script.addEventListener("load", () => window.ym?.(Number(id), "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false }));
    document.head.append(script);
  }, [decision]);

  function decide(value: "accepted" | "necessary") {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_NAME}=${value}.cookie-v1; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    setDecision(value);
  }

  return (
    <AnimatePresence>
      {decision === null ? (
        <motion.section
          initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 34 }}
          className="fixed inset-x-0 bottom-0 z-[150] border-t border-white/15 bg-[#151516] p-4 shadow-[0_-18px_60px_rgba(0,0,0,.45)]"
          role="dialog" aria-label="Настройки cookie"
        >
          <div className="shell flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <p className="m-0 max-w-3xl text-sm leading-6 text-[#c5c0b7]">Необходимые cookie обеспечивают корзину и безопасность. Яндекс Метрика загрузится только после вашего согласия; Webvisor и передача персональных данных отключены.</p>
            <div className="grid shrink-0 grid-cols-2 gap-2">
              <button onClick={() => decide("accepted")} className="min-h-12 rounded-[4px] border border-[var(--copper)] bg-[var(--copper)] px-4 font-semibold text-black">Принять</button>
              <button onClick={() => decide("necessary")} className="min-h-12 rounded-[4px] border border-[var(--copper)] px-4 font-semibold">Только необходимые</button>
            </div>
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}

declare global {
  interface Window {
    ym?: ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
  }
}
