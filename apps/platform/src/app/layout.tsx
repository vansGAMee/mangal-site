import type { Metadata } from "next";
import "./admin/admin.css";
export const metadata: Metadata = { title: "МАНГАЛ Platform", robots: { index: false, follow: false } };
export default function PlatformLayout({ children }: { children: React.ReactNode }) { return <html lang="ru"><body>{children}</body></html>; }
