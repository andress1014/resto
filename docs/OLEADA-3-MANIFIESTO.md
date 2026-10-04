# OLEADA 3 — Manifiesto Técnico: Motor Transaccional

> Entregable del Planificador. Arquitectura, contratos e interfaces únicamente.
> PROHIBIDO implementar: AGY inicia Fase Roja con los tests de la sección 6.
> Estado previo: Oleadas 0+1+2 = 134/134 en verde. No se rompe nada de eso.
> EXCLUIDO (Oleada 4): sockets en tiempo real, KDS, llamado a mesero. Esta oleada: REST + polling.

## 0. Decisiones y reconciliación con oleadas previas

- **El carrito vive bajo la TableSession de Oleada 2**: se identifica con el `sessionId` del guest JWT. NO existe ningún concepto de sesión paralelo ni carrito por guest individual: el carrito es DE LA MESA (colaborativo).
- **Validez de sesión = validez del guest JWT**: Ordering NO lee el Redis db0 de Session Service (frontera de servicio inviolable). El gateway ya verifica firma y expiración del token; eso basta en esta oleada.
- **Atribución colaborativa**: cada línea lleva `addedBy` opcional (etiqueta legible que envía el cliente, p. ej. nombre o id de dispositivo). No requiere cambios en el guest JWT.
- **Catálogo se referencia por id** (`productId`, `modifierGroupId`, `modifierOptionId`). La línea de carrito guarda un snapshot DE DISPLAY (nombre/precio/deltas que envía el cliente) solo para pintar; **la confirmación lo ignora y recalcula TODO contra Catalog** (precio, existencia, disponibilidad, reglas de modificadores). El cliente nunca es autoridad de precios.
- **Validación contra Catalog**: Ordering llama al GraphQL de Catalog por red interna (`CATALOG_INTERNAL_URL`, p. ej. `http://catalog:4002/graphql`) inyectando `x-tenant-id` como servicio confiado. Catalog no se modifica.
- **Gateway**: filas nuevas de §3.2. Reconciliación con Oleada 0: `POST /v1/orders` queda sustituida por `POST /v1/cart/confirm` (nunca se implementó); `PATCH /v1/orders/:id/status` se pospone a Oleada 4 (KDS) y sale de la tabla por ahora.
- **Dinero**: DTOs con números (coherente con GraphQL de Oleada 1); persistencia `Decimal(10,2)`. Totales SIEMPRE recalculados en servidor.

## 1. Modelo de datos del carrito en Redis (Ordering, :4004, redis db1)

Una sola clave por sesión de mesa. TTL: `CART_TTL_SECONDS` (default 14400, alineado con la sesión), **sliding**: se renueva en cada mutación/lectura del carrito.

| Clave | Tipo | TTL | Contenido |
|---|---|---|---|
| `cart:{tenantId}:{sessionId}` | HASH | sliding 4h | field = `cartItemId` (uuid), value = JSON de la línea |

JSON de línea de carrito:
```
{ cartItemId, productId, productName, unitPrice,          // snapshot de display (no autoridad)
  modifiers: [{ groupId, groupName, optionId, optionName, priceDelta }],
  quantity, notes?, addedBy?, addedAt (ISO) }
```

Reglas:
- **Merge**: `POST /cart/items` con mismo `productId` + MISMO conjunto de modificadores → incrementa `quantity` de la línea existente (no duplica).
- **Atomicidad**: add/update/remove/confirm se ejecutan como operación atómica sobre el HASH (`WATCH/MULTI` o script Lua) — varios guests editan el mismo carrito a la vez; prohibido read-modify-write sin control de concurrencia.
- **Confirmación**: leer todas las líneas → validar contra Catalog → persistir Order (transacción Postgres) → `DEL cart:{tenantId}:{sessionId}`. Si la persistencia falla, el carrito NO se borra.
- **Limpieza**: sin índices auxiliares; el HASH muere por TTL si la mesa abandona sin confirmar.

## 2. Schema Prisma — `services/ordering/prisma/schema.prisma` → DB `resto_ordering`

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("ORDERING_DATABASE_URL") }

enum OrderStatus { PLACED CANCELLED }

model Order {
  id          String      @id @default(uuid())
  tenantId    String      // referencia LÓGICA a identity — sin FK
  sessionId   String      // referencia LÓGICA a session service — sin FK
  tableId     String      // desnormalizado de la sesión (consulta staff)
  status      OrderStatus @default(PLACED)
  total       Decimal     @db.Decimal(10, 2)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  cancelledAt DateTime?
  items       OrderItem[]
  @@index([tenantId, sessionId])
  @@index([tenantId, status])
}

