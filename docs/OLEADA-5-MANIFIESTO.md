# OLEADA 5 — Manifiesto Técnico: Cierre de Visita (última oleada del MVP)

> Entregable del Planificador. Arquitectura, contratos e interfaces únicamente.
> PROHIBIDO implementar: AGY inicia Fase Roja con los tests de la sección 6.
> Estado previo: 160/160 en verde (30+44+30+30+26). Cierre esperado: 160 + 22 = **182/182**.

## 1. Decisión: ¿dónde vive la lógica de checkout?

**En Ordering Service (:4004), como endpoints nuevos.** Justificación:

1. **Propiedad del dato**: la cuenta es un read-model sobre las Orders, que pertenecen a Ordering. Nadie más puede sumarlas sin violar fronteras de servicio.
2. **El gateway NO es un orquestador de negocio**: desde Oleada 0 su tabla de rutas es dato declarativo; meter orquestación de cobro+cierre lo convertiría en un BFF con lógica, rompiendo el principio que ha mantenido sus tests verdes cuatro oleadas.
3. **La orquestación con Session Service es UNA llamada interna** y Ordering ya tiene el patrón para eso: el puerto anticorrupción (`CatalogValidationPort`, Oleada 3). Se añade un `SessionServicePort` simétrico. Session Service **no se modifica**: su `PATCH /sessions/:id/close` de Oleada 2 se reutiliza tal cual, con las cabeceras del staff propagadas.
4. **El registro de cobro es estado transaccional de la visita**: mismo bounded context que las Orders que liquida. Persistirlo en otro servicio crearía una transacción distribuida innecesaria.

## 2. Modelo de datos: tabla nueva `Payment` en `resto_ordering`

Decisión: **tabla nueva** (no metadatos). Motivos: el cobro es de la VISITA (N orders), no de una Order individual — no cabe en `Order` sin romper su semántica; y meterlo en `TableSession` violaría la frontera de Session Service.

```prisma
enum PaymentMethod { CASH CARD OTHER }

model Payment {
  id          String        @id @default(uuid())
  tenantId    String        // referencia lógica — sin FK
  sessionId   String        // referencia lógica a session service — sin FK
  tableId     String        // desnormalizado (consulta/reporte)
  amount      Decimal       @db.Decimal(10, 2)   // calculado en servidor, JAMÁS del body
  method      PaymentMethod
  ordersCount Int
  recordedBy  String        // userId del staff que registró el cobro
  createdAt   DateTime      @default(now())
  @@unique([tenantId, sessionId])   // UNA visita, UN cobro — idempotencia estructural anti doble cargo
  @@index([tenantId, createdAt])
}
```

El `@@unique([tenantId, sessionId])` es la pieza anti doble cargo: un segundo confirm (reintento, doble click, dos staff a la vez) no puede crear un segundo Payment.

No se toca nada más del schema. Migración aditiva.

## 3. Contratos API

### 3.1 Ordering Service (upstream :4004) — rutas nuevas

| Método + path upstream | Quien | Contrato |
|---|---|---|
| GET `/checkout/:sessionId` | staff | → `200 BillDTO { sessionId, tableId, orders: OrderDTO[] (NO canceladas), ordersCount, total, payment: PaymentDTO \| null }`; sesión ajena al tenant → `BILL_NOT_FOUND` |
| POST `/checkout/confirm` | staff (`staff/manager/admin`) | `{ sessionId, tableId, method: 'CASH'\|'CARD'\|'OTHER' }` → `201 { bill: BillDTO, payment: PaymentDTO }` |

Flujo de `confirm` (orquestación):
1. Calcular la cuenta: `OrderRepository.listBySession` (Oleada 3) filtrando `status != CANCELLED`. Si no hay ninguna → `BILL_EMPTY` (400).
2. Persistir `Payment` con `amount` = total calculado en servidor (el body NUNCA trae monto) y `recordedBy` = `x-user-id`.
3. **Idempotencia**: si ya existe Payment para `(tenantId, sessionId)` → NO falla: devuelve `200` con el pago existente y REINTENTA el cierre de sesión (semántica de reintento limpia).
4. Llamar `SessionServicePort.closeSession` → `PATCH {SESSION_INTERNAL_URL}/sessions/:id/close` propagando `x-tenant-id`, `x-user-id`, `x-user-role` del staff llamante (Session Service sin cambios; su close ya es idempotente, Oleada 2).
5. Si el cierre falla → `502 SESSION_CLOSE_FAILED`, pero el pago queda registrado; el reintento (punto 3) lo completa.
6. **Limpieza de residuos propios** (solo claves de Ordering, redis db1 — jamás el db0 de session): `DEL cart:{tenantId}:{sessionId}` por si el guest dejó items sin confirmar, y resolver/eliminar los `service-call` pendientes de esa sesión.
7. Publicar evento `session.checkout-completed` por Pub/Sub (canal `tenant:{tenantId}:order-events`) → el KDS/panel se entera en tiempo real de que la mesa quedó libre. Payload: `{ type: 'session.checkout-completed', sessionId, tableId, payment: PaymentDTO, occurredAt }`. Socket: evento `session:checkout-completed` al room `tenant:{tenantId}` (staff).

