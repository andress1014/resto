# RESTAURANTE-OS

SaaS B2B2C de microservicios para restaurantes y bares: el cliente escanea un QR en la mesa, ve el menú, pide y colabora en un carrito compartido con el resto de la mesa; el restaurante gestiona catálogo, cocina (KDS) y cierre de cuenta desde un panel de administración en tiempo real.

Construido con **TDD estricto** (ciclo Red-Green-Refactor) y desarrollado en **oleadas** incrementales, cada una cerrada solo cuando el 100% de sus tests está en verde sin regresión sobre las anteriores.

## Estado actual

| Oleada | Alcance | Estado | Tests |
|---|---|---|---|
| 0 | Monorepo, Docker Compose, API Gateway, `<FeatureGuard>` | ✅ Completada | 30/30 |
| 1 | Identity & Catalog Services + Admin Dashboard | ✅ Completada | 74/74 |
| 2 | Session Service + PWA cliente (QR → menú) | ✅ Completada | 104/104 |
| 3 | Ordering Service + carrito colaborativo | ✅ Completada | 134/134 |
| 4 | Socket.io + KDS + llamados a meseros | ✅ Completada | 160/160 |
| 5 | Cierre de visita y pagos | 🔄 En curso | 0/22 (objetivo 182/182) |

Detalle completo del progreso en [`03_Oleadas/Estado_MVP.md`](03_Oleadas/Estado_MVP.md).

## Arquitectura

Microservicios independientes, cada uno con **arquitectura hexagonal** interna (puertos y adaptadores), en un monorepo (Turborepo + pnpm workspaces).

| Servicio | Stack | Datos | Responsabilidad |
|---|---|---|---|
| **Identity** (`:4001`) | Node.js, Express | PostgreSQL (`resto_identity`) | Multi-tenant SaaS, autenticación, empleados |
| **Catalog** (`:4002`) | Node.js, GraphQL (Apollo) | PostgreSQL (`resto_catalog`) | Menús, categorías, productos, modificadores |
| **Session** (`:4003`) | Node.js, Express | Redis | Códigos QR, sesiones activas de mesa |
| **Ordering & Fulfillment** (`:4004`) | Node.js, Socket.io | PostgreSQL (`resto_ordering`) + Redis Pub/Sub | Carrito colaborativo, estados de pedido, KDS, llamados a mesero, cierre de cuenta |
| **API Gateway** (`:4000`) | Node.js, Express | — | Único punto de entrada: enrutamiento declarativo, auth JWT, proxy HTTP/WebSocket |

**Frontends:**

| App | Stack | Audiencia |
|---|---|---|
| `@apps/client-pwa` | Next.js/React | Cliente en la mesa (escanea QR) |
| `@apps/admin-dashboard` | Next.js/React | Panel del restaurante (incluye sección `/kds`) |

**Paquetes compartidos:**

- `@packages/shared-types` — interfaces TypeScript y puertos (hexagonales) compartidos entre servicios y frontends.
- `@packages/ui-components` — componentes UI reutilizables, incluido `<FeatureGuard>`.

### Comunicación entre servicios

- **Síncrona (HTTP/GraphQL):** consultas que no mutan estado cross-dominio.
- **Asíncrona (Redis Streams/Pub-Sub):** mutaciones que afectan múltiples dominios (ej. un pedido que impacta Catalog, Ordering y Session).

### Decisiones de arquitectura clave

Registradas como ADRs en [`01_Arquitectura/ADR.md`](01_Arquitectura/ADR.md):

- **Microservicios sobre monolito**, cada uno hexagonal, en monorepo.
- **TDD estricto con circuit breaker**: máximo 3 intentos fallidos por test antes de escalar.
- **Multi-tenancy por `tenantId` inyectado desde el JWT**, nunca desde el input del cliente — el gateway lo extrae del token y lo propaga como header `x-tenant-id`; cualquier `tenantId` en el body se ignora.
- **Prisma por servicio sin acoplamiento físico**: cada microservicio tiene su propio esquema y cliente generado; las referencias cruzadas (ej. `tenantId` en Catalog) son columnas planas, sin FK entre bases de datos de distintos servicios.
- **Bento Box** como sistema de diseño de ambos frontends (tarjetas de border-radius alto, tokens centralizados en CSS custom properties `--bento-*`, prohibido hardcodear valores en componentes). Ver [`01_Arquitectura/UI_UX_Guidelines.md`](01_Arquitectura/UI_UX_Guidelines.md).
- **Feature flags obligatorios**: toda funcionalidad fuera de la oleada en curso se envuelve en `<FeatureGuard>`, mostrando un placeholder "Próximamente" si el flag está desactivado — nunca UI rota o a medias.

