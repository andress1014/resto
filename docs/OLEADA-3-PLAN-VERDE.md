# OLEADA 3 — Plan de Ejecución de la Fase Verde (para AGY)

> Estado de partida: 30/30 tests en rojo (21 en ordering, 9 en client-pwa), sin código funcional.
> Previos REALES: **104/104** (30 Oleada 0 + 44 Oleada 1 + 30 Oleada 2).
> Cifra corregida: el "134" del cierre de Oleada 2 era un error aritmético (sumaba dos veces los 30 nuevos).
> **Cierre correcto de esta oleada: 104 + 30 = 134/134.**
> Este documento NO contiene código. Regla de oro: **los tests no se tocan**; los puertos de `@packages/shared-types/ordering/` están CONGELADOS.

## 1. Orden exacto de resolución de módulos

```
BLOQUE 0  Infra: Prisma ordering + migración + config/env + Redis/PG de test
BLOQUE 1  Ordering: dominio (pricing, validación, merge) + casos de uso   → tests 1–12 (Suite A)
BLOQUE 2  Ordering: RedisCartRepository + GraphqlCatalogValidationAdapter + PrismaOrderRepository
BLOQUE 3  Ordering: interfaces HTTP + composition root                    → tests 13–17 (Suite B)
BLOQUE 4  Gateway: filas nuevas de §3.2                                   → regresión 104 tests
BLOQUE 5  Client PWA: contexto de carrito + polling + componentes Bento   → tests 18–26 (Suite C)
BLOQUE 6  Cierre: desacoplamiento + E2E real + full suite                 → checks 27–30
```

Justificación:
- **Inside-out**: dominio → aplicación → infraestructura (Redis/Postgres/GraphQL) → interfaces HTTP → gateway → frontend. Nunca al revés.
- El **puerto `CatalogValidationPort` se fakea en Suite A**; el adaptador GraphQL real no aparece hasta el Bloque 2 y se prueba con nock en Suite B. Nadie escribe GraphQL fuera de ese adaptador.
- **Bloque 4 (gateway) antes del PWA** por la misma razón que en Oleada 2: las filas reales son la fuente de verdad que los handlers MSW replican.
- Dentro de cada suite: un test rojo a la vez → mínimo código → refactor → siguiente.

## 2. Archivos y capas por bloque (secuencia hexagonal)

### BLOQUE 0 — Infraestructura

1. `services/ordering/prisma/schema.prisma` — tal cual §2 del manifiesto (Order, OrderItem, OrderItemModifier, enum `OrderStatus`).
2. Migración inicial + verificación sobre `resto_ordering` + Prisma client propio del servicio.
3. `src/config/` — env: `ORDERING_DATABASE_URL`, `REDIS_URL` (**db1**), `CATALOG_INTERNAL_URL`, `CART_TTL_SECONDS` (default 14400), `CART_POLL_INTERVAL_MS` (PWA, default 5000). Nada hardcodeado.
4. Helpers de test: Redis de test (db1), Postgres de test, limpieza entre tests.

Cero lógica de negocio en este bloque.

### BLOQUE 1 — Ordering, Suite A (tests 1–12)

Secuencia de archivos:

1. `src/domain/` — piezas puras y síncronas:
   - Errores de dominio: `CART_EMPTY`, `PRODUCT_NOT_FOUND`, `PRODUCT_UNAVAILABLE`, `MODIFIER_REQUIRED`, `MODIFIER_INVALID`, `ORDER_NOT_FOUND`, `FORBIDDEN`, `VALIDATION_ERROR`, `SESSION_REQUIRED`, `CATALOG_UNREACHABLE`.
   - **Clave de merge canónica**: comparación de líneas por `productId` + conjunto de modificadores **orden-insensible** (canonicalizar/ordenar antes de comparar — ver riesgo en §4).
   - **Motor de precios**: función pura que, dado un carrito y los `ValidatedProduct` del puerto, recalcula línea por línea (`(price + Σ priceDelta) × quantity`) y el total. Aritmética en centavos enteros o `Decimal`: PROHIBIDO sumar floats (ver §4).
   - **Validador de modificadores**: reglas `isRequired`, `minSelections`, `maxSelections`, existencia de grupo/opción, contra el `ValidatedProduct`.
2. `src/application/GetCart.ts`, `AddCartItem.ts` → tests 1, 2.
3. `src/application/UpdateCartItemQuantity.ts` → test 3.
4. `src/application/RemoveCartItem.ts` → test 4.
5. `src/application/ConfirmOrder.ts` → tests 5–11 (el corazón de la oleada: load → `CART_EMPTY` → fetch puerto catálogo → validar → recalcular → snapshot → `save` transaccional → `clear`).
6. `src/application/ListSessionOrders.ts`, `GetOrder.ts` → test 12; `ListTenantOrders.ts`, `CancelOrder.ts` cierran la superficie de puertos.

`domain/` y `application/` NO importan `ioredis`, `@prisma/client` ni ningún cliente GraphQL: solo puertos de shared-types + fakes de la fase roja.

### BLOQUE 2 — Ordering, adaptadores de infraestructura