model OrderItem {
  id          String              @id @default(uuid())
  orderId     String
  order       Order               @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId   String              // referencia LÓGICA a catalog — sin FK
  productName String              // snapshot al confirmar
  unitPrice   Decimal             @db.Decimal(10, 2)   // snapshot al confirmar (autoridad: catalog)
  quantity    Int
  notes       String?
  modifiers   OrderItemModifier[]
  @@index([orderId])
}

model OrderItemModifier {
  id          String    @id @default(uuid())
  orderItemId String
  orderItem   OrderItem @relation(fields: [orderItemId], references: [id], onDelete: Cascade)
  groupId     String    // referencia lógica a catalog — sin FK
  groupName   String    // snapshot
  optionId    String    // referencia lógica — sin FK
  optionName  String    // snapshot
  priceDelta  Decimal   @default(0) @db.Decimal(10, 2)
  @@index([orderItemId])
}
```

**Desacoplamiento físico**: los únicos campos que aluden a otros servicios son `String` planos. Un check de cierre (28) verifica cero imports cruzados de Prisma clients y cero lectura del redis db0 de session.

## 3. Contratos API

### 3.1 Ordering Service (REST, upstream :4004)

Guest = cabeceras `x-tenant-id` + `x-session-id` (guest JWT). Staff = `x-tenant-id` + rol ∈ {staff, manager, admin}.

| Método + path upstream | Quien | Contrato |
|---|---|---|
| GET `/cart` | guest | → `200 CartDTO` (carrito de SU sesión; vacío si no existe) |
| POST `/cart/items` | guest | `{ productId, modifiers: [{ groupId, optionId }], quantity, notes?, addedBy?, display: { productName, unitPrice, modifierNames } }` → `201 CartDTO` (merge aplicado) |
| PATCH `/cart/items/:cartItemId` | guest | `{ quantity }` → `200 CartDTO` (`quantity: 0` elimina la línea) |
| DELETE `/cart/items/:cartItemId` | guest | → `200 CartDTO` |
| POST `/cart/confirm` | guest | → `201 OrderDTO` (valida contra Catalog, persiste, limpia carrito) |
| GET `/orders?sessionId=` | guest (solo su sesión) / staff | guest: `sessionId` debe ser la suya → `OrderDTO[]` |
| GET `/orders?status=&tableId=` | staff | → `OrderDTO[]` del tenant |
| GET `/orders/:id` | staff / guest | guest solo si la order pertenece a su sesión → `OrderDTO` |
| PATCH `/orders/:id/cancel` | staff (`admin`/`manager`) | → `200 OrderDTO` con `status=CANCELLED`, `cancelledAt` |
| GET `/health` | interna | `{ status: 'ok' }` |

Errores: contrato `{ error: { code, message } }`. Códigos: `VALIDATION_ERROR`, `SESSION_REQUIRED` (falta `x-session-id` en rutas guest), `CART_EMPTY`, `PRODUCT_NOT_FOUND`, `PRODUCT_UNAVAILABLE`, `MODIFIER_REQUIRED`, `MODIFIER_INVALID`, `ORDER_NOT_FOUND`, `FORBIDDEN`, `CATALOG_UNREACHABLE` (fallo de red interna al validar → 502).

### 3.2 API Gateway — filas NUEVAS / cambios

| Método + ruta pública | Auth | Destino | Path upstream |
|---|---|---|---|
| GET `/v1/cart` | guest | ordering:4004 | `/cart` |
| POST `/v1/cart/items` | guest | ordering:4004 | `/cart/items` |
| PATCH `/v1/cart/items/:cartItemId` | guest | ordering:4004 | `/cart/items/:cartItemId` |
| DELETE `/v1/cart/items/:cartItemId` | guest | ordering:4004 | `/cart/items/:cartItemId` |
| POST `/v1/cart/confirm` | guest | ordering:4004 | `/cart/confirm` |
| GET `/v1/orders` | guest o staff | ordering:4004 | `/orders` |
| GET `/v1/orders/:id` | guest o staff | ordering:4004 | `/orders/:id` |
| PATCH `/v1/orders/:id/cancel` | token `admin`/`manager` | ordering:4004 | `/orders/:id/cancel` |

- Sustituciones sobre Oleada 0: `POST /v1/orders` desaparece (reemplazada por `/v1/cart/confirm`); `PATCH /v1/orders/:id/status` sale de la tabla hasta Oleada 4. Nunca se implementaron: cero regresión.
- Rol `guest` permitido en `/v1/cart*` y en `/v1/orders` (GET); el gateway sigue inyectando `x-session-id` (Oleada 2).

## 4. Puertos y adaptadores — `@packages/shared-types` (módulo nuevo `ordering/`)

```
packages/shared-types/src/ordering/
├── dtos.ts
└── ports.ts
```

```ts
// dtos.ts
export interface CartModifierInput { groupId: string; optionId: string; }
export interface CartItemModifierDTO { groupId: string; groupName: string; optionId: string; optionName: string; priceDelta: number; }
export interface CartItemDTO {
  cartItemId: string; productId: string; productName: string; unitPrice: number;
  modifiers: CartItemModifierDTO[]; quantity: number; notes?: string; addedBy?: string;
  addedAt: string; lineTotal: number;   // lineTotal de display; el real se recalcula al confirmar
}
export interface CartDTO { tenantId: string; sessionId: string; items: CartItemDTO[]; total: number; }
export interface OrderModifierDTO { groupId: string; groupName: string; optionId: string; optionName: string; priceDelta: number; }
export interface OrderItemDTO { id: string; productId: string; productName: string; unitPrice: number; quantity: number; notes?: string; modifiers: OrderModifierDTO[]; }
export interface OrderDTO {
  id: string; tenantId: string; sessionId: string; tableId: string;
  status: 'PLACED' | 'CANCELLED'; total: number; items: OrderItemDTO[];
  createdAt: string; cancelledAt?: string;
}

