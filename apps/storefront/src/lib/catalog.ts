import { PublicCatalogResponseSchema, type PublicCatalogResponse } from "@mangal/contracts";

function platformApiUrl(): string {
  const value = process.env.PLATFORM_API_URL ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL;
  if (!value) {
    throw new Error("PLATFORM_API_URL is required to render the storefront catalog");
  }
  return value.replace(/\/$/, "");
}

export async function fetchCatalog(): Promise<PublicCatalogResponse> {
  const response = await fetch(`${platformApiUrl()}/api/public/catalog`, {
    next: { revalidate: 60, tags: ["catalog", "restaurant-profile"] },
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Catalog API returned ${response.status}`);
  }

  return PublicCatalogResponseSchema.parse(await response.json());
}
