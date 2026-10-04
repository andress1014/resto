# OLEADA 2 — Manifiesto Técnico: Sesiones y Experiencia de Cliente

> Entregable del Planificador. Arquitectura, contratos e interfaces únicamente.
> PROHIBIDO implementar: AGY inicia Fase Roja con los tests de la sección 5.
> Estado previo: Oleada 0 (30/30) + Oleada 1 (74/74) en verde. No se rompe nada de eso.

## 0. Decisiones y reconciliación con oleadas previas

- **Guest mode sin cuenta**: el cliente no se registra. Al abrir sesión de mesa, Session Service emite un **guest JWT** (`role: "guest"`, claims `tenantId` + `sessionId`, firma HS256 con el mismo `JWT_SECRET`, exp = TTL de sesión). El PWA lo usa como Bearer: el gateway lo verifica igual que cualquier token e inyecta `x-tenant-id`. **Catalog Service no se toca**: sus queries ya filtran por `x-tenant-id`, el guest token le basta.
- **Cambio en el gateway (2 cosas y nada más)**: (a) nuevas filas de rutas de §2.2; (b) el middleware de auth inyecta además `x-session-id` cuando el JWT porta el claim `sessionId`. Los 104 tests previos deben seguir verdes.
- **`POST /v1/sessions` (tabla de Oleada 0) queda sustituida por `POST /v1/sessions/open` (pública)**: nunca se implementó, no hay regresión posible. El cierre conserva el verbo de Oleada 0: `PATCH /v1/sessions/:id/close`.
- **El QR contiene `tenantId` y `tableId` planos** (no slug): Session Service no conoce slugs y así se evita dependencia síncrona con Identity. La seguridad del enlace la da el `qrKey` rotativo por mesa.
- **Apertura idempotente**: una mesa tiene UNA sesión activa; abrir con sesión viva devuelve la existente (y renueva TTL), nunca duplica.
- **Carrito/pedidos quedan FUERA de esta oleada** (Ordering Service, Oleada 3). El PWA de esta oleada es consulta de carta + selección de modificadores en memoria.

## 1. Modelo de datos en Redis (Session Service, :4003, redis db0)

TTL de sesión: `SESSION_TTL_SECONDS` (default **14400** = 4h), **sliding**: se renueva en cada lectura/escritura (`touch`).

| Clave | Tipo | TTL | Contenido |
|---|---|---|---|
| `table:{tenantId}:{tableId}` | HASH | no | `tableId, tenantId, label, status(active\|inactive), qrKey, createdAt` |
| `tenant:{tenantId}:tables` | SET | no | índice de `tableId` del tenant |
| `session:{sessionId}` | HASH | sliding 4h | `sessionId, tenantId, tableId, status(active\|closed), createdAt(ISO), expiresAt(ISO), closedAt?(ISO)` |
| `tenant:{tenantId}:table:{tableId}:session` | STRING | = sesión | puntero: `sessionId` activo de la mesa (UNO por mesa) |
| `tenant:{tenantId}:sessions` | SET | no | índice de `sessionId` activas del tenant |

Ciclo de vida:
- **Open**: leer puntero de mesa → si hay sesión activa, `touch` (renovar TTL de hash + puntero) y devolverla. Si no, crear HASH de sesión, SET del puntero con mismo TTL, `SADD` al índice.
- **Close**: `HSET status=closed, closedAt`; `DEL` puntero de mesa; `SREM` del índice. El HASH cerrado permanece hasta su TTL (historial corto) pero ya no es "activa".
- **Limpieza perezosa**: las lecturas del índice verifican la existencia del HASH; entradas expiradas se descartan (y se pueden `SREM` al vuelo).
- `qrKey`: aleatorio por mesa, se valida en `open`, se rota con `qr/rotate` (el anterior queda inválido al instante). **Nunca aparece en DTOs públicos ni en logs.**

## 2. Contratos API

### 2.1 Session Service (REST, upstream :4003)

