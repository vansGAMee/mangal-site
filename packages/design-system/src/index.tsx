import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatRubles(kopecks: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(kopecks / 100);
}

export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/images/shaverma-logo.png"
      alt="Шаверма Воронеж"
      className={cn("h-9 w-9 rounded-md object-cover border border-[#ff6b00]/30 shadow-sm", className)}
    />
  );
}

export function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 5h2l2.2 9.2h9.7L20 8H7M9 19h.01M17 19h.01" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Button({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"button"> & { children: ReactNode }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[4px] bg-[var(--ember)] px-5 py-3 font-semibold text-white transition-colors duration-200 hover:bg-[#b03010] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--charcoal)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
