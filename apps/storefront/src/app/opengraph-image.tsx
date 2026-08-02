import { ImageResponse } from "next/og";
import { fetchCatalog } from "@/lib/catalog";

export const alt = "Обложка ресторана";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const { store } = await fetchCatalog();
  const profile = store.profile;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: profile.backgroundColor,
        color: profile.foregroundColor,
        padding: 74,
        justifyContent: "space-between",
        border: `18px solid ${profile.primaryColor}`,
      }}
    >
      <span style={{ color: profile.secondaryColor, fontSize: 26, letterSpacing: 6 }}>
        МЕНЮ · ЗАКАЗ · ДОСТАВКА
      </span>
      <span style={{ fontSize: 160, fontWeight: 700, lineHeight: 0.8 }}>{profile.name}</span>
      <span style={{ fontSize: 28 }}>{profile.phoneDisplay ?? profile.address ?? "Онлайн-меню"}</span>
    </div>,
    size,
  );
}
