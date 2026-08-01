import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { displayFont, interfaceFont, monoFont } from "./fonts";
import { BrandMark } from "@mangal/design-system";
import { CookieConsent } from "@/components/cookie-consent";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "МАНГАЛ — мясо, огонь, доставка", template: "%s — МАНГАЛ" },
  description: "Шаурма, бургеры, донеры и мясо на углях. Заказ по телефону 8 927 106 16 44.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "МАНГАЛ — мясо, огонь, доставка",
    description: "Фактическое меню заведения и оформление доставки онлайн.",
    type: "website",
    locale: "ru_RU",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "МАНГАЛ" }],
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0D0D0E", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${displayFont.variable} ${interfaceFont.variable} ${monoFont.variable}`}>
      <body>
        <a href="#content" className="fixed left-3 top-3 z-[200] -translate-y-24 bg-[var(--ivory)] px-4 py-3 text-black focus:translate-y-0">К содержанию</a>
        <header className="shell flex min-h-20 items-center justify-between border-b hairline">
          <Link href="/" aria-label="МАНГАЛ — на главную"><BrandMark /></Link>
          <nav aria-label="Основная навигация" className="flex items-center gap-5 text-sm">
            <Link href="/#menu" className="hidden sm:inline">Меню</Link>
            <a href="tel:+79271061644" className="mono text-xs sm:text-sm">8 927 106 16 44</a>
          </nav>
        </header>
        <main id="content">{children}</main>
        <footer className="mt-24 border-t hairline py-12">
          <div className="shell grid gap-10 md:grid-cols-[1fr_1.5fr]">
            <div><BrandMark /><p className="mt-5 max-w-sm text-sm leading-6 text-[var(--muted)]">Реквизиты оператора будут опубликованы после подтверждения. До этого production launch заблокирован.</p></div>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <Link href="/legal/privacy">Политика конфиденциальности</Link>
              <Link href="/legal/terms">Пользовательское соглашение</Link>
              <Link href="/legal/offer">Оферта и условия доставки</Link>
              <Link href="/legal/marketing">Согласие на рассылку</Link>
              <Link href="/legal/cookies">Уведомление о cookie</Link>
              <a href="tel:+79271061644">8 927 106 16 44</a>
            </div>
          </div>
        </footer>
        <CookieConsent />
      </body>
    </html>
  );
}
