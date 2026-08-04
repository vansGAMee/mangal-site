import { describe, expect, it } from "vitest";
import { RestaurantProfileInputSchema, colorContrastRatio } from "@mangal/contracts";

const base = {
  slug: "primer",
  name: "Пример",
  description: null,
  logoPath: null,
  faviconPath: null,
  heroImagePath: null,
  heroTitle: null,
  buttonColor: null,
  primaryColor: "#E04E1B",
  secondaryColor: "#C89D5C",
  phoneDisplay: null,
  phoneHref: null,
  email: null,
  address: null,
  latitude: null,
  longitude: null,
  vkUrl: null,
  telegramUrl: null,
  whatsappUrl: null,
  currency: "RUB",
  timezone: "Europe/Moscow",
  seoTitle: "Пример — меню",
  seoDescription: "Описание меню",
  legalName: null,
  legalInn: null,
  legalRegistrationNo: null,
  legalAddress: null,
  privacyPolicyPath: "/legal/privacy",
  deliveryEnabled: false,
  pickupEnabled: false,
  pickupLabel: null,
};

describe("restaurant profile themes", () => {
  it.each([
    ["MANGAL_DARK", "#0D0D0E", "#F4F1EA"],
    ["CAFE_LIGHT", "#F7F2E8", "#1B1A18"],
    ["SUSHI_MINIMAL", "#F3F3EE", "#171A17"],
  ] as const)("accepts %s with accessible body contrast", (theme, backgroundColor, foregroundColor) => {
    expect(colorContrastRatio(backgroundColor, foregroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(RestaurantProfileInputSchema.safeParse({ ...base, theme, backgroundColor, foregroundColor }).success).toBe(true);
  });

  it("rejects low contrast and pickup without a confirmed label", () => {
    expect(RestaurantProfileInputSchema.safeParse({
      ...base,
      theme: "MANGAL_DARK",
      backgroundColor: "#111111",
      foregroundColor: "#222222",
      pickupEnabled: true,
    }).success).toBe(false);
  });
});
