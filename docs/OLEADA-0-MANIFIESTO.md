# OLEADA 0 — Manifiesto de Arquitectura (RESTAURANTE-OS)

> Entregable del Planificador / Arquitecto Hexagonal. Sin implementación.
> La oleada se da por completa cuando Agy lleva a verde los tests de la sección 4.

## 0. Decisiones de tooling (dentro del stack ya fijado)

- Monorepo: **Turborepo + pnpm workspaces** (Nx descartado: encaja peor con Next.js y añade peso innecesario en esta fase).
- Node 20 LTS, TypeScript 5 en modo `strict` en todos los paquetes, con `tsconfig.base.json` compartido en raíz.
- Tests: Jest 29 + ts-jest + Supertest (servicios HTTP) + @testing-library/react (ui-components).
- Convención de nombres de paquetes: apps `@apps/*`, servicios `@services/*`, librerías `@packages/*`.

## 1. Estructura exacta del monorepo

```
Resto/
├── package.json                    # privado, scripts orquestados por turbo
├── pnpm-workspace.yaml             # apps/*, services/*, packages/*
├── turbo.json                      # pipelines: build, test, lint, dev
├── tsconfig.base.json
├── .env.example
├── .gitignore
├── docker-compose.yml              # postgres + redis + gateway
├── docker-compose.dev.yml          # overrides de desarrollo (hot-reload)
├── docs/
│   └── OLEADA-0-MANIFIESTO.md
├── infra/
│   ├── postgres/
│   │   └── init/00-create-databases.sql   # resto_identity, resto_catalog, resto_ordering
│   └── redis/
│       └── redis.conf
├── apps/
│   ├── client-pwa/                 # @apps/client-pwa        (Next.js, puerto 3000)
│   │   ├── package.json
│   │   ├── next.config.mjs
│   │   ├── tsconfig.json
│   │   ├── public/manifest.webmanifest
│   │   └── src/{app,components,lib}/
│   └── admin-dashboard/            # @apps/admin-dashboard   (Next.js, puerto 3001)
│       └── (misma forma que client-pwa)
├── services/
│   ├── gateway/                    # @services/gateway  Express + http-proxy-middleware (4000)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── jest.config.ts
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── index.ts            # bootstrap
│   │   │   ├── app.ts              # express app (testeable sin listen)
│   │   │   ├── config/
│   │   │   ├── routes/             # tabla de enrutado declarativa
│   │   │   ├── middleware/         # auth JWT, errores, CORS
│   │   │   └── proxy/              # adaptadores http/ws
│   │   └── test/
│   ├── identity/                   # @services/identity Express + Postgres (4001) → DB resto_identity
│   ├── catalog/                    # @services/catalog  Apollo GraphQL + Postgres (4002) → DB resto_catalog
│   ├── session/                    # @services/session  Express + Redis (4003) → redis db0
│   └── ordering/                   # @services/ordering Socket.io + Postgres + Redis (4004) → DB resto_ordering, redis db1
│       # Cada servicio sigue hexagonal:
│       # src/{domain, application, infrastructure, interfaces} + test/ + Dockerfile
└── packages/
    ├── shared-types/               # @packages/shared-types: DTOs y contratos compartidos, sin deps de runtime
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/index.ts
    └── ui-components/              # @packages/ui-components: React; FeatureGuard + Proximamente (ver §3)
        ├── package.json
        ├── tsconfig.json
        ├── jest.config.ts
        └── src/
            ├── feature-guard/
            └── index.ts
```

### Mapa de puertos y datos

| Recurso | Puerto | Notas |
|---|---|---|
| gateway | 4000 | único punto de entrada público |
| identity | 4001 | Postgres `resto_identity` |
| catalog | 4002 | Postgres `resto_catalog` |
| session | 4003 | Redis db0 |
| ordering | 4004 | Postgres `resto_ordering` + Redis db1 (pub/sub) |
| client-pwa | 3000 | |
| admin-dashboard | 3001 | |
| postgres | 5432 | init script crea las 3 bases |
| redis | 6379 | |

`docker-compose.yml` de esta oleada levanta **postgres, redis y gateway** con healthchecks en postgres/redis; los 4 servicios de dominio quedan detrás de un profile `services` con Dockerfiles stub mínimos.

## 2. Contratos de rutas del API Gateway

Base pública: `http://localhost:4000`. Todo el API versionado bajo `/v1`.

**Autenticación:** JWT Bearer. El gateway verifica la firma (en oleada 0, `JWT_SECRET` compartido vía env; en oleada posterior, JWKS expuesto por identity). En rutas protegidas inyecta al upstream las cabeceras `x-user-id`, `x-tenant-id` (multi-restaurante) y `x-user-role`. Rutas marcadas como públicas no exigen token.

**Contrato de error (todas las rutas):**
```json
{ "error": { "code": "STRING_CODE", "message": "texto legible" } }
```
401 sin token o token inválido · 403 rol insuficiente · 404 ruta desconocida · 502 upstream caído.

