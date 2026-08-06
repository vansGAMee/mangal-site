import type { Metadata } from "next";
import "./admin/admin.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Шаверма Воронеж · Admin", robots: { index: false, follow: false } };
export default function PlatformLayout({ children }: { children: React.ReactNode }) { return <html lang="ru"><body>{children}</body></html>; }