| Método + path upstream | Quien | Contrato |
|---|---|---|
| POST `/tables` | staff (`admin`/`manager`) | `{ label }` → `201 TableDTO` (genera `tableId` uuid + `qrKey`) |
| GET `/tables` | staff | → `TableDTO[]` del tenant |
| PATCH `/tables/:tableId` | staff (`admin`/`manager`) | `{ label?, status? }` → `TableDTO` |
| GET `/tables/:tableId/qr` | staff | → `200 QrCodeResult { url, pngDataUrl }` — url = `${PWA_BASE_URL}/t/{tenantId}/{tableId}?k={qrKey}` |
| POST `/tables/:tableId/qr/rotate` | staff (`admin`/`manager`) | → `200 QrCodeResult` con nuevo `qrKey` (el anterior muere) |
| POST `/sessions/open` | **pública** | `OpenSessionRequest { tenantId, tableId, qrKey }` → `200 OpenSessionResult { session, guestToken }` (idempotente por mesa) |
| GET `/sessions/:id` | staff del tenant o guest con `x-session-id` coincidente | → `200 TableSessionDTO` |
| GET `/sessions?status=&tableId=` | staff | → `TableSessionDTO[]` |
| PATCH `/sessions/:id/close` | staff | → `200 TableSessionDTO` (idempotente: cerrar dos veces devuelve la cerrada) |
| GET `/health` | interna | `{ status: 'ok' }` |

Errores: contrato `{ error: { code, message } }` de siempre. Códigos: `VALIDATION_ERROR`, `QR_KEY_INVALID`, `TABLE_NOT_FOUND`, `TABLE_INACTIVE`, `SESSION_NOT_FOUND`, `SESSION_EXPIRED`, `FORBIDDEN`. Autorización: staff exige cabeceras `x-tenant-id` + `x-user-role` ∈ {staff, manager, admin}; guest exige `x-session-id` == `:id` del path.

Guest JWT: `{ sub: "guest:{sessionId}", tenantId, role: "guest", sessionId, iat, exp }`, HS256, `exp = now + SESSION_TTL_SECONDS`.

### 2.2 API Gateway — filas NUEVAS (el resto de la tabla de Oleada 0/1 intacta)

| Método + ruta pública | Auth | Destino | Path upstream |
|---|---|---|---|
| POST `/v1/sessions/open` | **pública** | session:4003 | `/sessions/open` |
| POST `/v1/tables` | token + `admin`/`manager` | session:4003 | `/tables` |
| GET `/v1/tables` | token staff | session:4003 | `/tables` |
| PATCH `/v1/tables/:tableId` | token + `admin`/`manager` | session:4003 | `/tables/:tableId` |
| GET `/v1/tables/:tableId/qr` | token staff | session:4003 | `/tables/:tableId/qr` |
| POST `/v1/tables/:tableId/qr/rotate` | token + `admin`/`manager` | session:4003 | `/tables/:tableId/qr/rotate` |
| GET `/v1/sessions` | token staff | session:4003 | `/sessions` |
| GET `/v1/sessions/:id` | token staff **o guest** | session:4003 | `/sessions/:id` |
| PATCH `/v1/sessions/:id/close` | token staff | session:4003 | `/sessions/:id/close` |

- Sustitución: `POST /v1/sessions` (Oleada 0) desaparece de la tabla; lo reemplaza `/v1/sessions/open`.
- Middleware de auth del gateway: si el JWT trae claim `sessionId`, inyecta `x-session-id` al upstream.
- Rol `guest` queda permitido en `/v1/graphql` (solo lectura de carta) y en `GET /v1/sessions/:id`; bloqueado en todo lo demás por la regla de roles existente.

## 3. Puertos y adaptadores — `@packages/shared-types` (módulo nuevo `session/`)

```
packages/shared-types/src/session/
├── dtos.ts
└── ports.ts
```

