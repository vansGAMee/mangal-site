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
    <svg className={cn("h-11 w-11", className)} viewBox="0 0 52 52" aria-hidden="true">
      <path d="M8 40 19 10l7 19 7-19 11 30" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M13 34h26" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
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
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[4px] bg-[var(--ember)] px-5 py-3 font-semibold text-[var(--charcoal)] transition-transform duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--ivory)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
