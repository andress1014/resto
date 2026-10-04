# OLEADA 4 — Manifiesto Técnico: Fulfillment y Tiempo Real

> Entregable del Planificador. Arquitectura, contratos e interfaces únicamente.
> PROHIBIDO implementar: AGY inicia Fase Roja con los tests de la sección 6.
> Estado previo: 134/134 en verde (30 Oleada 0 + 44 Oleada 1 + 30 Oleada 2 + 30 Oleada 3).

## 0. Decisiones y reconciliación

- **Topología de sockets (aclaración sobre Oleada 0)**: el servidor socket.io vive en **Ordering Service (:4004)**; el gateway hace lo que siempre hizo: upgrade + proxy del path `/socket.io/` (namespace `/orders`). Nada cambia en el proxy. Ordering verifica el JWT del handshake él mismo (mismo `JWT_SECRET`), extrae `tenantId/role/sessionId` y une al cliente a rooms:
  - staff (`staff/manager/admin`) → room `tenant:{tenantId}`
  - guest → room `session:{sessionId}` (SOLO su mesa)
- **¿Por qué Pub/Sub si publisher y socket están en el mismo servicio?**: desacopla el proceso HTTP del proceso de sockets y permite réplicas horizontales de ordering sin código extra. Redis db1 (el de ordering). El suscriptor usa **conexión dedicada** (semántica Redis: una conexión suscripta no puede ejecutar otros comandos).
- **`PATCH /v1/orders/:id/status` se implementa AHORA** (deuda de Oleada 0): con máquina de transiciones y publicación de evento.
- **Único cambio al modelo de datos**: el enum `OrderStatus` pasa a `{ PLACED, IN_KITCHEN, READY, DELIVERED, CANCELLED }`. Ningún otro campo/tabla se toca. Migración aditiva.
- **Máquina de transiciones** (dominio): `PLACED → {IN_KITCHEN, CANCELLED}` · `IN_KITCHEN → {READY, CANCELLED}` · `READY → {DELIVERED}` · `DELIVERED → {}` · `CANCELLED → {}`. Transición inválida → `INVALID_STATUS_TRANSITION` (409). `CancelOrder` (Oleada 3) pasa a validarse contra esta misma máquina.
- **Llamado a mesero = ServiceCall, independiente de Order**: estado transitorio en Redis db1 (no Postgres; es operativo y perecedero). El `tableId` lo envía el guest en el body (lo conoce de su ruta; es dato de display para el staff, no de seguridad — el guest JWT no lo porta y Ordering NO lee el Redis de session).
- **KDS = sección del Admin Dashboard (`/kds`), NO app nueva**. Justificación: el staff ya se autentica ahí con su JWT de Identity (cero auth nueva); reutiliza el design system admin (`restaurante-os-admin/MASTER.md`) y los primitivos Bento sin duplicar tokens; evita una tercera app con build/deploy propios. Una pantalla de cocina simplemente abre esa ruta. Se protege con `<FeatureGuard flag="kitchen-display">` (flag que existe desde Oleada 0, OFF por defecto: se activa vía `NEXT_PUBLIC_FEATURE_FLAGS`).
- **Clientes socket nunca emiten**: el servidor es la única autoridad; los clientes solo escuchan (esta oleada no define eventos client→server).

## 1. Modelo de eventos Redis Pub/Sub (redis db1)

| Canal | Publica | Payload JSON |
|---|---|---|
| `tenant:{tenantId}:order-events` | `ConfirmOrder`, `UpdateOrderStatus` | `{ type: 'order.created' \| 'order.status-changed', order: OrderDTO, previousStatus?: string, occurredAt: ISO }` |
| `tenant:{tenantId}:service-calls` | `CreateServiceCall`, `ResolveServiceCall` | `{ type: 'service-call.created' \| 'service-call.resolved', call: ServiceCallDTO, occurredAt: ISO }` |

Reglas:
- Los canales llevan `tenantId` embebido: el filtrado por tenant es estructural, no por payload.
- El publicador emite SOLO tras commit exitoso (Postgres) o tras escritura Redis exitosa (service call). Nunca antes.
- Payload = DTO completo (los clientes no necesitan re-fetch para pintar).
- El suscriptor del lado socket re-emite: eventos de order → rooms `tenant:{tenantId}` + `session:{order.sessionId}`; eventos de service-call → room `tenant:{tenantId}` (+ `session:{call.sessionId}` en el caso `resolved`, para que el guest vea su confirmación).

### Estado del ServiceCall en Redis (db1)