// ports.ts — tenantId SIEMPRE primer parámetro
export interface CartRepository {
  get(tenantId: string, sessionId: string, ttlSeconds: number): Promise<CartDTO>;
  upsertItem(tenantId: string, sessionId: string, item: CartItemDTO, ttlSeconds: number): Promise<CartDTO>;
  setQuantity(tenantId: string, sessionId: string, cartItemId: string, quantity: number, ttlSeconds: number): Promise<CartDTO>;
  removeItem(tenantId: string, sessionId: string, cartItemId: string, ttlSeconds: number): Promise<CartDTO>;
  clear(tenantId: string, sessionId: string): Promise<void>;
}
export interface OrderRepository {
  save(tenantId: string, order: OrderDTO): Promise<OrderDTO>;      // transacción: order + items + modifiers
  findById(tenantId: string, id: string): Promise<OrderDTO | null>;
  listByTenant(tenantId: string, filter?: { status?: 'PLACED' | 'CANCELLED'; tableId?: string }): Promise<OrderDTO[]>;
  listBySession(tenantId: string, sessionId: string): Promise<OrderDTO[]>;
  cancel(tenantId: string, id: string, cancelledAt: Date): Promise<OrderDTO>;
}
// Vista de validación del catálogo (puerto anticorrupción — Ordering NO conoce GraphQL)
export interface ValidatedModifierOption { optionId: string; name: string; priceDelta: number; }
export interface ValidatedModifierGroup { groupId: string; name: string; minSelections: number; maxSelections: number; isRequired: boolean; options: ValidatedModifierOption[]; }
export interface ValidatedProduct { productId: string; name: string; price: number; isAvailable: boolean; modifierGroups: ValidatedModifierGroup[]; }
export interface CatalogValidationPort {
  getOrderableProducts(tenantId: string, productIds: string[]): Promise<ValidatedProduct[]>;
}