Mapa de servicios y estado de implementación detallado en [`01_Arquitectura/System_Design.md`](01_Arquitectura/System_Design.md).

## Contratos de API

Documentados en [`02_Dominio/Diccionario.md`](02_Dominio/Diccionario.md). Resumen de rutas públicas vía Gateway (`http://localhost:4000/v1`):

| Ruta | Auth | Destino |
|---|---|---|
| `POST /v1/auth/{register,login,refresh,logout}` | pública / token | Identity |
| `GET/PATCH /v1/identity/*` | token | Identity |
| `ANY /v1/graphql` | token | Catalog |
| `POST/GET /v1/sessions*` | token | Session |
| `POST/GET /v1/orders*`, `PATCH /v1/orders/:id/status` | token | Ordering |
| `WS /socket.io` (namespace `/orders`) | token en handshake | Ordering |
| `GET /health` | pública | Agregado de los 7 servicios/dependencias |

Errores en formato uniforme: `{ "error": { "code", "message" } }`.

## Estructura del repositorio

```
.
├── apps/
│   ├── client-pwa/          # PWA del cliente (Next.js)
│   └── admin-dashboard/     # Panel del restaurante (Next.js)
├── services/
│   ├── gateway/             # API Gateway
│   ├── identity/            # Identity Service
│   ├── catalog/             # Catalog Service (GraphQL)
│   ├── session/             # Session Service
│   └── ordering/            # Ordering & Fulfillment Service
├── packages/
│   ├── shared-types/        # Tipos e interfaces compartidas
│   └── ui-components/       # Componentes UI + <FeatureGuard>
├── infra/                   # Scripts de init de Postgres/Redis
├── 01_Arquitectura/         # ADRs, system design, guías UI/UX
├── 02_Dominio/              # Diccionario de contratos API/eventos
├── 03_Oleadas/              # Tracking de progreso por oleada
├── docs/                    # Manifiestos técnicos y planes de ejecución por oleada
├── docker-compose.yml
└── turbo.json
```

## Desarrollo local

Requisitos: Node.js 20, pnpm 9, Docker Desktop.

```bash
# Instalar dependencias de todo el monorepo
pnpm install

# Levantar infraestructura base (Postgres, Redis, Gateway)
docker compose up -d --build

# Levantar también los microservicios de dominio (Identity, Catalog, Session, Ordering)
docker compose --profile services up -d --build

# Verificar
curl http://localhost:4000/health
```

Scripts del workspace:

```bash
pnpm build          # build de los paquetes compartidos
pnpm test           # tests de todo el monorepo
pnpm test:gateway   # tests solo del gateway
pnpm test:ui        # tests solo de ui-components
pnpm lint           # lint de todo el monorepo
```

## Metodología de trabajo

El proyecto se desarrolla en **oleadas** incrementales (ver roadmap completo en `CLAUDE.md`), cada una siguiendo el ciclo:

```
Planificación Roja → Ejecución Roja (tests en rojo) → Planificación Verde → Ejecución Verde (código + tests en verde) → Cierre/Documentación → siguiente oleada
```

Reglas fijas:

- Ninguna oleada avanza sin que la anterior tenga el 100% de sus tests en verde.
- Prohibido escribir lógica de negocio o infraestructura sin un test en rojo primero.
- Prohibido acoplar dominios entre microservicios.
- La documentación (`01_Arquitectura/`, `02_Dominio/`, `03_Oleadas/`) se actualiza al cierre de cada oleada; si no refleja el código, la oleada no se considera cerrada.

Manifiestos técnicos y planes de ejecución de cada oleada están en [`docs/`](docs/).
