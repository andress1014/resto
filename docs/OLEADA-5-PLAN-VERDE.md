# OLEADA 5 — Plan de Ejecución de la Fase Verde (para AGY) — ÚLTIMA OLEADA DEL MVP

> Estado de partida: 22/22 tests en rojo (8 unitarios, 4 integración, 7 UI checkout, 3 smoke), sin código funcional.
> Previos: **160/160** en verde. Cierre correcto: 160 + 22 = **182/182 = MVP COMPLETO**.
> Este documento NO contiene código. Regla de oro: **los tests no se tocan**; los puertos de `@packages/shared-types/ordering/` (extensión de Oleada 5) están CONGELADOS.

## 1. Orden exacto de resolución de módulos

```
BLOQUE 0  Infra: migración Payment + config (SESSION_INTERNAL_URL) + helpers nock
BLOQUE 1  Dominio: cálculo de cuenta (puro) + invariantes de Payment + errores nuevos
BLOQUE 2  Aplicación: GetBill + ConfirmCheckout con fakes                  → tests 1–8 (Suite A)
BLOQUE 3  Infraestructura: PrismaPaymentRepository → HttpSessionServiceAdapter →
          extensión EventPublisher (checkout-completed) + wiring realtime
BLOQUE 4  Interfaces HTTP: rutas checkout                                  → tests 9–12 (Suite B)
BLOQUE 5  Gateway: filas de §3.2                                           → regresión 160 tests
BLOQUE 6  Admin Dashboard: vista /checkout                                 → tests 13–19 (Suite C)
BLOQUE 7  Cierre del MVP: E2E cierre de visita + migración + full suite    → checks 20–22
```

Justificación:
- **Inside-out**: el cálculo de cuenta es una función pura del dominio (suma de no canceladas): va primero, la consumen casos de uso, HTTP y UI.
- **El `SessionServicePort` se fakea en Suite A**: el adaptador HTTP real (`HttpSessionServiceAdapter`) no existe hasta el Bloque 3 y se prueba con nock en Suite B. Nadie escribe HTTP contra Session Service fuera de ese adaptador.
- **Dentro del Bloque 3 el orden importa**: `PrismaPaymentRepository` antes que el adaptador de sesión (el flujo persiste primero, orquesta después — el código debe nacer en ese orden).
- **Gateway (Bloque 5) antes de la UI** por la regla de siempre: filas reales = fuente de verdad de los handlers MSW.
- Un test rojo a la vez → mínimo código → refactor → siguiente.

## 2. Archivos y capas por bloque (secuencia hexagonal)

### BLOQUE 0 — Infraestructura base

1. `services/ordering/prisma/schema.prisma` — añade `Payment` + enum `PaymentMethod` EXACTAMENTE según §2 del manifiesto (incluido `@@unique([tenantId, sessionId])`). Migración y verificación sobre `resto_ordering`. NINGÚN otro cambio de schema.
2. `src/config/` — env nueva: `SESSION_INTERNAL_URL` (p. ej. `http://session:4003`). Sin defaults inventados: falta la env → el servicio no arranca (fail-fast).
3. Helpers de test: interceptor nock reutilizable para `{SESSION_INTERNAL_URL}/sessions/:id/close` con aserción de cabeceras propagadas.

### BLOQUE 1 — Dominio (puro, síncrono)

1. `src/domain/bill.ts` — función pura: dado un conjunto de `OrderDTO`, filtra `status != CANCELLED` y devuelve `{ orders, ordersCount, total }`. Aritmética en centavos enteros o `Decimal` (floats prohibidos, regla de Oleada 3).
2. `src/domain/payment.ts` — invariantes: `method` ∈ {CASH, CARD, OTHER}; `amount` siempre derivado del cálculo de cuenta.
3. Errores de dominio nuevos: `BILL_NOT_FOUND`, `BILL_EMPTY`, `SESSION_CLOSE_FAILED`.

### BLOQUE 2 — Aplicación, Suite A (tests 1–8)

Secuencia de archivos (`src/application/`, solo puertos + fakes):

1. `GetBill.ts` → tests 1, 2 (`listBySession` de Oleada 3 + cálculo puro; `payment` adjunto si existe).
2. `ConfirmCheckout.ts` → tests 3–8, en este orden interno de construcción:
   a. cálculo + `BILL_EMPTY` (tests 3, 4);
   b. persistencia de Payment + `recordedBy` (test 3);
   c. orquestación `closeSession` DESPUÉS de persistir, con identidad propagada (test 5);
   d. idempotencia vía `PaymentRepository.findBySession` (test 6);
   e. fallo parcial: persistido pero cierre fallido → `SESSION_CLOSE_FAILED` (test 7);
   f. limpieza de residuos propios (carrito + service-calls) y publicación de `session.checkout-completed` como ÚLTIMO paso (test 8).

`domain/` y `application/` NO importan `@prisma/client`, `ioredis` ni clientes HTTP.

