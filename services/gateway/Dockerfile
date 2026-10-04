FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@9

FROM base AS dev
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/gateway/ ./services/gateway/
RUN pnpm install
WORKDIR /app/services/gateway
CMD ["pnpm", "dev"]

FROM base AS build
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/gateway/ ./services/gateway/
RUN pnpm install
RUN pnpm --filter @packages/* run build
RUN pnpm --filter @services/gateway run build

FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app/packages/ /app/packages/
COPY --from=build /app/services/gateway/dist /app/services/gateway/dist
COPY --from=build /app/services/gateway/package.json /app/services/gateway/package.json
COPY --from=build /app/services/gateway/node_modules /app/services/gateway/node_modules
COPY --from=build /app/node_modules /app/node_modules
WORKDIR /app/services/gateway
EXPOSE 4000
CMD ["node", "dist/index.js"]
