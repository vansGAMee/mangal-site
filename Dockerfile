# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS dependencies
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/platform/package.json apps/platform/package.json
COPY apps/storefront/package.json apps/storefront/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/catalog-seed/package.json packages/catalog-seed/package.json
COPY packages/design-system/package.json packages/design-system/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json

RUN npm ci --no-audit --no-fund

FROM dependencies AS build
WORKDIR /app

COPY . .

RUN npx prisma generate
RUN npm run build:platform

# Удаляем тяжёлые тестовые и dev-зависимости.
# Prisma и tsx оставляем для миграций и создания администратора.
RUN npm prune --omit=dev --no-audit --no-fund \
 && npm install --no-save --omit=dev --no-audit --no-fund prisma@7.9.1 tsx@4.20.5 \
 && rm -rf /root/.npm \
 && rm -rf /app/apps/platform/.next/cache \
 && rm -rf /app/apps/storefront/.next

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=8080 APP_ROLE=web
WORKDIR /app

RUN groupadd --system --gid 1001 mangal \
 && useradd --system --uid 1001 --gid mangal mangal

COPY --from=build --chown=mangal:mangal /app/package.json /app/package.json
COPY --from=build --chown=mangal:mangal /app/package-lock.json /app/package-lock.json
COPY --from=build --chown=mangal:mangal /app/node_modules /app/node_modules
COPY --from=build --chown=mangal:mangal /app/apps/platform /app/apps/platform
COPY --from=build --chown=mangal:mangal /app/apps/storefront/package.json /app/apps/storefront/package.json
COPY --from=build --chown=mangal:mangal /app/packages /app/packages
COPY --from=build --chown=mangal:mangal /app/generated /app/generated
COPY --from=build --chown=mangal:mangal /app/prisma /app/prisma
COPY --from=build --chown=mangal:mangal /app/prisma.config.ts /app/prisma.config.ts
COPY --from=build --chown=mangal:mangal /app/scripts /app/scripts
COPY --from=build --chown=mangal:mangal /app/clients /app/clients
COPY --from=build --chown=mangal:mangal /app/docs/legal /app/docs/legal
COPY --from=build --chown=mangal:mangal /app/docker /app/docker
COPY --from=build --chown=mangal:mangal /app/tsconfig.json /app/tsconfig.json

RUN mkdir -p /app/uploads && chown -R mangal:mangal /app/uploads

USER mangal
EXPOSE 8080
ENTRYPOINT ["node", "docker/entrypoint.mjs"]