Errores nuevos: `BILL_NOT_FOUND`, `BILL_EMPTY`, `SESSION_CLOSE_FAILED`. Contrato `{ error: { code, message } }` intacto.

### 3.2 API Gateway — filas NUEVAS

| Método + ruta pública | Auth | Destino | Path upstream |
|---|---|---|---|
| GET `/v1/checkout/:sessionId` | token staff | ordering:4004 | `/checkout/:sessionId` |
| POST `/v1/checkout/confirm` | token staff | ordering:4004 | `/checkout/confirm` |

Para localizar la mesa activa, el dashboard reutiliza `GET /v1/sessions?status=active` (existe desde Oleada 2 — cero cambios en session ni en sus rutas).

## 4. Puertos y adaptadores — `@packages/shared-types` (extensión de `ordering/`)

```ts
// dtos.ts
export type PaymentMethod = 'CASH' | 'CARD' | 'OTHER';
export interface PaymentDTO {
  id: string; tenantId: string; sessionId: string; tableId: string;
  amount: number; method: PaymentMethod; ordersCount: number;
  recordedBy: string; createdAt: string;
}
export interface BillDTO {
  sessionId: string; tableId: string;
  orders: OrderDTO[];          // solo no canceladas
  ordersCount: number; total: number;
  payment: PaymentDTO | null;  // null = aún no cobrada
}

// events: nuevo tipo sobre el canal existente tenant:{tenantId}:order-events
export interface CheckoutCompletedEvent {
  type: 'session.checkout-completed';
  sessionId: string; tableId: string; payment: PaymentDTO; occurredAt: string;
}

// ports.ts — tenantId SIEMPRE primer parámetro
export interface PaymentRepository {
  save(tenantId: string, payment: PaymentDTO): Promise<PaymentDTO>;
  findBySession(tenantId: string, sessionId: string): Promise<PaymentDTO | null>;
}
export interface SessionServicePort {   // anticorrupción, simétrico a CatalogValidationPort
  closeSession(tenantId: string, sessionId: string, requester: { userId: string; role: string }): Promise<void>;
}
// Casos de uso (firmas)
export type GetBillUseCase = UseCase<{ tenantId: string; sessionId: string }, BillDTO>;
export type ConfirmCheckoutUseCase = UseCase<
  { tenantId: string; sessionId: string; tableId: string; method: PaymentMethod; recordedBy: string },
  { bill: BillDTO; payment: PaymentDTO }
>;
```

`EventPublisher` (Oleada 4) se extiende con `publishCheckoutCompleted(tenantId, event)`. Adaptadores que implementará AGY: `PrismaPaymentRepository` (respeta el unique: violación → señal de "ya existe" para la idempotencia, no crash), `HttpSessionServiceAdapter` (único archivo que habla con Session Service; mapea fallos a `SESSION_CLOSE_FAILED`).

## 5. Vista de Checkout — Admin Dashboard (Bento Box)

> Planificado con skill **ui-ux-pro-max** (dataset ux): confirmación antes de acción irreversible, feedback loading→success/error, resumen de error enfocable con `role="alert"`, labels explícitos (nada de placeholder-only). Sistema: el del admin (`restaurante-os-admin/MASTER.md`). Override: `design-system/restaurante-os-admin/pages/checkout.md`.
> Sección envuelta en `<FeatureGuard flag="payments">` (flag de Oleada 0, OFF por defecto → `Proximamente`; los tests inyectan el provider ON).

### 5.1 Ruta y flujo

`/checkout` (bajo guard de rol staff): lista de mesas con sesión activa (`GET /v1/sessions?status=active`) → seleccionar mesa → `GET /v1/checkout/:sessionId` → revisar cuenta → elegir medio de pago → **paso de confirmación** (acción irreversible: libera la mesa) → `POST /v1/checkout/confirm` → estado de éxito "Mesa liberada".

### 5.2 Componentes (`apps/admin-dashboard/src/components/checkout/`)