| Clave | Tipo | TTL | Contenido |
|---|---|---|---|
| `service-call:{tenantId}:{callId}` | HASH | 2h | `callId, tenantId, sessionId, tableId, note?, status(pending\|resolved), createdAt, resolvedAt?` |
| `tenant:{tenantId}:service-calls:pending` | SET | no | índice de pendientes; `SREM` al resolver; limpieza perezosa al listar |

## 2. Contratos de eventos Socket.io (namespace `/orders`)

Handshake: `auth.token` = JWT (guest o staff). Sin token válido → `connect_error`. El servidor une rooms según claims (§0). Eventos servidor→cliente:

| Evento | Llega a | Payload exacto |
|---|---|---|
| `order:created` | room `tenant:{tenantId}` + room `session:{sessionId de la order}` | `{ order: OrderDTO, occurredAt: string }` |
| `order:status-changed` | idem | `{ orderId: string, status: 'IN_KITCHEN'\|'READY'\|'DELIVERED'\|'CANCELLED', previousStatus: string, order: OrderDTO, occurredAt: string }` |
| `service-call:created` | room `tenant:{tenantId}` (staff) | `{ call: ServiceCallDTO, occurredAt: string }` |
| `service-call:resolved` | room `tenant:{tenantId}` + room `session:{sessionId de la llamada}` | `{ call: ServiceCallDTO, occurredAt: string }` |

Aislamiento garantizado por rooms: un guest NUNCA recibe eventos de otra mesa ni de otro tenant; el staff solo los de su tenant. No hay eventos client→server en esta oleada.

## 3. Contratos REST

### 3.1 Ordering Service (upstream :4004) — nuevas rutas

| Método + path upstream | Quien | Contrato |
|---|---|---|
| PATCH `/orders/:id/status` | staff (`staff/manager/admin`) | `{ status }` → `200 OrderDTO`; transición inválida → 409 `INVALID_STATUS_TRANSITION` |
| POST `/service-calls` | guest (`x-tenant-id` + `x-session-id`) | `{ tableId, note? }` → `201 ServiceCallDTO` (status `pending`) |
| GET `/service-calls?status=` | staff | → `ServiceCallDTO[]` del tenant (default: pending) |
| PATCH `/service-calls/:id/resolve` | staff | → `200 ServiceCallDTO` (idempotente: resolver dos veces devuelve la ya resuelta y NO republica evento) |

Errores añadidos al vocabulario: `INVALID_STATUS_TRANSITION`, `SERVICE_CALL_NOT_FOUND`. El resto del contrato `{ error: { code, message } }` intacto.

### 3.2 API Gateway — filas NUEVAS / cambios

| Método + ruta pública | Auth | Destino | Path upstream |
|---|---|---|---|
| PATCH `/v1/orders/:id/status` | token `staff/manager/admin` | ordering:4004 | `/orders/:id/status` |
| POST `/v1/service-calls` | guest | ordering:4004 | `/service-calls` |
| GET `/v1/service-calls` | token staff | ordering:4004 | `/service-calls` |
| PATCH `/v1/service-calls/:id/resolve` | token staff | ordering:4004 | `/service-calls/:id/resolve` |

`PATCH /v1/orders/:id/status` vuelve a la tabla (salió en Oleada 3 por no estar implementada). El proxy de `/socket.io/` no se toca.

## 4. Puertos y adaptadores — `@packages/shared-types` (extensión de `ordering/`)

