import type { PublicCatalogResponse } from "@mangal/contracts";

export async function fetchCatalog(): Promise<PublicCatalogResponse> {
  const baseUrl = process.env.PLATFORM_API_URL ?? process.env.NEXT_PUBLIC_PLATFORM_API_URL;
  if (!baseUrl) throw new Error("PLATFORM_API_URL is required to render the catalog");
  const response = await fetch(`${baseUrl}/api/public/catalog`, {
    next: { revalidate: 60, tags: ["catalog"] },
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Catalog API returned ${response.status}`);
  return (await response.json()) as PublicCatalogResponse;
}