**CORS:** orígenes permitidos = `CORS_ORIGINS` (por defecto `http://localhost:3000,http://localhost:3001`).

| Método + ruta pública | Auth | Servicio destino | Path upstream |
|---|---|---|---|
| POST `/v1/auth/register` | pública | identity:4001 | `/auth/register` |
| POST `/v1/auth/login` | pública | identity:4001 | `/auth/login` |
| POST `/v1/auth/refresh` | pública | identity:4001 | `/auth/refresh` |
| POST `/v1/auth/logout` | token | identity:4001 | `/auth/logout` |
| GET `/v1/identity/me` | token | identity:4001 | `/identity/me` |
| GET/PATCH `/v1/identity/users/:id` | token + rol `admin` | identity:4001 | `/identity/users/:id` |
| ANY `/v1/graphql` | token | catalog:4002 | `/graphql` |
| POST `/v1/sessions` | token | session:4003 | `/sessions` |
| GET `/v1/sessions` | token | session:4003 | `/sessions` (query: `tableId`, `status`) |
| GET `/v1/sessions/:id` | token | session:4003 | `/sessions/:id` |
| PATCH `/v1/sessions/:id/close` | token | session:4003 | `/sessions/:id/close` |
| POST `/v1/orders` | token | ordering:4004 | `/orders` |
| GET `/v1/orders` | token | ordering:4004 | `/orders` (query: `sessionId`, `status`) |
| GET `/v1/orders/:id` | token | ordering:4004 | `/orders/:id` |
| PATCH `/v1/orders/:id/status` | token + rol `staff`/`admin` | ordering:4004 | `/orders/:id/status` |
| WS `/socket.io/` (namespace `/orders`) | token en handshake `auth.token` | ordering:4004 | upgrade directo |
| GET `/health` | pública | gateway | agregado: gateway + 4 servicios + postgres + redis |

Reglas de enrutado:
- El prefijo `/v1/<segmento>` se elimina al reenviar (ver columna "Path upstream").
- La tabla de rutas vive en `services/gateway/src/routes/` como dato declarativo (no lógica dispersa en middlewares).
- WebSocket: el gateway hace upgrade solo para el path `/socket.io/` y valida el token del handshake antes de reenviar.

## 3. FeatureGuard — puertos y adaptadores (`@packages/ui-components`)

Ubicación: `packages/ui-components/src/feature-guard/`.

```
feature-guard/
├── ports/
│   └── FeatureFlagProvider.ts      # PUERTO (interfaz)
├── adapters/
│   ├── StaticFeatureFlagProvider.ts
│   └── EnvFeatureFlagProvider.ts
├── featureFlags.ts                 # modelo de dominio de flags
├── FeatureFlagContext.tsx          # inyección del puerto vía React context
├── FeatureGuard.tsx                # componente guardián (consume el puerto)
├── Proximamente.tsx                # placeholder presentacional
└── index.ts                        # exports públicos del paquete
```

### 3.1 Puerto

```ts
// ports/FeatureFlagProvider.ts — contrato
export interface FeatureFlagProvider {
  isEnabled(flag: FeatureFlagKey): boolean;
  getAll(): FeatureFlags;
}
```

El componente `FeatureGuard` depende **solo del puerto**, nunca de `process.env` ni de una fuente concreta. Los adaptadores se enchufan en el punto de composición (layout raíz de cada app).

### 3.2 featureFlags.ts — modelo de dominio

```ts
export const FEATURE_FLAG_KEYS = [
  'online-ordering',
  'table-qr',
  'kitchen-display',
  'payments',
  'analytics',
  'multi-language',
] as const;
export type FeatureFlagKey = typeof FEATURE_FLAG_KEYS[number];
export type FeatureFlags = Readonly<Record<FeatureFlagKey, boolean>>;

// Valores por defecto (fail-closed: lo no lanzado, apagado)
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  'online-ordering': true,
  'table-qr': true,
  'kitchen-display': false,
  'payments': false,
  'analytics': false,
  'multi-language': false,
};

// Parsea "payments:true,analytics:false"; claves desconocidas se ignoran; valores inválidos → false; nunca lanza.
export function parseFeatureFlags(raw: string | undefined): FeatureFlags;
```

### 3.3 Adaptadores (esta oleada)

- **`StaticFeatureFlagProvider`** — recibe `Partial<FeatureFlags>`, hace merge sobre `DEFAULT_FEATURE_FLAGS`. Usado en tests y como fallback por defecto.
- **`EnvFeatureFlagProvider`** — lee `NEXT_PUBLIC_FEATURE_FLAGS` (build-time en frontends) con `parseFeatureFlags`.
- Oleada futura (el puerto ya lo admite sin tocar consumidores): `RemoteFeatureFlagProvider` (config remota / panel admin).

### 3.4 Inyección (punto de composición)