// Casos de uso (firmas)
export type GetCartUseCase        = UseCase<{ tenantId: string; sessionId: string }, CartDTO>;
export type AddCartItemUseCase    = UseCase<{ tenantId: string; sessionId: string; productId: string; modifiers: CartModifierInput[]; quantity: number; notes?: string; addedBy?: string; display: { productName: string; unitPrice: number; modifierNames: { groupName: string; optionName: string; priceDelta: number }[] } }, CartDTO>;
export type UpdateCartItemQuantityUseCase = UseCase<{ tenantId: string; sessionId: string; cartItemId: string; quantity: number }, CartDTO>;
export type RemoveCartItemUseCase = UseCase<{ tenantId: string; sessionId: string; cartItemId: string }, CartDTO>;
export type ConfirmOrderUseCase   = UseCase<{ tenantId: string; sessionId: string; tableId: string }, OrderDTO>;
export type ListSessionOrdersUseCase = UseCase<{ tenantId: string; sessionId: string }, OrderDTO[]>;
export type ListTenantOrdersUseCase  = UseCase<{ tenantId: string; filter?: { status?: 'PLACED' | 'CANCELLED'; tableId?: string } }, OrderDTO[]>;
export type GetOrderUseCase       = UseCase<{ tenantId: string; orderId: string; requester: { role: string; sessionId?: string } }, OrderDTO>;
export type CancelOrderUseCase    = UseCase<{ tenantId: string; orderId: string }, OrderDTO>;
```

Adaptadores que implementará AGY en `services/ordering/src/infrastructure/`: `RedisCartRepository` (ioredis db1, operaciones atómicas), `PrismaOrderRepository` (transacción `$transaction` en `save`), `GraphqlCatalogValidationAdapter` (único lugar que habla GraphQL; traduce a `ValidatedProduct`). Estructura hexagonal igual que los demás servicios.

## 5. Client PWA — componentes del carrito (Bento Box mobile-first)

> Planificado con skill **ui-ux-pro-max** (dataset UX): estados async sin saltos de layout (slot estable para contador/badge), errores con `role="alert"`, `aria-busy` en cargas, `overscroll-behavior: contain` (polling SIN pull-to-refresh), `inputmode` adecuado. Override de página en `design-system/restaurante-os-client-pwa/pages/cart.md`.

### 5.1 Flujo y polling

- El menú (`/t/[tenantId]/[tableId]/menu`) monta el contexto de carrito: `GET /v1/cart` inicial + **polling cada `CART_POLL_INTERVAL_MS` (default 5000)** mientras la vista está visible; se pausa con pestaña oculta. Nada de pull-to-refresh (`overscroll-behavior: contain`).
- Añadir: desde `ProductDetailSheet` (Oleada 2) — selección de modificadores + cantidad + CTA "Añadir" → `POST /v1/cart/items` → refresco inmediato del carrito (sin esperar al siguiente poll).

### 5.2 Componentes (`apps/client-pwa/src/components/cart/`)

- `CartFab`: botón flotante sobre `--bento-safe-bottom`; contador de unidades (Σ quantity) en slot de tamaño fijo (cero saltos de layout); fondo `--bento-accent-strong`, touch target 44px, `aria-label` con el conteo.
- `CartSheet`: bottom sheet (`role="dialog" aria-modal`, foco gestionado, hereda pautas de `ProductDetailSheet`).
- `CartLineItem` (BentoCard): nombre, resumen de modificadores (texto, una línea), `lineTotal` como `KpiValue tone="accent"`, `QuantityStepper`, `AddedByBadge`.
- `QuantityStepper`: botones − / + (44px, `aria-label` "Reducir cantidad de {nombre}" / "Aumentar cantidad de {nombre}"); − en 1 → elimina la línea (confirmación inline, no modal).
- `AddedByBadge`: chip con la etiqueta de quién añadió la línea (conciencia colaborativa); texto, no solo color.
- `CartSummaryBar`: barra inferior del sheet con total como `KpiValue tone="accent"` y CTA primario **"Enviar pedido"** (`--bento-accent-strong`); `aria-busy` durante el confirm; deshabilitado con carrito vacío (estado disabled claro).
- `CartEmptyState`: BentoCard "Tu mesa aún no ha pedido nada" — cero decoración.
- `OrderConfirmationCard`: tras confirmar, id corto + estado `PLACED` (texto + color) + nota "El personal ha recibido tu pedido".
- FeatureGuard: toda la zona de carrito (`CartFab` + `CartSheet`) envuelta en `<FeatureGuard flag="online-ordering">` (ON por defecto); OFF → `Proximamente`.

### 5.3 Pautas obligatorias del skill para este módulo

- Contador del `CartFab` y totales en slots de ancho/alto reservado (content jumping = bloqueante).
- Errores de confirmación con `role="alert"` dentro del sheet; foco movido al contenedor del error.
- Cargas con `aria-busy` y skeleton estable; nada de spinners que parpadean en polls rápidos (el polling es SILENCIOSO: no muestra loader salvo carga inicial).
- Touch targets ≥44px, separación ≥8px, safe-area en `CartFab` y `CartSummaryBar`.

## 6. Casos de prueba exactos (Fase Roja de AGY)

### A. Ordering — unitarios de casos de uso (repos/puertos fake en memoria)

1. `AddCartItem` agrega línea nueva al carrito de la sesión.
2. `AddCartItem` con mismo `productId` + mismos modificadores → incrementa `quantity` (merge), NO duplica línea.
3. `UpdateCartItemQuantity` con `quantity > 0` actualiza; con `quantity = 0` elimina la línea.
4. `RemoveCartItem` elimina solo esa línea; las demás quedan intactas.
5. `ConfirmOrder` con carrito vacío → `CART_EMPTY`.
6. `ConfirmOrder` con `productId` inexistente en catálogo → `PRODUCT_NOT_FOUND` y NO persiste nada.
7. `ConfirmOrder` con producto `isAvailable=false` → `PRODUCT_UNAVAILABLE`.
8. `ConfirmOrder` con grupo obligatorio sin selección → `MODIFIER_REQUIRED`; con más opciones de `maxSelections` → `MODIFIER_INVALID`.
9. `ConfirmOrder` recalcula precios desde el puerto de catálogo: un `unitPrice` de display manipulado en el carrito NO afecta al total; `total = Σ (precioCatálogo + Σ priceDelta) × quantity`.
10. `ConfirmOrder` persiste la Order con snapshots (nombre/precio/modificadores del momento de confirmar) y limpia el carrito: un `GetCart` posterior devuelve vacío.
11. `ConfirmOrder` es atómico: si `OrderRepository.save` falla, el carrito NO se limpia.
12. `GetOrder` como guest de otra sesión → `FORBIDDEN`; `ListSessionOrders` devuelve solo las orders de esa sesión.

### B. Ordering — integración (Supertest + Redis test + Postgres test; Catalog mockeado con nock en el puerto GraphQL)

13. `POST /cart/items` persiste la línea en el HASH `cart:{tenantId}:{sessionId}` con TTL configurado.
14. Dos guests de la MISMA sesión (dos tokens distintos, mismo `sessionId`): lo que añade uno lo ve el otro en `GET /cart`.
15. `POST /cart/confirm` → filas `Order`/`OrderItem`/`OrderItemModifier` persistidas en Postgres y clave del carrito eliminada en Redis.
16. Rutas `/cart*` sin `x-session-id` → 401 `SESSION_REQUIRED`; `GET /orders` con rol staff → 200; guest leyendo `/orders/:id` de otra sesión → 403.
17. Errores con contrato `{ error: { code, message } }`; caída del catálogo mockeado (nock sin respuesta) → 502 `CATALOG_UNREACHABLE`.

### C. Client PWA — Testing Library + MSW

18. "Añadir" en `ProductDetailSheet` llama `POST /v1/cart/items` con `productId`, modificadores seleccionados y `quantity`; el contador del `CartFab` refleja las unidades.
19. `CartFab` muestra Σ quantity en slot estable y referencia tokens (`--bento-accent-strong`, safe-bottom, touch target 44px).
20. `CartSheet` lista líneas con nombre, resumen de modificadores, `lineTotal` como `KpiValue tone="accent"` y `AddedByBadge` cuando la línea la añadió otro guest.
21. Polling: con timers mockeados, `GET /v1/cart` se repite al intervalo configurado y una línea "nueva de otro guest" (cambio en la respuesta MSW) aparece sin interacción del usuario; el polling no muestra loader (silencioso).
22. `QuantityStepper`: "+" llama `PATCH` con `quantity+1`; "−" en 1 elimina la línea; ambos botones tienen nombre accesible y touch target ≥44px.
23. "Enviar pedido" llama `POST /v1/cart/confirm` y muestra `OrderConfirmationCard` con estado `PLACED`; el carrito queda vacío y el CTA pasa a disabled.
24. Confirmación rechazada (`PRODUCT_UNAVAILABLE`) → mensaje con `role="alert"` dentro del sheet y carrito intacto.
25. Estructura Bento/a11y: sin hex/px hardcodeados (solo `var(--bento-*)`), acento solo en `KpiValue`, sheet con `role="dialog" aria-modal`, iconos `aria-hidden`, cero emojis, foco gestionado al abrir/cerrar el sheet.
26. FeatureGuard: con flag `online-ordering` apagado, la zona de carrito muestra `Proximamente` (`data-testid="proximamente"`).

### D. Cierre de oleada (smoke)

27. Gateway: filas de §3.2 activas; los 134 tests de Oleadas 0–2 siguen en verde.
28. Check de desacoplamiento: ordering no importa Prisma clients de identity/catalog, no lee el redis db0 de session; sus campos foráneos son `String` planos (lint o test de imports).
29. E2E por gateway: dos guests abren sesión en la misma mesa → ambos añaden items → uno confirma → staff ve la Order vía `GET /v1/orders` con items, modificadores y total correctos (recalculados por servidor); carrito vacío tras confirmar.
30. `pnpm test` verde en ordering y client-pwa; `pnpm build` compila shared-types con el módulo `ordering/`.

**Criterio de cierre**: tests 1–26 escritos primero en rojo y llevados a verde; checks 27–30 verificados; 134 tests previos intactos. Total esperado: **164/164**.
