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

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fdfaf4", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${displayFont.variable} ${interfaceFont.variable} ${monoFont.variable}`}>
      <body>
        <a href="#content" className="fixed left-3 top-3 z-[200] -translate-y-24 bg-[var(--charcoal)] px-4 py-3 text-[var(--ivory)] focus:translate-y-0">К содержанию</a>
        <header className="sticky top-0 z-50 bg-[var(--ivory)]/95 backdrop-blur-sm border-b hairline">
          <div className="shell flex min-h-16 items-center justify-between">
            <Link href="/" aria-label="МАНГАЛ — на главную"><BrandMark className="h-8 w-8" /></Link>
            <nav aria-label="Основная навигация" className="flex items-center gap-5 text-sm font-medium">
              <Link href="/#menu" className="hidden sm:inline hover:text-[var(--ember)] transition-colors">Меню</Link>
              <a href="tel:+79271061644" className="mono text-xs sm:text-sm hover:text-[var(--ember)] transition-colors">8 927 106 16 44</a>
            </nav>
          </div>
        </header>
        <main id="content">{children}</main>
        <footer className="mt-24 border-t hairline bg-[#f4f0e6] py-12">
          <div className="shell grid gap-10 md:grid-cols-[1fr_1.5fr]">
            <div>
              <BrandMark className="text-[var(--charcoal)] opacity-30" />
              <p className="mt-5 max-w-sm text-sm leading-6 text-[var(--muted)]">Реквизиты оператора будут опубликованы после подтверждения. До этого production launch заблокирован.</p>
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-2 text-[var(--charcoal-raised)]">
              <Link href="/legal/privacy" className="hover:text-[var(--ember)] transition-colors">Политика конфиденциальности</Link>
              <Link href="/legal/terms" className="hover:text-[var(--ember)] transition-colors">Пользовательское соглашение</Link>
              <Link href="/legal/offer" className="hover:text-[var(--ember)] transition-colors">Оферта и условия доставки</Link>
              <Link href="/legal/marketing" className="hover:text-[var(--ember)] transition-colors">Согласие на рассылку</Link>
              <Link href="/legal/cookies" className="hover:text-[var(--ember)] transition-colors">Уведомление о cookie</Link>
              <a href="tel:+79271061644" className="hover:text-[var(--ember)] transition-colors">8 927 106 16 44</a>
            </div>
          </div>
        </footer>
        <CookieConsent />
      </body>
    </html>
  );
}