```ts
// dtos.ts
export interface TableDTO { tableId: string; tenantId: string; label: string; status: 'active' | 'inactive'; createdAt: string; }
export interface TableSessionDTO {
  sessionId: string; tenantId: string; tableId: string;
  status: 'active' | 'closed';
  createdAt: string; expiresAt: string; closedAt?: string;
}
export interface GuestTokenClaims { tenantId: string; sessionId: string; role: 'guest'; }
export interface OpenSessionRequest { tenantId: string; tableId: string; qrKey: string; }
export interface OpenSessionResult { session: TableSessionDTO; guestToken: string; }
export interface QrCodeResult { url: string; pngDataUrl: string; }   // data:image/png;base64,...

// ports.ts — tenantId SIEMPRE primer parámetro (regla congelada)
export interface TableRepository {
  save(tenantId: string, table: TableDTO & { qrKey: string }): Promise<TableDTO>;
  findById(tenantId: string, tableId: string): Promise<(TableDTO & { qrKey: string }) | null>;
  listByTenant(tenantId: string): Promise<TableDTO[]>;
}
export interface TableSessionRepository {
  findActiveByTable(tenantId: string, tableId: string): Promise<TableSessionDTO | null>;
  findById(tenantId: string, sessionId: string): Promise<TableSessionDTO | null>;
  save(tenantId: string, session: TableSessionDTO, ttlSeconds: number): Promise<TableSessionDTO>;
  close(tenantId: string, sessionId: string, closedAt: Date): Promise<TableSessionDTO>;
  listByTenant(tenantId: string, filter?: { status?: 'active' | 'closed'; tableId?: string }): Promise<TableSessionDTO[]>;
  touch(tenantId: string, sessionId: string, ttlSeconds: number): Promise<void>;
}
export interface QrCodeGenerator { generate(payloadUrl: string): Promise<QrCodeResult>; }
export interface GuestTokenIssuer { issue(claims: GuestTokenClaims, ttlSeconds: number): string; }

// Casos de uso (firmas)
export type CreateTableUseCase       = UseCase<{ tenantId: string; label: string }, TableDTO>;
export type GenerateTableQrUseCase   = UseCase<{ tenantId: string; tableId: string }, QrCodeResult>;
export type RotateTableQrKeyUseCase  = UseCase<{ tenantId: string; tableId: string }, QrCodeResult>;
export type OpenTableSessionUseCase  = UseCase<OpenSessionRequest, OpenSessionResult>;
export type GetTableSessionUseCase   = UseCase<{ tenantId: string; sessionId: string; requester: { role: string; sessionId?: string } }, TableSessionDTO>;
export type CloseTableSessionUseCase = UseCase<{ tenantId: string; sessionId: string }, TableSessionDTO>;
export type ListTableSessionsUseCase = UseCase<{ tenantId: string; filter?: { status?: 'active' | 'closed'; tableId?: string } }, TableSessionDTO[]>;
```

Adaptadores que implementará AGY en `services/session/src/infrastructure/`: `RedisTableRepository`, `RedisTableSessionRepository` (ambos sobre `ioredis`, db0), `QrcodeGeneratorAdapter` (lib `qrcode`), `JwtGuestTokenIssuer` (mismo `JWT_SECRET` del sistema). Estructura hexagonal idéntica a identity: `domain/ application/ infrastructure/ interfaces/http/`.

## 4. Client PWA — Bento Box mobile-first (`@apps/client-pwa`)

> Planificado con skill **ui-ux-pro-max**: paleta restaurant del dataset (rojo apetitoso + dorado, fondo cálido) y tipografía culinary (Playfair Display SC + Karla), fusionadas con la estructura Bento de la regla de bóveda. El estilo "Vibrant & Block-based" crudo se descarta por violar la regla (efectos decorativos, gaps de 48px+). MASTER corregido en `design-system/restaurante-os-client-pwa/MASTER.md`.

### 4.1 Adaptación de tokens (misma hoja `--bento-*`, valores de marca cliente)