### BLOQUE 3 — Infraestructura (adaptadores, en este orden)

1. `src/infrastructure/persistence/PrismaPaymentRepository.ts` — `save` respeta el `@@unique`: la violación de constraint NO es un crash, es la señal de "ya existe" que alimenta la idempotencia del caso de uso. Nada de locks ni mutexes aplicativos.
2. `src/infrastructure/session/HttpSessionServiceAdapter.ts` — ÚNICO archivo que habla con Session Service: `PATCH {SESSION_INTERNAL_URL}/sessions/:id/close` propagando `x-tenant-id/x-user-id/x-user-role`; mapea timeout/error HTTP a `SESSION_CLOSE_FAILED`.
3. Extensión de `RedisEventPublisher` (Oleada 4): `publishCheckoutCompleted` sobre el canal existente `tenant:{tenantId}:order-events`.
4. `realtimeWiring` (Oleada 4): traduce `CheckoutCompletedEvent` al evento socket `session:checkout-completed` hacia el room `tenant:{tenantId}`.

### BLOQUE 4 — Interfaces HTTP, Suite B (tests 9–12)

1. `src/interfaces/http/checkout.routes.ts` — `GET /checkout/:sessionId` (staff) → test 9; `POST /checkout/confirm` (staff; guest → 403, test 12).
2. `errorHandler` — añade mapeos: `BILL_NOT_FOUND` → 404, `BILL_EMPTY` → 400, `SESSION_CLOSE_FAILED` → 502 (test 12).
3. `src/app.ts` — composition root: cablea `PrismaPaymentRepository`, `HttpSessionServiceAdapter` y los nuevos casos de uso.

### BLOQUE 5 — Gateway

1. `services/gateway/src/routes/` — EXACTAMENTE las 2 filas de §3.2 del manifiesto (`GET /v1/checkout/:sessionId`, `POST /v1/checkout/confirm`, ambas token staff).
2. Ejecutar INMEDIATAMENTE los 160 tests previos: todos verdes antes de tocar la UI.

### BLOQUE 6 — Admin Dashboard, Suite C (tests 13–19)

Secuencia de archivos (`apps/admin-dashboard/src/`):

1. `app/(panel)/checkout/page.tsx` — guard de rol staff + `<FeatureGuard flag="payments">` (test 19 primero: define el esqueleto).
2. `components/checkout/ActiveTablesGrid.tsx` → test 13 (fuente: `GET /v1/sessions?status=active` de Oleada 2).
3. `components/checkout/BillSummaryCard.tsx` + `BillOrderLine.tsx` → test 14.
4. `components/checkout/PaymentMethodPicker.tsx` → test 15 (`radiogroup` accesible).
5. `components/checkout/ConfirmPaymentButton.tsx` (paso de confirmación inline obligatorio) + `PaymentSuccessCard.tsx` → test 16.
6. Manejo de `SESSION_CLOSE_FAILED` con "Reintentar cierre" → test 17.
7. Cierre transversal Bento/a11y → test 18.

Handlers MSW contra §3.2 (fijado en Bloque 5). Primitivos Bento se IMPORTAN: composición, nunca edición.

### BLOQUE 7 — Cierre del MVP (checks 20–22)

1. Check 20: gateway con filas nuevas + 160 previos verdes.
2. Check 21: **E2E cierre de visita completo** (ver §4 — la prueba final del MVP).
3. Check 22: migración de `Payment` limpia + `pnpm test` completo + `pnpm build` de shared-types.

## 3. Restricciones arquitectónicas que AGY NO debe romper

