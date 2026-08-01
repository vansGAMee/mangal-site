import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatus } from "@/components/order-status";

export const metadata: Metadata = { title: "Статус заказа", robots: { index: false, follow: false } };

export default async function OrderPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  return <section className="shell py-20"><p className="eyebrow">Публичный статус без персональных данных</p><h1 className="display mb-10 mt-4 break-words text-[clamp(52px,10vw,120px)] leading-[.8]">Заказ {publicId}</h1><OrderStatus publicId={publicId} /><p className="mt-8 max-w-xl text-sm leading-6 text-[var(--muted)]">Возврат или успех оплаты подтверждаются только проверенным webhook и запросом текущего состояния у эквайера — параметры возврата на эту страницу не считаются доказательством оплаты.</p><Link href="/" className="mt-8 inline-block text-[var(--copper)]">На главную →</Link></section>;
}
