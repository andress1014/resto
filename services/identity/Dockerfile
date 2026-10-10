FROM node:20-alpine AS base
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
RUN npm install -g pnpm@9

FROM base AS dev
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/identity/ ./services/identity/
RUN pnpm install
WORKDIR /app/services/identity
CMD ["pnpm", "dev"]

FROM base AS build
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/identity/ ./services/identity/
RUN pnpm install
RUN pnpm --filter @packages/* run build
RUN pnpm --filter @services/identity exec prisma generate
RUN pnpm --filter @services/identity run build

FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app/packages/ /app/packages/
COPY --from=build /app/services/identity/dist /app/services/identity/dist
COPY --from=build /app/services/identity/prisma /app/services/identity/prisma
COPY --from=build /app/services/identity/src/generated /app/services/identity/src/generated
COPY --from=build /app/services/identity/src/generated /app/services/identity/dist/generated
COPY --from=build /app/services/identity/package.json /app/services/identity/package.json
COPY --from=build /app/services/identity/node_modules /app/services/identity/node_modules
COPY --from=build /app/node_modules /app/node_modules
WORKDIR /app/services/identity
EXPOSE 4001
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/index.js"]