```ts
// events (dtos.ts del módulo ordering)
export type OrderStatus = 'PLACED' | 'IN_KITCHEN' | 'READY' | 'DELIVERED' | 'CANCELLED';
export type OrderEventType = 'order.created' | 'order.status-changed';
export interface OrderEvent { type: OrderEventType; order: OrderDTO; previousStatus?: OrderStatus; occurredAt: string; }
export type ServiceCallStatus = 'pending' | 'resolved';
export interface ServiceCallDTO {
  callId: string; tenantId: string; sessionId: string; tableId: string;
  note?: string; status: ServiceCallStatus; createdAt: string; resolvedAt?: string;
}
export type ServiceCallEventType = 'service-call.created' | 'service-call.resolved';
export interface ServiceCallEvent { type: ServiceCallEventType; call: ServiceCallDTO; occurredAt: string; }

// ports.ts — tenantId SIEMPRE primer parámetro
export interface EventPublisher {
  publishOrderEvent(tenantId: string, event: OrderEvent): Promise<void>;
  publishServiceCallEvent(tenantId: string, event: ServiceCallEvent): Promise<void>;
}
export interface EventSubscriber {
  onOrderEvent(handler: (event: OrderEvent) => void): void;
  onServiceCallEvent(handler: (event: ServiceCallEvent) => void): void;
  start(): Promise<void>;   // conexión dedicada de suscripción
  stop(): Promise<void>;
}
export interface RealtimeEmitter {
  emitToTenant(tenantId: string, event: string, payload: unknown): void;
  emitToSession(sessionId: string, event: string, payload: unknown): void;
}
export interface ServiceCallRepository {
  save(tenantId: string, call: ServiceCallDTO, ttlSeconds: number): Promise<ServiceCallDTO>;
  findById(tenantId: string, callId: string): Promise<ServiceCallDTO | null>;
  listByTenant(tenantId: string, filter?: { status?: ServiceCallStatus }): Promise<ServiceCallDTO[]>;
  resolve(tenantId: string, callId: string, resolvedAt: Date): Promise<ServiceCallDTO>;
}
// OrderRepository (Oleada 3) se EXTIENDE con un método, sin cambiar los existentes:
//   updateStatus(tenantId: string, id: string, status: OrderStatus, updatedAt: Date): Promise<OrderDTO>;

// Casos de uso (firmas)
export type UpdateOrderStatusUseCase = UseCase<{ tenantId: string; orderId: string; status: OrderStatus }, OrderDTO>;
export type CreateServiceCallUseCase = UseCase<{ tenantId: string; sessionId: string; tableId: string; note?: string }, ServiceCallDTO>;
export type ResolveServiceCallUseCase = UseCase<{ tenantId: string; callId: string }, ServiceCallDTO>;
export type ListServiceCallsUseCase  = UseCase<{ tenantId: string; filter?: { status?: ServiceCallStatus } }, ServiceCallDTO[]>;
```

Dominio: `ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>>` exportado desde shared-types (lo usan ordering para validar y el KDS para saber qué botón mostrar).

Adaptadores que implementará AGY en `services/ordering/src/infrastructure/`: `RedisEventPublisher` + `RedisEventSubscriber` (ioredis db1, conexión dedicada para suscripción), `SocketIoRealtimeEmitter` (socket.io server en el proceso de ordering, middleware JWT, rooms), `RedisServiceCallRepository`. `PrismaOrderRepository` solo gana `updateStatus`.

## 5. KDS / Panel Operativo — sección `/kds` del Admin Dashboard (Bento Box)

> Planificado con skill **ui-ux-pro-max**: actualizaciones async anunciadas con UNA región live atómica (nunca regiones live compitiendo ni números desnudos), feedback de acción loading→success/error. Sistema de diseño: el del admin (`restaurante-os-admin/MASTER.md` — Lexend/Source Sans 3, tokens slate). Override de página: `design-system/restaurante-os-admin/pages/kds.md`.

### 5.1 Datos y tiempo real

- Carga inicial: `GET /v1/orders?status=PLACED|IN_KITCHEN|READY` + `GET /v1/service-calls?status=pending`.
- Después, SOLO socket: `lib/realtime.ts` conecta `socket.io-client` al gateway, ns `/orders`, `auth.token` = staff JWT. CERO polling.
- Los eventos actualizan el store local: `order:created` → nueva tarjeta; `order:status-changed` → mover tarjeta; `service-call:*` → panel de llamadas.

### 5.2 Componentes (`apps/admin-dashboard/src/components/kds/`)

- `KdsBoard`: grid Bento de 3 columnas por estado (`PLACED`, `IN_KITCHEN`, `READY`); `DELIVERED`/`CANCELLED` salen del board.
- `KdsColumn`: cabecera con nombre de estado + contador (texto completo: "3 órdenes", slot estable).
- `KdsOrderCard` (BentoCard): `tableId`, items con cantidad + modificadores (texto), `notes` si hay, tiempo transcurrido (`KpiValue` neutral; `tone="destructive"` si supera `KDS_ALERT_MINUTES`, default 15), y botón de avance al siguiente estado según `ORDER_STATUS_TRANSITIONS` (CTA primario; loading→success/error, `aria-busy`).
- `ServiceCallPanel`: BentoCard lateral con llamadas pendientes (mesa + nota + hora) y botón "Resolver"; las nuevas llegan por socket con anuncio accesible.
- `KdsLiveAnnouncer`: UNA única región `role="status" aria-atomic="true"` que anuncia mensajes completos ("Nueva orden de la mesa 5", "Orden de la mesa 2 lista"); prohibido un live region por tarjeta.
- Ruta `/kds` bajo guard de rol staff + `<FeatureGuard flag="kitchen-display">` (OFF → `Proximamente`).

## 6. Casos de prueba exactos (Fase Roja de AGY)