Secuencia:

1. `src/infrastructure/persistence/RedisCartRepository.ts` — HASH `cart:{tenantId}:{sessionId}`; TODAS las mutaciones atómicas (`WATCH/MULTI` o script Lua); TTL sliding en `get` y en cada mutación.
2. `src/infrastructure/catalog/GraphqlCatalogValidationAdapter.ts` — ÚNICO archivo del servicio que habla GraphQL. Llama a `CATALOG_INTERNAL_URL` con `x-tenant-id`, traduce la respuesta a `ValidatedProduct`, y mapea fallos de red/timeout a `CATALOG_UNREACHABLE`.
3. `src/infrastructure/persistence/PrismaOrderRepository.ts` — `save` con `$transaction` (order + items + modifiers en un commit); `findById/listByTenant/listBySession/cancel`. Conversión `Decimal ↔ number` SOLO aquí.

### BLOQUE 3 — Ordering, interfaces HTTP, Suite B (tests 13–17)

Secuencia:

1. `src/interfaces/http/middleware/requireGatewayIdentity.ts` — cabeceras `x-tenant-id`/`x-user-role`/`x-session-id`; rutas `/cart*` sin `x-session-id` → 401 `SESSION_REQUIRED` (test 16).
2. `src/interfaces/http/middleware/errorHandler.ts` — `{ error: { code, message } }`; `CATALOG_UNREACHABLE` → 502 (test 17).
3. `src/interfaces/http/cart.routes.ts` → tests 13, 14.
4. `src/interfaces/http/orders.routes.ts` → tests 15, 16 (guest vs staff, 403 de sesión ajena).
5. `src/app.ts` — composition root: construye Redis db1 + Prisma + adaptador catálogo, inyecta en casos de uso, monta rutas. `index.ts` solo listen.

### BLOQUE 4 — Gateway

1. `services/gateway/src/routes/` — EXACTAMENTE las filas de §3.2 del manifiesto; eliminar `POST /v1/orders` y `PATCH /v1/orders/:id/status` (nunca implementadas; `/v1/cart/confirm` es el reemplazo).
2. Rol `guest` permitido en `/v1/cart*` y en `GET /v1/orders*`; `cancel` solo `admin`/`manager`.
3. Ejecutar INMEDIATAMENTE los 104 tests previos: todos verdes antes de tocar el PWA.

### BLOQUE 5 — Client PWA, Suite C (tests 18–26)

Secuencia de archivos:

1. `src/components/cart/` contexto de carrito (`CartContext` o equivalente) — `GET /v1/cart` inicial + polling silencioso cada `CART_POLL_INTERVAL_MS`, pausado con pestaña oculta. Tests 21 depende de esto: va primero.
2. `CartFab.tsx` → tests 18 (contador), 19 (slot estable + tokens).
3. Integración en `ProductDetailSheet`: CTA "Añadir" → `POST /v1/cart/items` + refresco inmediato → test 18.
4. `CartSheet.tsx` + `CartLineItem.tsx` + `AddedByBadge.tsx` → tests 20, 25.
5. `QuantityStepper.tsx` → test 22.
6. `CartSummaryBar.tsx` + `CartEmptyState.tsx` + `OrderConfirmationCard.tsx` → tests 23, 24.
7. Cierre transversal: aserciones Bento/a11y (25) y FeatureGuard `online-ordering` (26).

Handlers MSW contra §3.2 del manifiesto (fijado en Bloque 4), no contra el ordering a medio hacer. Primitivos de `@packages/ui-components` se IMPORTAN tal cual: composición, nunca edición.

### BLOQUE 6 — Cierre (checks 27–30)

1. Check 27: gateway con filas nuevas + 104 tests previos en verde.
2. Check 28: regla de imports (lint o test) — ordering no importa Prisma clients de identity/catalog ni cliente Redis apuntando a db0.
3. Check 29: E2E real por gateway (ver §4 — cadena completa).
4. Check 30: `pnpm test` completo + `pnpm build` de shared-types con `ordering/`.

## 3. Restricciones arquitectónicas que AGY NO debe romper

