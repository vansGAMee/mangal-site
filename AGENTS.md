# Инструкции для Codex в этом репозитории

Проект создаёт отдельное развёртывание для одного небольшого заведения общепита. Не превращать его в мультитенантный SaaS и не переписывать существующую витрину, корзину, checkout или админку без доказанной необходимости.

## Repository-scoped skills

- [existing-project-audit](.agents/skills/existing-project-audit/SKILL.md) — первоначальный read-only аудит.
- [safe-refactor-existing-app](.agents/skills/safe-refactor-existing-app/SKILL.md) — минимальные проверяемые изменения.
- [restaurant-site-productization](.agents/skills/restaurant-site-productization/SKILL.md) — конфигурация одного заведения.
- [database-migrations-and-seeding](.agents/skills/database-migrations-and-seeding/SKILL.md) — миграции, seed и импорт.
- [vercel-demo-deployment](.agents/skills/vercel-demo-deployment/SKILL.md) — безопасная Vercel-демонстрация.
- [russian-vps-deployment](.agents/skills/russian-vps-deployment/SKILL.md) — production на российском VPS.
- [browser-sales-research](.agents/skills/browser-sales-research/SKILL.md) — исследование лидов без контакта.
- [vk-outreach-human-review](.agents/skills/vk-outreach-human-review/SKILL.md) — поштучные VK-сообщения с подтверждением.
- [browser-qa-and-handoff](.agents/skills/browser-qa-and-handoff/SKILL.md) — браузерная проверка и handoff.

## Обязательные правила

- Перед изменениями проверять Git, локальные инструкции и актуальность remote.
- Не выводить и не коммитить секреты, cookies, базы или персональные данные.
- Не выполнять seed, reset, payment smoke или destructive readiness против неизвестной БД.
- Не выдумывать реквизиты, цены, delivery/fiscal/legal параметры.
- Для Vercel demo не сохранять введённые ПД и не вызывать реальные платежи.
- Для настоящих заказов использовать российский platform/VPS-контур и отдельную юридическую проверку.
- Не отправлять сообщения лидам без подтверждения конкретного текста и получателя.
- После крупных этапов запускать lint, typecheck, tests, schema validation и build; фиксировать реальные результаты.