### A. Ordering — unitarios (repos/puertos fake; publisher fake que captura)

1. `UpdateOrderStatus` `PLACED→IN_KITCHEN` persiste y publica `order.status-changed` con `previousStatus='PLACED'` y la Order completa.
2. Transición inválida (`PLACED→DELIVERED`, cualquiera desde `DELIVERED` o `CANCELLED`) → `INVALID_STATUS_TRANSITION`; NO persiste NI publica.
3. `CancelOrder` (Oleada 3) ahora valida contra la máquina: `IN_KITCHEN→CANCELLED` válido; `READY→CANCELLED` → `INVALID_STATUS_TRANSITION`.
4. `ConfirmOrder` publica `order.created` DESPUÉS de persistir (publisher captura exactamente 1 evento con la Order persistida); si `save` falla, no hay evento.
5. `CreateServiceCall` persiste con `status='pending'` y publica `service-call.created` con `tableId`/`note`.
6. `ResolveServiceCall` → `status='resolved'` + `resolvedAt` + publica `service-call.resolved`; segunda resolución → idempotente y NO republica.
7. `UpdateOrderStatus` sobre order de otro tenant → `ORDER_NOT_FOUND` (aislamiento).

### B. Ordering — integración (Supertest + Redis/PG test + socket.io-client)

8. `PATCH /orders/:id/status` → fila actualizada en Postgres Y mensaje en canal `tenant:{t}:order-events` (suscriptor Redis de test lo captura) con payload exacto `{ type, order, previousStatus, occurredAt }`.
9. `POST /service-calls` (guest) → HASH `service-call:{t}:{id}` + entrada en el SET de pending Y evento en `tenant:{t}:service-calls`.
10. `PATCH /service-calls/:id/resolve` (staff) → evento `service-call.resolved`; `GET /service-calls?status=pending` ya no lo lista.
11. Socket end-to-end: cliente staff conectado al ns `/orders` recibe `order:status-changed` tras el PATCH; cliente guest recibe `order:created`/`status-changed` SOLO de su `sessionId` (evento de otra mesa no le llega).
12. Socket sin token o con token inválido → `connect_error`.
13. `PATCH /orders/:id/status` con guest → 403; con staff → 200. `POST /service-calls` sin `x-session-id` → 401 `SESSION_REQUIRED`.

### C. KDS — Admin Dashboard (Testing Library + MSW + socket.io-client mockeado)

14. `/kds` renderiza las 3 columnas con las orders del stub inicial (`GET /v1/orders`), cada una como `data-component="bento-card"`.
15. `KdsOrderCard` muestra `tableId`, items con cantidades y modificadores, `notes` y tiempo transcurrido.
16. El botón de avance llama `PATCH /v1/orders/:id/status` con el siguiente estado de `ORDER_STATUS_TRANSITIONS` y muestra feedback loading→success (`aria-busy`).
17. Al recibir `order:created` por el socket mockeado, la tarjeta aparece en `PLACED` SIN recargar ni polling.
18. Al recibir `order:status-changed`, la tarjeta se mueve de columna; `DELIVERED` desaparece del board.
19. `ServiceCallPanel`: `service-call:created` añade la llamada (mesa + nota); "Resolver" llama `PATCH /v1/service-calls/:id/resolve` y la retira de pendientes.
20. El socket se construye con namespace `/orders` y `auth.token` = staff JWT (assert sobre el mock de `socket.io-client`).
21. Accesibilidad en vivo: existe UNA región `role="status" aria-atomic="true"` que anuncia mensajes completos ("Nueva orden de la mesa 5"); no hay live regions por tarjeta.
22. Bento/a11y: tokens `var(--bento-*)` sin hardcodeo, acento vibrante solo en `KpiValue` (tiempo > umbral → `tone="destructive"`), iconos `aria-hidden`, cero emojis.
23. `<FeatureGuard flag="kitchen-display">`: OFF → `Proximamente`; ON (provider con flag) → board.

### D. Cierre de oleada (smoke)

24. Gateway: filas de §3.2 activas; los 134 tests previos en verde.
25. Migración del enum `OrderStatus` aplica limpio sobre `resto_ordering`; diff de schema vacío salvo el enum.
26. E2E real: guest confirma order → staff conectado por socket la ve en el KDS → avanza a `READY` → guest recibe `order:status-changed` de SU mesa; llamado a mesero visible para staff y resoluble en tiempo real.

**Criterio de cierre**: tests 1–23 escritos primero en rojo y llevados a verde; checks 24–26 verificados; 134 previos intactos. Total esperado: **160/160**.
