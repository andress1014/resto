# System Design — Mapa de microservicios

Estado: borrador inicial (Oleada 0 en curso). Se actualiza al cierre de cada oleada.

## Servicios

| Servicio | Stack | Datos | Responsabilidad |
|---|---|---|---|
| Identity Service | Node.js + Express | PostgreSQL (`identity_db`) | Multi-tenant SaaS, empleados, auth |
| Catalog Service | Node.js + GraphQL (Apollo) | PostgreSQL (`catalog_db`) | Menús, categorías, productos, modificadores |
| Session Service | Node.js + Express | Redis | Códigos QR, sesiones activas de mesa |
| Ordering & Fulfillment | Node.js + Socket.io | PostgreSQL (`ordering_db`) + Redis Pub/Sub | Carritos colaborativos, estados KDS, llamados a meseros |
| API Gateway | — | — | Punto único de entrada, enrutamiento a servicios |

## Frontends

| App | Stack | Audiencia |
|---|---|---|
| `@apps/client-pwa` | Next.js/React | Cliente en mesa (escanea QR) |
| `@apps/admin-dashboard` | Next.js/React | Panel del restaurante |

## Paquetes compartidos

- `@packages/shared-types` — interfaces TypeScript compartidas entre servicios y frontends
- `@packages/ui-components` — componentes UI reutilizables (incluye `<FeatureGuard>`)

## Comunicación entre servicios

- **Síncrona (HTTP/GraphQL):** consultas que no mutan estado cross-dominio.
- **Asíncrona (Redis Streams/Pub-Sub):** mutaciones que afectan múltiples dominios (ver eventos en `02_Dominio/Diccionario.md`).

## Estado de implementación (Oleada 0 — cerrada)

- **Monorepo:** Turborepo + pnpm workspaces (Nx descartado), Node 20 LTS, TS strict.
- **API Gateway:** enrutamiento declarativo (`src/routes/`), auth JWT con inyección de `x-user-id`/`x-tenant-id`/`x-user-role`, proxy HTTP y WebSocket (`ns /orders`), manejo uniforme de errores 401/403/404/502.
- **`@packages/ui-components`:** `<FeatureGuard>` + `featureFlags.ts` con providers `Static`/`Env`, fail-closed por defecto, placeholder `<Proximamente>`.
- **Infraestructura:** `docker-compose.yml` (postgres, redis, gateway con healthchecks), SQL de init crea `resto_identity`, `resto_catalog`, `resto_ordering`.
- **Tests:** 30/30 en verde (ver `03_Oleadas/Estado_MVP.md`).

Servicios de dominio (`identity`, `catalog`, `session`, `ordering`) quedan como stubs/Dockerfile placeholder — su implementación real corresponde a Oleadas 1-3.