1. **`tenantId` primer parámetro, siempre**, en TODO método de repositorio/puerto. El carrito se direcciona `cart:{tenantId}:{sessionId}`: jamás solo por `sessionId`.
2. **El carrito NUNCA es autoridad de precios**: los campos de display (`productName`, `unitPrice`, nombres de modificadores) que envía el cliente son SOLO para pintar. `ConfirmOrder` recalcula TODO desde `CatalogValidationPort`: existencia, `isAvailable`, reglas de modificadores, precios y `priceDelta`. El test 9 es de seguridad: saltarse esto es un agujero de fraude.
3. **Atomicidad del carrito**: toda mutación del HASH con `WATCH/MULTI` o Lua. Read-modify-write sin control de concurrencia = pérdida de líneas con dos guests activos.
4. **Ordering NUNCA lee el redis db0 de Session Service**: la validez de la sesión es la validez del guest JWT (firma + exp, verificadas en gateway). Check 28 lo vigila.
5. **`CatalogValidationPort` como único punto de contacto GraphQL**: ningún otro archivo importa cliente GraphQL ni conoce SDL. Si la query cambia, cambia un solo adaptador.
6. **Confirmación transaccional**: `Order + OrderItem + OrderItemModifier` en UNA `$transaction`; el `DEL` del carrito ocurre SOLO tras commit exitoso. Fallo de persistencia → carrito intacto (test 11).
7. **Dinero sin floats**: totales con centavos enteros o `Decimal`; conversión a number solo en el borde (DTO). Redondeos definidos en el motor de precios del dominio, no dispersos.
8. **Merge canónico**: la comparación de modificadores para fusionar líneas es orden-insensible (canonicalizar antes de comparar).
9. **Contrato de error exacto**: `{ error: { code, message } }` con el vocabulario fijado; `CATALOG_UNREACHABLE` → 502 sin filtrar stack traces.
10. **Claves Redis exactas** (`cart:{tenantId}:{sessionId}`) — el test 13 las inspecciona.
11. **Gateway: filas nuevas y las dos bajas declaradas, nada más**; 104 previos verdes tras el cambio, no al final.
12. **Bento sin excepciones en el PWA**: hex/px solo en `tokens.css`; acento vibrante solo en `KpiValue` (lineTotal/total); touch targets ≥44px vía token; polling SILENCIOSO (sin loader salvo carga inicial); contador en slot estable; `role="alert"` en errores de confirmación; `overscroll-behavior: contain`.
13. **FeatureGuard fail-closed intacto**: se USA (`online-ordering`), no se modifica. Primitivos de ui-components congelados.
14. **Los tests no se editan.** Un test sospechoso se escala al Planificador.

## 4. Riesgos y dependencias entre tests

- **Suite B depende de Suite A**: los controllers solo cablean casos de uso. Abrir B con A en rojo = falsos fallos en cascada.
- **Test 9 (recálculo de precios) es CRÍTICO DE SEGURIDAD**: debe fallar ante cualquier atajo (usar `unitPrice` del carrito, olvidar `priceDelta`, no multiplicar por `quantity`). Implementar el motor de precios en dominio puro y verdearlo ANTES de tocar persistencia; es el test que más barato sale equivocarse dos veces.
- **Test 14 (dos guests, mismo carrito) requiere concurrencia real**: dos agentes Supertest con dos tokens distintos y mismo `sessionId`. Si el `upsertItem` no es atómico, este test pasa a veces — flakiness intermitente = síntoma de read-modify-write. No "reintentar hasta que pase": arreglar la atomicidad.
- **Test 11 (atomicidad de confirmación)**: inyectar fallo en `OrderRepository.save` vía fake; en integración (test 15) verificar que tras un fallo forzado el HASH sigue existiendo. Tentación prohibida: borrar el carrito antes de persistir "para simplificar".
- **Test 2 (merge)**: si la comparación de modificadores es sensible al orden, el merge falla intermitentemente según cómo llegue el array del cliente. Canonicalizar (ordenar por `groupId`+`optionId`) antes de comparar.
- **Test 17 (`CATALOG_UNREACHABLE`)**: nock sin respuesta/timeout debe mapear a 502 con el contrato de error, no a un 500 con stack. El mapeo vive en el adaptador GraphQL, no en cada controller.
- **Test 21 (polling)**: fake timers + MSW son frágiles juntos — avanzar timers de forma controlada y asertar (a) que la nueva línea aparece sin interacción y (b) que NO aparece ningún loader durante el poll. El intervalo viene de env/config, no de una constante escondida.
- **Nock ↔ adaptador GraphQL**: el interceptor debe matchear la query real del adaptador con sus `variables` (`productIds`, `x-tenant-id`). Un interceptor permisivo da verdes falsos que el E2E destapa tarde.
- **Check 29 (E2E) es la ÚNICA prueba real de la cadena completa**: `open` (session) → dos guests añaden (ordering/redis) → `confirm` → validación GraphQL REAL contra catalog → commit en Postgres → staff lista la order → carrito vacío. Requiere compose con todos los servicios, `JWT_SECRET` coherente y `CATALOG_INTERNAL_URL` apuntando al catalog real. MSW/nock no cubren nada de esto: la oleada NO se cierra sin él.
- **Dependencias del E2E sobre oleadas previas**: si falla por aislamiento de tenant o por guest JWT, el defecto puede estar en Oleada 1/2 — escalar al Planificador, no parchear servicios ajenos desde esta oleada.
- **Regresión**: ejecutar los 104 previos tras el Bloque 4 (gateway) y al final. El PWA no toca ui-components; si una "mejora" tentadora aparece, composición o escalado — nunca edición directa.

## 5. Definición de "verde" por bloque

Bloque terminado = sus tests en verde + bloques anteriores en verde + 104 previos en verde + cero `skip`/`todo`/`only` nuevos. Cierre de oleada: 30/30 + checks 27–30 + 104/104 previos = **134/134** (cifra corregida: 30 Oleada 0 + 44 Oleada 1 + 30 Oleada 2 + 30 Oleada 3).
