import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout-form";
import { fetchCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Оформление заказа", robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  const catalog = await fetchCatalog();
  return <section className="shell py-16"><p className="eyebrow">Прямое соединение с защищённым API</p><h1 className="display mb-12 mt-4 text-[clamp(54px,10vw,132px)] leading-[.8]">Оформление доставки</h1><CheckoutForm catalog={catalog} /></section>;
}