`FeatureFlagContext.tsx` expone:
- `FeatureFlagContext` (React context cuyo value es un `FeatureFlagProvider`).
- `<FeatureFlagProviderRoot provider={...}>` que monta cada app en su layout raíz.
- Si un árbol renderiza `FeatureGuard` **sin** provider, se usa `new StaticFeatureFlagProvider()` (defaults, fail-closed). Nunca se lanza excepción en render.

### 3.5 Props del guardián

```tsx
export interface FeatureGuardProps {
  flag: FeatureFlagKey;        // clave tipada: clave desconocida = error de compilación
  children: React.ReactNode;   // contenido protegido
  fallback?: React.ReactNode;  // default: <Proximamente />
}
```

Comportamiento: `provider.isEnabled(flag)` → `children`; en caso contrario → `fallback`. En runtime, cualquier clave no reconocida se evalúa como `false` (fail-closed).

### 3.6 Contrato del placeholder `Proximamente`

```tsx
export interface ProximamenteProps {
  featureName?: string;  // nombre legible de la funcionalidad bloqueada
  eta?: string;          // fecha estimada opcional
}
```

- Renderiza un contenedor con `role="status"`, `aria-live="polite"` y `data-testid="proximamente"`.
- Texto por defecto: **"Próximamente"**; si hay `featureName`/`eta`, los muestra.
- Puramente presentacional, sin lógica de flags; estilado con tokens del design system compartido.

## 4. Casos de prueba exactos (definición de "oleada completa")

Agy escribe primero estos tests en **rojo** y los lleva a **verde**. Nada más cuenta como entrega.

### A. `@packages/ui-components` — Jest + @testing-library/react

**parseFeatureFlags**
1. `parseFeatureFlags(undefined)` devuelve `DEFAULT_FEATURE_FLAGS`.
2. `parseFeatureFlags("payments:true,analytics:true")` activa solo esas dos sobre los defaults.
3. `parseFeatureFlags("online-ordering:false")` desactiva una flag que está ON por defecto.
4. `parseFeatureFlags("unknown-flag:true")` ignora la clave desconocida y no lanza.
5. `parseFeatureFlags("payments:si")` (valor inválido) se trata como `false` y no lanza.

**Providers**
6. `new StaticFeatureFlagProvider({ payments: true }).isEnabled('payments') === true`; `getAll()` devuelve el merge con defaults.
7. `new StaticFeatureFlagProvider().isEnabled(<cualquier flag default-off>) === false` (fail-closed).
8. `EnvFeatureFlagProvider` con `NEXT_PUBLIC_FEATURE_FLAGS` seteada refleja el parse.

**FeatureGuard**
9. Flag ON (provider stub) → renderiza `children`.
10. Flag OFF → renderiza `<Proximamente />` por defecto (visible `data-testid="proximamente"`).
11. Flag OFF + `fallback` custom → renderiza el fallback y NO `Proximamente`.
12. Sin `FeatureFlagProviderRoot` en el árbol y flag default-off → renderiza fallback (fail-closed, sin throw).

**Proximamente**
13. Renderiza con `role="status"` y el texto "Próximamente".
14. Con `featureName="Pagos"` muestra el nombre de la funcionalidad.

### B. `@services/gateway` — Jest + Supertest (upstreams mockeados con nock)

**Health y enrutado**
15. `GET /health` → 200 con `{ status: 'ok' }` y entradas por servicio.
16. `POST /v1/auth/login` → proxy a `identity:4001/auth/login`, conservando body y propagando status/body del upstream.
17. `POST /v1/graphql` → proxy a `catalog:4002/graphql`.
18. `GET /v1/sessions/abc` → proxy a `session:4003/sessions/abc`.
19. `POST /v1/orders` → proxy a `ordering:4004/orders`.

**Auth**
20. Ruta protegida sin cabecera `Authorization` → 401 `{ error.code: 'UNAUTHORIZED' }`.
21. Ruta protegida con JWT inválido o expirado → 401.
22. Ruta protegida con JWT válido → el upstream recibe `x-user-id` y `x-tenant-id` correctos.
23. `PATCH /v1/orders/:id/status` con JWT de rol `customer` → 403.
24. `POST /v1/auth/login` no exige token (ruta pública).

**Errores**
25. Ruta desconocida `/v1/nope` → 404 `{ error.code: 'NOT_FOUND' }`.
26. Upstream caído → 502 `{ error.code: 'UPSTREAM_UNAVAILABLE' }`.

**WebSocket**
27. `socket.io-client` conecta al namespace `/orders` a través del gateway contra un stub de ordering (test de integración).

### C. Smoke de infraestructura (checks de cierre de oleada)

28. `docker compose config` válido; servicios `postgres`, `redis` y `gateway` definidos con healthchecks.
29. `infra/postgres/init/00-create-databases.sql` crea `resto_identity`, `resto_catalog` y `resto_ordering`.
30. `pnpm build` compila `shared-types` y `ui-components`; `pnpm test` ejecuta los suites A y B en verde.

**Criterio de cierre:** tests 1–27 en verde, checks 28–30 verificados, y `GET http://localhost:4000/health` respondiendo contra el compose levantado.