```
--bento-page-bg:        #FEF2F2   /* cálido apetitoso */
--bento-card-bg:        #FFFFFF
--bento-card-radius:    24px   (inner 16px — SIN cambios estructurales)
--bento-grid-gap:       16px
--bento-card-shadow:    0 4px 6px rgba(0,0,0,0.05)
--bento-text:           #450A0A   /* alto contraste sobre card */
--bento-text-muted:     #475569   /* ≥4.5:1 */
--bento-accent:         #A16207   /* dorado; SOLO datos clave (precio) ≥3:1 large */
--bento-accent-strong:  #DC2626   /* CTA primario con texto blanco ≥4.5:1 */
--bento-success:        #15803D
--bento-destructive:    #DC2626
--bento-touch-target:   44px      /* estándar de producto; supera el mínimo WCAG 24px */
--bento-touch-gap:      8px       /* separación mínima entre touchables */
--bento-safe-bottom:    env(safe-area-inset-bottom)
```

Tipografía: heading **Playfair Display SC**, body **Karla**. Grid: **1 columna → 2 (≥640px)** (mobile-first real; nada de 4 columnas aquí). Los primitivos `BentoGrid/BentoCard/KpiValue` de `@packages/ui-components` se reutilizan sin tocar su API; el PWA solo inyecta su hoja de tokens.

### 4.2 Rutas y flujo

```
/t/[tenantId]/[tableId]/page.tsx        # landing QR: lee ?k=, POST /v1/sessions/open,
                                        #   guarda { guestToken, session } (sessionStorage), redirect a ./menu
/t/[tenantId]/[tableId]/menu/page.tsx   # carta del tenant
```

Flujo: escaneo QR → landing → `open` → menú. Errores de `open` (`QR_KEY_INVALID`, `TABLE_INACTIVE`) → BentoCard de error con `role="alert"`, sin redirect.

### 4.3 Componentes (`apps/client-pwa/src/components/`)

- `GuestSessionGuard`: sin sesión válida en storage → vista "Escanea el QR de tu mesa" (BentoCard, sin contenido de carta).
- `TableSessionBadge`: label de mesa + estado de sesión (texto + color).
- `CategoryChipRail`: chips horizontales con scroll-snap, sticky bajo el header, respeta safe-area; chip activo con texto + subrayado (no solo color).
- `ProductListCard` (BentoCard): imagen (`alt` obligatorio), nombre, **precio como `KpiValue tone="accent"`**, badge "No disponible" (texto + color) cuando `isAvailable=false`.
- `ProductDetailSheet`: bottom sheet `role="dialog" aria-modal="true"`, gestión de foco al abrir/cerrar, cierre por botón y por gesto swipe-down (sin conflicto con scroll del sistema).
- `ModifierGroupPicker`: renderiza grupo con `minSelections–maxSelections`, opciones con `priceDelta` (KpiValue neutral), indicador de obligatorio; bloquea exceder `maxSelections`.
- CTAs con FeatureGuard: "Pedir" envuelto en `<FeatureGuard flag="online-ordering">` (ON por defecto pero sin función real aún — Oleada 3); "Pagar" en `<FeatureGuard flag="payments">` → `Proximamente`.

### 4.4 Pautas móviles obligatorias (del dataset del skill)

- Todo touchable ≥ `--bento-touch-target` (44px) y separación ≥ `--bento-touch-gap` (8px).
- Contenido nunca bajo barras del sistema: padding con safe-area insets.
- Scroll vertical natural; swipe horizontal SOLO en el rail de categorías (sin gestos de pantalla completa que rompan back/scroll).
- Verificado a 375px; `prefers-reduced-motion` desactiva transiciones del sheet.

## 5. Casos de prueba exactos (Fase Roja de AGY)

### A. Session — unitarios de casos de uso (repos/adaptadores fake en memoria)

1. `OpenTableSession` crea sesión con `tenantId/tableId/status=active/createdAt/expiresAt`, y `expiresAt = createdAt + TTL`.
2. `OpenTableSession` con sesión activa existente en la mesa → devuelve la existente y NO crea otra (idempotente).
3. `OpenTableSession` con `qrKey` incorrecto → `QR_KEY_INVALID`.
4. `OpenTableSession` sobre mesa inexistente → `TABLE_NOT_FOUND`; sobre mesa `inactive` → `TABLE_INACTIVE`.
5. `CloseTableSession` → `status=closed` + `closedAt`; una nueva apertura posterior crea sesión NUEVA.
6. `CloseTableSession` sobre sesión ya cerrada → idempotente, devuelve la cerrada sin error.
7. `GetTableSession` de otro tenant → `SESSION_NOT_FOUND` (aislamiento); guest con `sessionId` distinto → `FORBIDDEN`.
8. `GuestTokenIssuer.issue` produce claims `{ role: 'guest', tenantId, sessionId }` y `exp = now + ttlSeconds`.
9. `GenerateTableQr` devuelve `url` con formato `/t/{tenantId}/{tableId}?k=...` y `pngDataUrl` con prefijo `data:image/png;base64,`.
10. `RotateTableQrKey` → el `qrKey` anterior deja de abrir (`QR_KEY_INVALID`) y el nuevo abre.

