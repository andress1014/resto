FROM node:20-alpine AS base
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
RUN npm install -g pnpm@9

FROM base AS dev
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/ordering/ ./services/ordering/
RUN pnpm install
WORKDIR /app/services/ordering
CMD ["pnpm", "dev"]

FROM base AS build
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/ordering/ ./services/ordering/
RUN pnpm install
RUN pnpm --filter @packages/* run build
RUN pnpm --filter @services/ordering exec prisma generate
RUN pnpm --filter @services/ordering run build

FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app/packages/ /app/packages/
COPY --from=build /app/services/ordering/dist /app/services/ordering/dist
COPY --from=build /app/services/ordering/prisma /app/services/ordering/prisma
COPY --from=build /app/services/ordering/package.json /app/services/ordering/package.json
COPY --from=build /app/services/ordering/node_modules /app/services/ordering/node_modules
COPY --from=build /app/node_modules /app/node_modules
WORKDIR /app/services/ordering
EXPOSE 4004
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/index.js"]
