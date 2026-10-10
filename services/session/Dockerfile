FROM node:20-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@9

FROM base AS dev
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/session/ ./services/session/
RUN pnpm install
WORKDIR /app/services/session
CMD ["pnpm", "dev"]

FROM base AS build
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* tsconfig.base.json ./
COPY packages/ ./packages/
COPY services/session/ ./services/session/
RUN pnpm install
RUN pnpm --filter @packages/* run build
RUN pnpm --filter @services/session run build

FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app/packages/ /app/packages/
COPY --from=build /app/services/session/dist /app/services/session/dist
COPY --from=build /app/services/session/package.json /app/services/session/package.json
COPY --from=build /app/services/session/node_modules /app/services/session/node_modules
COPY --from=build /app/node_modules /app/node_modules
WORKDIR /app/services/session
EXPOSE 4003
CMD ["node", "dist/index.js"]
