import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@mangal/design-system";
import { CookieConsent } from "@/components/cookie-consent";
import { fetchCatalog } from "@/lib/catalog";
import { displayFont, interfaceFont, monoFont } from "./fonts";
import "./globals.css";

function publicSiteUrl(): URL {
  return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
}

function themeName(theme: "MANGAL_DARK" | "CAFE_LIGHT" | "SUSHI_MINIMAL") {
  return theme.toLowerCase().replaceAll("_", "-");
}

export async function generateMetadata(): Promise<Metadata> {
  const { store } = await fetchCatalog();
  const profile = store.profile;
  return {
    metadataBase: publicSiteUrl(),
    title: { default: profile.seoTitle, template: `%s — ${profile.name}` },
    description: profile.seoDescription,
    alternates: { canonical: "/" },
    icons: profile.faviconPath ? { icon: profile.faviconPath } : { icon: "/icon.svg" },
    openGraph: {
      title: profile.seoTitle,
      description: profile.seoDescription,
      type: "website",
      locale: "ru_RU",
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: profile.name }],
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const { store } = await fetchCatalog();
  return {
    width: "device-width",
    initialScale: 1,
    themeColor: store.profile.backgroundColor,
    colorScheme: "dark light",
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { store } = await fetchCatalog();
  const profile = store.profile;
  const themeStyles = {
    "--brand-primary": profile.primaryColor,
    "--brand-secondary": profile.secondaryColor,
    "--page-bg": profile.backgroundColor,
    "--page-fg": profile.foregroundColor,
    ...(profile.buttonColor ? { "--ember": profile.buttonColor } : {}),
  } as CSSProperties;

  return (
    <html
      lang="ru"
      data-theme={themeName(profile.theme)}
      className={`${displayFont.variable} ${interfaceFont.variable} ${monoFont.variable}`}
      style={themeStyles}
    >
      <body>
        <a href="#content" className="skip-link">К содержанию</a>
        <header className="site-header">
          <div className="shell flex min-h-16 items-center justify-between gap-5">
            <Link href="/" aria-label={`${profile.name} — на главную`} className="inline-flex items-center gap-3">
              {profile.logoPath ? (
                <Image src={profile.logoPath} alt="" width={44} height={44} className="h-9 w-9 object-contain" priority />
              ) : (
                <BrandMark className="h-8 w-8" />
              )}
              <span className="hidden text-sm font-semibold tracking-[0.12em] sm:inline">{profile.name}</span>
            </Link>
            <nav aria-label="Основная навигация" className="flex items-center gap-5 text-sm font-medium">
              <Link href="/#menu" className="transition-colors hover:text-[var(--ember)]">Меню</Link>
              {profile.phoneHref && profile.phoneDisplay ? (
                <a href={`tel:${profile.phoneHref}`} className="mono hidden text-xs transition-colors hover:text-[var(--ember)] sm:inline">
                  {profile.phoneDisplay}
                </a>
              ) : null}
            </nav>
          </div>
        </header>
        <main id="content">{children}</main>
        <footer className="site-footer">
          <div className="shell grid gap-10 md:grid-cols-[1fr_1.5fr]">
            <div>
              <BrandMark className="opacity-35" />
              <p className="mt-5 max-w-sm text-sm leading-6 text-[var(--muted)]">
                {profile.legalName && profile.legalInn && profile.legalRegistrationNo
                  ? `${profile.legalName} · ИНН ${profile.legalInn} · ${profile.legalRegistrationNo}`
                  : "Реквизиты оператора не подтверждены. Production launch остаётся заблокирован до их публикации."}
              </p>
              {profile.legalAddress ? <p className="mt-2 text-sm text-[var(--muted)]">{profile.legalAddress}</p> : null}
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-2">
              <Link href={profile.privacyPolicyPath} className="footer-link">Политика конфиденциальности</Link>
              <Link href="/legal/terms" className="footer-link">Пользовательское соглашение</Link>
              <Link href="/legal/offer" className="footer-link">Оферта и условия доставки</Link>
              <Link href="/legal/marketing" className="footer-link">Согласие на рассылку</Link>
              <Link href="/legal/cookies" className="footer-link">Уведомление о cookie</Link>
              {profile.phoneHref && profile.phoneDisplay ? (
                <a href={`tel:${profile.phoneHref}`} className="footer-link">{profile.phoneDisplay}</a>
              ) : null}
              {profile.email ? <a href={`mailto:${profile.email}`} className="footer-link">{profile.email}</a> : null}
            </div>
          </div>
        </footer>
        <CookieConsent />
      </body>
    </html>
  );
}