- `ActiveTablesGrid`: BentoCards de mesas activas (label de mesa + hora de apertura); estado vacío con texto plano.
- `BillSummaryCard` (BentoCard): lista de Orders de la visita — cada `BillOrderLine` con hora, items (cantidad + nombre + modificadores) y subtotal; total de la visita como `KpiValue tone="accent"` (único acento junto al CTA).
- `PaymentMethodPicker`: `role="radiogroup"` con 3 opciones (Efectivo / Tarjeta / Otro), cada una `role="radio"` con label visible (icono Phosphor `aria-hidden` + texto); sin selección → CTA disabled.
- `ConfirmPaymentButton`: CTA primario (`--bento-accent-strong`) que abre un **paso de confirmación inline** ("¿Registrar cobro de {total} y liberar la mesa?") — nunca cobro directo al primer click; feedback `aria-busy` → success/error.
- `PaymentSuccessCard`: "Cobro registrado. Mesa liberada." (texto + color success) con el medio de pago y el total; la mesa desaparece de `ActiveTablesGrid` (refetch).
- Errores: `role="alert"` enfocable dentro de la tarjeta; `SESSION_CLOSE_FAILED` muestra acción "Reintentar cierre" (el backend es idempotente: reintentar es seguro).

## 6. Casos de prueba exactos (Fase Roja de AGY)

### A. Ordering — unitarios (repos/puertos fake)

1. `GetBill` suma SOLO las Orders no canceladas de la sesión (una `CANCELLED` queda fuera) y devuelve `total`/`ordersCount` correctos.
2. `GetBill` de sesión de otro tenant → `BILL_NOT_FOUND`.
3. `ConfirmCheckout` persiste `Payment` con `amount` = total calculado en servidor (un `amount` manipulado en el body se ignora) y `recordedBy` del caller.
4. `ConfirmCheckout` sin Orders no canceladas → `BILL_EMPTY`, sin persistir nada.
5. `ConfirmCheckout` llama `closeSession` DESPUÉS de persistir el pago, propagando la identidad del staff (`userId`, `role`).
6. `ConfirmCheckout` idempotente: segundo confirm sobre la misma sesión → devuelve el pago existente (sin duplicar) y reintenta el cierre.
7. Si `closeSession` falla tras persistir → `SESSION_CLOSE_FAILED` y el pago queda registrado; el reintento posterior completa el cierre.
8. `ConfirmCheckout` limpia residuos propios: `clear` del carrito `cart:{t}:{s}` llamado y service-calls pendientes de la sesión resueltos; publica `session.checkout-completed` tras la orquestación.

### B. Ordering — integración (Supertest + Redis/PG test; Session Service con nock)

9. `GET /checkout/:sessionId` → bill con las orders reales de Postgres y total correcto.
10. `POST /checkout/confirm` → fila `Payment` en PG + llamada saliente a `{SESSION_INTERNAL_URL}/sessions/:id/close` (nock aserta método, path y cabeceras `x-tenant-id/x-user-id/x-user-role` propagadas) + clave de carrito eliminada en Redis.
11. Doble confirm (secuencial y/o concurrente) → UNA sola fila `Payment` (unique constraint); el segundo recibe el existente con 200.
12. Roles y contrato: guest → 403; staff → OK; nock de session fallando → 502 `SESSION_CLOSE_FAILED` con `{ error: { code, message } }` y Payment persistido.

### C. Admin Dashboard — Testing Library + MSW

13. `/checkout` lista las mesas activas (stub `GET /v1/sessions?status=active`) como `data-component="bento-card"`.
14. Al seleccionar mesa: `GET /v1/checkout/:sessionId` y `BillSummaryCard` muestra cada Order con items y el total como `KpiValue tone="accent"`; una Order cancelada del stub NO aparece.
15. `PaymentMethodPicker` es `radiogroup` accesible con 3 opciones con label visible; sin selección, el CTA está disabled.
16. Flujo de cobro: CTA → paso de confirmación inline → `POST /v1/checkout/confirm` con el `method` elegido → `PaymentSuccessCard` "Mesa liberada" y la mesa desaparece de la lista (refetch).
17. `SESSION_CLOSE_FAILED` → `role="alert"` con "Reintentar cierre"; el reintento exitoso muestra el success (assert de que el segundo POST se envía).
18. Bento/a11y: tokens `var(--bento-*)` sin hardcodeo, acento solo en total/CTA, iconos `aria-hidden`, cero emojis, touch targets ≥44px.
19. `<FeatureGuard flag="payments">`: OFF → `Proximamente`; ON (provider inyectado) → vista de checkout.

### D. Cierre de oleada (smoke)

20. Gateway: filas de §3.2 activas; los 160 tests previos en verde.
21. **E2E flujo completo de cierre de visita**: dos guests piden (2 Orders confirmadas) → staff consulta la cuenta consolidada (suma correcta) → registra cobro en efectivo → la TableSession queda cerrada (un nuevo `open` en la mesa crea sesión NUEVA) → carrito inexistente en Redis → sin service-calls pendientes de esa sesión.
22. Migración de `Payment` aplica limpio sobre `resto_ordering`; `pnpm test` verde en ordering y admin-dashboard; `pnpm build` compila shared-types.

**Criterio de cierre**: tests 1–19 escritos primero en rojo y llevados a verde; checks 20–22 verificados; 160 previos intactos. Total MVP: **182/182**.