1. **`amount` SIEMPRE calculado en servidor, NUNCA del body**: el body de `confirm` solo trae `sessionId/tableId/method`. Un `amount` recibido se ignora (test 3 — es de seguridad, como el recálculo de Oleada 3).
2. **La `@@unique([tenantId, sessionId])` es LA fuente de idempotencia**: prohibido reimplementar locks, mutexes o flags "processing" aplicativos. La violación de constraint se traduce a "devolver el existente", nunca a error 500.
3. **`closeSession` se llama DESPUÉS de persistir el pago, NUNCA antes**: cerrar primero dejaría una mesa libre con deuda sin registrar si el proceso muere a mitad. El orden es: calcular → persistir → cerrar → limpiar → publicar.
4. **Limpieza de residuos ANTES de publicar el evento final**: `session.checkout-completed` anuncia "mesa libre y limpia"; publicarlo antes de limpiar carrito/service-calls miente al resto del sistema.
5. **`SessionServicePort` como ÚNICO punto de contacto HTTP con Session Service**: ningún otro archivo importa cliente HTTP ni conoce `SESSION_INTERNAL_URL`. Session Service no se modifica en esta oleada (su close de Oleada 2 se reutiliza tal cual).
6. **Solo residuos PROPIOS**: la limpieza toca únicamente claves de Ordering (redis db1: carrito + service-calls). Las claves de Session Service (db0) siguen su propio ciclo de vida — prohibido tocarlas.
7. **Paso de confirmación obligatorio en la UI**: `ConfirmPaymentButton` nunca cobra al primer click; la confirmación inline muestra total y consecuencia. Es acción irreversible en el MVP (no existe "descobrar").
8. **Reintento seguro como contrato**: `SESSION_CLOSE_FAILED` muestra "Reintentar cierre"; el backend garantiza que reintentar no duplica el cobro (idempotencia del punto 2).
9. **`tenantId` primer parámetro siempre** (PaymentRepository, SessionServicePort, casos de uso).
10. **Dinero sin floats**: total en centavos enteros o `Decimal`; conversión a number solo en el borde DTO.
11. **Gateway: las 2 filas y nada más**; 160 previos verdes tras el cambio.
12. **Bento sin excepciones**: hex/px solo en `tokens.css`; acento vibrante solo en `KpiValue` (total) y CTA primario; `radiogroup`/`radio` con labels visibles; `role="alert"` enfocable; primitivos de ui-components congelados.
13. **FeatureGuard fail-closed intacto**: `payments` OFF por defecto; los tests inyectan el provider ON por contexto, nunca activando el flag global.
14. **Los tests no se editan.** Un test sospechoso se escala al Planificador.

## 4. Riesgos y dependencias entre tests

- **Test 11 (doble confirm) depende de la migración**: si la `@@unique` no está bien aplicada desde la migración del Bloque 0, la idempotencia se sostiene solo "por lógica" y una carrera real la rompe. Verificar la constraint EN LA BASE DE DATOS (no solo en el schema) antes de Suite B. El caso concurrente (dos confirms a la vez) es donde esto se prueba de verdad.
- **Test 7 (fallo parcial) es el más delicado del flujo**: pago persistido + cierre fallido → 502 con el Payment en DB. Riesgos: (a) que un rollback equivocado borre el pago (prohibido — el pago ES el registro de que se cobró); (b) que el reintento choque con la unique y devuelva 500 en lugar del existente (test 6 y 7 se cubren mutuamente: verdearlos pensando como UN solo comportamiento de idempotencia); (c) que el 502 no cumpla el contrato `{ error: { code, message } }`.
- **Orden de operaciones como contrato observable**: los tests 5 y 8 verifican secuencia (persistir → cerrar → limpiar → publicar). Los fakes deben registrar el ORDEN de las llamadas, no solo que ocurrieron; un caso de uso con el orden correcto "por casualidad" es un bug latente.
- **Nock ↔ adaptador de sesión (test 10)**: el interceptor debe asertar método, path Y cabeceras propagadas (`x-tenant-id/x-user-id/x-user-role`). Un interceptor que acepta cualquier llamada da verde falso: el staff que cobra debe ser el staff que aparece cerrando la sesión.
- **Test 14 (bill en UI)**: el stub MSW debe incluir una Order `CANCELLED` para que el assert "no aparece" sea real; un stub sin canceladas convierte el test en trivial.
- **Test 17 (reintento en UI)**: asertar que el segundo POST realmente se envía y que el success llega tras él; un botón "Reintentar" que solo oculta el error es el fallo clásico aquí.
- **Check 21 (E2E) es la prueba final de TODO el MVP**: recorre las cinco oleadas en una sola cadena — register/login (1) → carta (1) → QR y sesión guest (2) → carrito colaborativo y confirm (3) → KDS y estados (4) → cuenta, cobro y liberación (5) → verificación de mesa reabrible y Redis sin residuos. Si falla, el defecto puede estar en cualquier oleada: localizar el eslabón por la respuesta de cada paso y escalar si el fallo está en código de oleadas previas (no parchear servicios ajenos desde esta oleada).
- **Evento socket `session:checkout-completed`**: el KDS y el panel deberían reaccionar (quitar la mesa) sin recargar; no hay test de UI para esto en Suite C — el E2E es quien lo valida. No añadir tests nuevos fuera del manifiesto; si se detecta un hueco real, escalar al Planificador.
- **Regresión**: ejecutar los 160 previos tras el Bloque 3 (extensión del publisher/wiring de Oleada 4 — toca código de realtime existente), Bloque 5 (gateway) y al final. Cero cambios en ui-components esta oleada.

## 5. Definición de "verde" por bloque y cierre del MVP

Bloque terminado = sus tests en verde + bloques anteriores en verde + 160 previos en verde + cero `skip`/`todo`/`only` nuevos.

**Cierre de la oleada y del MVP**: 22/22 + checks 20–22 + 160/160 previos = **182/182**. Con esto quedan cubiertas las cinco oleadas del roadmap: infraestructura (0), core SaaS y catálogo (1), sesiones y experiencia de cliente (2), motor transaccional (3), fulfillment y tiempo real (4) y cierre de visita (5).
