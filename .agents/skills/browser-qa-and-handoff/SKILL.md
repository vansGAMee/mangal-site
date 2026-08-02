---
name: browser-qa-and-handoff
description: Verify the restaurant storefront, cart, checkout, admin, media, responsive layout, accessibility, and network behavior in a real browser. Use before demo, VPS deployment, client handoff, or any claim that a user flow works.
---

# Browser QA and Handoff

1. Start the actual target branch and record exact URLs, database mode, storage driver, and demo/production mode.
2. Test 320, 375, 768, and 1440 px plus 200% zoom and reduced motion.
3. Complete keyboard-only catalog, modifiers, cart quantity, checkout, focus trap/restore, status announcements, login, catalog edit, image replacement, order lookup, and status change.
4. Inspect console and network requests for errors, third-party calls before consent, secrets, PII, duplicate checkout, and unsafe image payloads.
5. Run Playwright and axe; capture screenshots of desktop, mobile, cart, checkout, and admin results.
6. Verify demo mode never stores submitted PII and production mode never sends PII through Vercel.
7. Record each flow as passed, failed, blocked, or not run, with evidence and exact command.
8. Write `docs/TEST_REPORT.md` and `docs/FINAL_HANDOFF.md` without claiming unverified deployment or provider behavior.

Do not use a production database or real payment credentials for destructive or synthetic QA.
