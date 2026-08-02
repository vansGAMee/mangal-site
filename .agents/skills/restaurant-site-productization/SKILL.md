---
name: restaurant-site-productization
description: Turn one hard-coded food-ordering site into a reusable one-restaurant-per-deployment product. Use when extracting brand, theme, contacts, delivery, SEO, legal links, media, hours, and menu data into configuration without building a multitenant SaaS.
---

# Restaurant Site Productization

1. Preserve the rule: one restaurant, one database, one deployment.
2. Make a singleton restaurant profile the canonical source for brand, slug, copy, contacts, address, social links, theme, currency, timezone, SEO, legal links, fulfillment settings, and media.
3. Keep themes configuration-driven through validated CSS variables. Do not copy storefront components per theme.
4. Make storefront metadata, JSON-LD, catalog, footer, checkout, admin, manifest, and Open Graph consume the same profile.
5. Provide admin editing with strict schemas, optimistic locking, audit events, and safe media replacement.
6. Treat unknown legal, fiscal, delivery, and pricing data as blocking—not as demo defaults.
7. Provide `create-client` and menu import flows that refuse overwrites without an explicit flag.
8. Verify a second client configuration without editing React components.

Do not add tenant IDs or shared cross-client databases unless the user explicitly changes the deployment model.