### B. Session — integración (Supertest + Redis de test)

11. `POST /sessions/open` persiste el HASH `session:{id}` con TODOS los campos y TTL ≈ `SESSION_TTL_SECONDS`.
12. El puntero `tenant:{t}:table:{tb}:session` apunta a la sesión activa; tras `PATCH /sessions/:id/close` el puntero ya no existe.
13. `GET /sessions/:id` con `x-tenant-id` correcto → 200; con otro tenant → 404; guest con `x-session-id` distinto → 403.
14. Rutas de staff (`/tables`, `/sessions`) sin `x-user-role` staff/manager/admin → 403; `/sessions/open` no exige cabeceras de staff.
15. Expiración real: con TTL de test corto (1s), pasado el TTL la sesión devuelve `SESSION_NOT_FOUND`/`SESSION_EXPIRED` y la mesa queda libre para reabrir.

### C. Client PWA — Testing Library + MSW (gateway mockeado)

16. Landing `/t/:tenantId/:tableId?k=valid` → llama `POST /v1/sessions/open` y redirige a `./menu`; guarda guest token.
17. `open` rechazado (`QR_KEY_INVALID`/`TABLE_INACTIVE`) → BentoCard de error con `role="alert"`, sin redirect.
18. `GuestSessionGuard`: acceder a `./menu` sin sesión → vista "Escanea el QR de tu mesa", cero datos de carta.
19. `menu` lista categorías (stub MSW GraphQL) como chips y productos como `data-component="bento-card"` dentro de `data-component="bento-grid"`.
20. Producto con `isAvailable=false` muestra badge con texto "No disponible" (no solo color).
21. Tocar `ProductListCard` abre `ProductDetailSheet` con `role="dialog"` y `aria-modal="true"`, mostrando los `modifierGroups` del producto con opciones y `priceDelta`.
22. `ModifierGroupPicker` bloquea seleccionar más de `maxSelections` opciones y señala los grupos obligatorios.
23. La llamada GraphQL del menú adjunta `Authorization: Bearer <guestToken>` (assert sobre el handler MSW).
24. Estructura Bento: cards y chips referencian `var(--bento-*)` (sin hex/px hardcodeados) y el único `data-tone="accent"` por tarjeta es el `KpiValue` del precio.
25. Móvil: todo touchable referencia el token `--bento-touch-target` (44px) y la hoja de tokens del PWA define safe-area y grid 1→2 columnas.
26. Cero decoración y a11y: iconos SVG con `aria-hidden="true"`, imágenes de producto con `alt`, sin emojis como iconos; el sheet mueve el foco al abrir y lo devuelve al cerrar.
27. FeatureGuard: CTA "Pagar" con flag `payments` apagado → muestra `Proximamente` (`data-testid="proximamente"`) sin romper el layout.

### D. Cierre de oleada (smoke)

28. Gateway: las filas nuevas de §2.2 activas; los 104 tests de Oleadas 0+1 siguen en verde (sin regresión).
29. E2E por gateway: staff crea mesa → obtiene QR → guest abre sesión con la URL del QR → `query categories` vía `/v1/graphql` con guest token devuelve la carta del tenant correcto (y NO la de otro tenant).
30. `pnpm test` verde en session y client-pwa; `pnpm build` compila shared-types con el módulo `session/`.

**Criterio de cierre**: tests 1–27 escritos primero en rojo y llevados a verde; checks 28–30 verificados; 104 tests previos intactos.
