import { ImageResponse } from "next/og";
export const runtime = "edge";
export const alt = "МАНГАЛ — мясо, огонь, доставка";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function OpenGraphImage() { return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", background: "#0D0D0E", color: "#F4F1EA", padding: 74, alignItems: "flex-end", justifyContent: "space-between", border: "18px solid #E04E1B" }}><div style={{ display: "flex", flexDirection: "column" }}><span style={{ color: "#C89D5C", fontSize: 26, letterSpacing: 6 }}>МЯСО · ОГОНЬ · ДОСТАВКА</span><span style={{ fontSize: 190, fontWeight: 700, lineHeight: .8 }}>МАНГАЛ</span></div><span style={{ fontSize: 30 }}>8 927 106 16 44</span></div>, size); }
