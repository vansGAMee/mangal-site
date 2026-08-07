import { ImageResponse } from "next/og";
export const runtime = "edge";
export const alt = "Шаверма Воронеж — сочная шаурма, бургеры, доставка";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function OpenGraphImage() { return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", background: "#0D0D0E", color: "#F4F1EA", padding: 74, alignItems: "flex-end", justifyContent: "space-between", border: "18px solid #FF6B00" }}><div style={{ display: "flex", flexDirection: "column" }}><span style={{ color: "#FF6B00", fontSize: 26, letterSpacing: 6 }}>СОЧНАЯ ШАУРМА · БУРГЕРЫ · ДОСТАВКА</span><span style={{ fontSize: 130, fontWeight: 700, lineHeight: .8 }}>ШАВЕРМА</span></div></div>, size); }
