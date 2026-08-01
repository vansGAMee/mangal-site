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
COPY . .
RUN npx prisma generate
RUN npm run build:platform

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=8080 APP_ROLE=web
WORKDIR /app
RUN groupadd --system --gid 1001 mangal && useradd --system --uid 1001 --gid mangal mangal
COPY --from=build --chown=mangal:mangal /app /app
USER mangal
EXPOSE 8080
ENTRYPOINT ["node", "docker/entrypoint.mjs"]
