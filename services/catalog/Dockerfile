FROM node:20-alpine AS base
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
RUN npm install -g pnpm@9

FROM base AS dev
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/catalog/ ./services/catalog/
RUN pnpm install
WORKDIR /app/services/catalog
CMD ["pnpm", "dev"]

FROM base AS build
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/catalog/ ./services/catalog/
RUN pnpm install
RUN pnpm --filter @packages/* run build
RUN pnpm --filter @services/catalog exec prisma generate
RUN pnpm --filter @services/catalog run build

FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app/packages/ /app/packages/
COPY --from=build /app/services/catalog/dist /app/services/catalog/dist
COPY --from=build /app/services/catalog/prisma /app/services/catalog/prisma
COPY --from=build /app/services/catalog/src/generated /app/services/catalog/src/generated
COPY --from=build /app/services/catalog/src/generated /app/services/catalog/dist/generated
COPY --from=build /app/services/catalog/package.json /app/services/catalog/package.json
COPY --from=build /app/services/catalog/node_modules /app/services/catalog/node_modules
COPY --from=build /app/node_modules /app/node_modules
WORKDIR /app/services/catalog
EXPOSE 4002
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/index.js"]
