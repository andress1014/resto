# OLEADA 4 — Plan de Ejecución de la Fase Verde (para AGY)

> Estado de partida: 26/26 tests en rojo (7 unitarios, 6 integración+sockets, 10 KDS, 3 smoke), sin código funcional.
> Previos: **134/134** en verde. Cierre correcto de esta oleada: 134 + 26 = **160/160**.
> Este documento NO contiene código. Regla de oro: **los tests no se tocan**; los puertos de `@packages/shared-types/ordering/` (extensión de Oleada 4) están CONGELADOS.

## 1. Orden exacto de resolución de módulos

```
BLOQUE 0  Infra: migración enum OrderStatus + config/env + utilidades de test (subscriber Redis, socket)
BLOQUE 1  Dominio: máquina de transiciones + validador + errores nuevos
BLOQUE 2  Aplicación: casos de uso con fakes (publisher/subscriber/repos fake)  → tests 1–7 (Suite A)
BLOQUE 3  Infraestructura: RedisEventPublisher → RedisServiceCallRepository →
          PrismaOrderRepository.updateStatus → RedisEventSubscriber → SocketIoRealtimeEmitter
BLOQUE 4  Interfaces HTTP nuevas + bootstrap socket.io                          → tests 8–13 (Suite B)
BLOQUE 5  Gateway: filas de §3.2                                                → regresión 134 tests
BLOQUE 6  KDS: lib/realtime + componentes Bento                                 → tests 14–23 (Suite C)
BLOQUE 7  Cierre: migración verificada + E2E real + full suite                  → checks 24–26
```

Justificación:
- **Inside-out estricto**: la máquina de transiciones (dominio puro) es la primera pieza: TODO lo demás (casos de uso, HTTP, KDS) la consume.
- **El publisher/subscriber/socket van DESPUÉS de los casos de uso**: en Suite A el `EventPublisher` es un fake que captura; la infraestructura real de Redis/socket.io no existe hasta el Bloque 3. Quien empiece por socket.io estará trabajando sin contrato.
- **Dentro del Bloque 3, el orden importa**: publisher antes que subscriber (hay que tener algo que escuchar), subscriber antes que emitter (el emitter se alimenta del subscriber).
- **Los tests de socket (11, 12) se cierran AL FINAL del Bloque 4**: son los que más piezas requieren vivas a la vez (JWT + rooms + subscriber + publisher + HTTP).
- **Gateway (Bloque 5) antes del KDS** por la regla de siempre: las filas reales son la fuente de verdad de los handlers MSW.
- Un test rojo a la vez → mínimo código → refactor → siguiente.

## 2. Archivos y capas por bloque (secuencia hexagonal)

### BLOQUE 0 — Infraestructura base

1. Migración del enum `OrderStatus` en `services/ordering/prisma/` (`IN_KITCHEN`, `READY`, `DELIVERED` nuevos) y verificación sobre `resto_ordering`. NINGÚN otro cambio de schema (el check 25 hará diff).
2. `src/config/` — env nuevas: `SERVICE_CALL_TTL_SECONDS` (default 7200), `KDS_ALERT_MINUTES` (admin-dashboard, default 15). Redis db1 ya configurado (Oleada 3).
3. Utilidades de test: helper de suscriptor Redis de test (captura mensajes de un canal con timeout acotado) y helper de socket.io-client de test (conexión contra el server levantado en el test).

### BLOQUE 1 — Dominio (puro, síncrono)

1. `packages/shared-types/src/ordering/` — exportar `ORDER_STATUS_TRANSITIONS` (dato, no función) según §4 del manifiesto. Es shared-types porque el KDS también lo consume para el botón de avance.
2. `services/ordering/src/domain/orderStatusMachine.ts` (o equivalente) — validador puro: `canTransition(from, to)` contra `ORDER_STATUS_TRANSITIONS`.
3. Errores de dominio nuevos: `INVALID_STATUS_TRANSITION`, `SERVICE_CALL_NOT_FOUND`.
4. `src/domain/serviceCall.ts` — invariantes del ServiceCall (status inicial `pending`, resolve idempotente).

### BLOQUE 2 — Aplicación, Suite A (tests 1–7)

Secuencia de archivos (todos en `src/application/`, solo puertos + fakes):

1. `UpdateOrderStatus.ts` → tests 1, 2, 7 (valida transición → persiste vía `OrderRepository.updateStatus` → publica `order.status-changed` con `previousStatus`).
2. Refactor de `CancelOrder.ts` (Oleada 3) para validar contra la máquina → test 3. **OJO**: los tests de Oleada 3 deben seguir verdes tras este refactor; si uno rompe, el defecto es del refactor, no del test.
3. Extensión de `ConfirmOrder.ts` → publica `order.created` tras commit → test 4. La publicación es la ÚLTIMA línea lógica del caso de uso.
4. `CreateServiceCall.ts` → test 5.
5. `ResolveServiceCall.ts` → test 6 (idempotencia: si ya está `resolved`, devuelve sin republicar).
6. `ListServiceCalls.ts` — cierra la superficie (lo ejercitan B y C).

`domain/` y `application/` NO importan `ioredis`, `socket.io` ni `@prisma/client`.

### BLOQUE 3 — Infraestructura (adaptadores, en este orden)

1. `src/infrastructure/events/RedisEventPublisher.ts` — publica JSON en `tenant:{tenantId}:order-events` / `tenant:{tenantId}:service-calls` (conexión de comandos normal).
2. `src/infrastructure/persistence/RedisServiceCallRepository.ts` — HASH + SET de pending + limpieza perezosa (mismo patrón que sesiones, Oleada 2).
3. `src/infrastructure/persistence/PrismaOrderRepository.ts` — SOLO se añade `updateStatus`; los métodos de Oleada 3 intactos.
4. `src/infrastructure/events/RedisEventSubscriber.ts` — **conexión ioredis DEDICADA** (una conexión suscripta no puede ejecutar otros comandos); traduce mensajes a los handlers registrados vía puerto `EventSubscriber`.
5. `src/infrastructure/realtime/SocketIoRealtimeEmitter.ts` — servidor socket.io en ordering: middleware que verifica el JWT del handshake (mismo `JWT_SECRET`), une rooms (`tenant:{tenantId}` staff / `session:{sessionId}` guest), implementa `RealtimeEmitter` (`emitToTenant`/`emitToSession`).
6. `src/infrastructure/realtime/realtimeWiring.ts` — conecta subscriber → emitter: traduce `OrderEvent`/`ServiceCallEvent` de Redis a eventos socket (`order:created`, `order:status-changed`, `service-call:*`) con el payload exacto de §2 del manifiesto.

### BLOQUE 4 — Interfaces HTTP + bootstrap, Suite B (tests 8–13)

1. `src/interfaces/http/orders.routes.ts` — añade `PATCH /orders/:id/status` (rol staff+) → test 8; guest → 403 (test 13).
2. `src/interfaces/http/serviceCalls.routes.ts` — `POST` (guest, exige `x-session-id` → 401 `SESSION_REQUIRED`, test 13), `GET` (staff), `PATCH /:id/resolve` → tests 9, 10.
3. `src/app.ts` / `index.ts` — bootstrap: arranca `RedisEventSubscriber.start()` y el servidor socket.io junto al HTTP; cierre ordenado (`stop()`).
4. Cierre del bloque con los tests de socket: 12 (`connect_error` sin token) y 11 (aislamiento por rooms) — ver §4, son los más delicados.

### BLOQUE 5 — Gateway

1. `services/gateway/src/routes/` — EXACTAMENTE las 4 filas de §3.2 del manifiesto (status staff+, service-calls POST guest / GET+PATCH staff). El proxy `/socket.io/` NO se toca.
2. Ejecutar INMEDIATAMENTE los 134 tests previos: todos verdes antes de tocar el KDS.

### BLOQUE 6 — KDS, Suite C (tests 14–23)

Secuencia de archivos (`apps/admin-dashboard/src/`):

1. `lib/realtime.ts` — `socket.io-client` contra el gateway, ns `/orders`, `auth.token` = staff JWT; expone suscripción a eventos tipados. Tests 17–20 dependen de él: va primero.
2. Store local del board (estado por columnas + reducers de eventos socket).
3. `components/kds/KdsBoard.tsx` + `KdsColumn.tsx` → test 14.
4. `components/kds/KdsOrderCard.tsx` → tests 15, 16 (botón de avance según `ORDER_STATUS_TRANSITIONS`, feedback `aria-busy`).
5. `components/kds/ServiceCallPanel.tsx` → test 19.
6. `components/kds/KdsLiveAnnouncer.tsx` → test 21 (UNA región live).
7. `app/(panel)/kds/page.tsx` — guard de rol staff + `<FeatureGuard flag="kitchen-display">` → tests 22 (Bento/a11y) y 23 (FeatureGuard).
8. Cierre transversal: 17, 18, 20 (comportamiento socket con el mock).

Handlers MSW contra §3.2 (fijado en Bloque 5). Primitivos Bento se IMPORTAN: composición, nunca edición.

### BLOQUE 7 — Cierre (checks 24–26)

1. Check 24: gateway con filas nuevas + 134 previos verdes.
2. Check 25: `prisma migrate deploy` limpio + diff de schema vacío salvo el enum.
3. Check 26: E2E real (ver §4 — la única prueba de rooms+pubsub+socket juntos).

## 3. Restricciones arquitectónicas que AGY NO debe romper

1. **`ORDER_STATUS_TRANSITIONS` es la ÚNICA fuente de verdad** de qué cambios de estado son válidos. Prohibido hardcodear transiciones en controllers, en el KDS o en tests auxiliares; todos importan el dato de shared-types. `CancelOrder` también valida contra ella.
2. **El publisher emite SOLO tras commit/escritura exitosa, NUNCA antes**: si `save` falla no hay evento (test 4). Publicar-antes-de-persistir anuncia órdenes fantasmas al KDS.
3. **Suscriptor Redis con conexión DEDICADA**: separada de la conexión de comandos (publisher/repositorios). Compartir conexión corrompe la semántica de suscripción de Redis.
4. **Aislamiento por ROOMS, nunca por payload en el cliente**: el guest recibe solo su `sessionId` porque el servidor solo lo une a ese room; el staff ve todo su tenant porque solo está en `tenant:{tenantId}`. Prohibido emitir a todos y "filtrar en el cliente": eso fuga datos entre mesas/tenants.
5. **Los clientes socket nunca emiten, solo escuchan**: ningún handler client→server en esta oleada; el KDS cambia estados por REST (`PATCH`), no por socket.
6. **KDS con CERO polling tras la carga inicial**: la carga inicial es REST; toda actualización posterior llega por socket. Un `setInterval` de refetch = incumplimiento.
7. **Publicación atómica lógica**: resolve de ServiceCall ya resuelta NO republica (test 6); `ConfirmOrder` publica exactamente un `order.created`.
8. **`tenantId` primer parámetro siempre**, en repositorios, publisher y subscriber. Los canales llevan `tenantId` embebido: `tenant:{tenantId}:order-events`.
9. **Único cambio de schema: el enum**. Diff vacío en todo lo demás (check 25).
10. **Payloads exactos** de §2 del manifiesto: DTO completo incluido (los clientes no re-fetchean); `previousStatus` solo en `status-changed`.
11. **UNA sola región live en el KDS** (`role="status" aria-atomic="true"`, mensajes completos): prohibido un live region por tarjeta o números desnudos anunciados.
12. **Bento sin excepciones**: hex/px solo en `tokens.css`; acento vibrante solo en `KpiValue` (tiempo > umbral) y CTA primarios; iconos `aria-hidden`; cero emojis; primitivos de ui-components congelados.
13. **Gateway: las 4 filas y nada más**; proxy `/socket.io/` intacto; 134 previos verdes tras el cambio.
14. **FeatureGuard fail-closed intacto**: `kitchen-display` OFF por defecto → `Proximamente`. Los tests del KDS inyectan el provider con el flag ON (vía props/contexto), NUNCA activando el flag global.
15. **Los tests no se editan.** Un test sospechoso se escala al Planificador.

## 4. Riesgos y dependencias entre tests

- **Test 11 (aislamiento de sockets por sesión) es el más delicado de la oleada**: exige verificación NEGATIVA — no basta con que el guest de la mesa A reciba su evento; hay que asertar que el guest de la mesa B NO lo recibe (espera acotada con timeout corto, no espera fija larga que infle el suite). Un fallo aquí significa fuga de datos entre mesas: tratar cualquier verde sospechoso revisando que el assert negativo realmente corre.
- **Test 21 (accesibilidad) es estructural, no visual**: debe contar regiones live en el DOM y verificar que hay UNA con `aria-atomic="true"` y mensajes completos. La tentación de poner `aria-live` en cada tarjeta "para que se anuncie" rompe el test y la experiencia de lectores de pantalla.
- **Check 26 (E2E) es la ÚNICA prueba real de rooms + pub/sub + socket juntos**: guest confirma por REST → evento cruza Redis → socket del staff (KDS) lo recibe → PATCH a `READY` → socket del guest recibe `status-changed` de SU mesa → llamado a mesero visible y resoluble. MSW y los mocks de socket.io-client no cubren NADA de esta cadena. La oleada no se cierra sin él.
- **Refactor de `CancelOrder` (test 3) toca código de Oleada 3**: ejecutar el suite de Oleada 3 inmediatamente después. `READY→CANCELLED` ahora es inválido: si algún test viejo asumía otra cosa, se escala — no se edita el test viejo.
- **Test 4 (publish tras commit)**: el orden de las llamadas es el contrato. Inyectar fallo en `save` y verificar cero publicaciones; un publisher que captura antes del `await` da falsos verdes.
- **Test 12 (`connect_error`)**: el middleware JWT del socket debe rechazar en el handshake, no aceptar y desconectar después; el cliente debe recibir `connect_error`, no un `disconnect` posterior.
- **Tests 8–10 (integración pub/sub)**: el suscriptor de test debe suscribirse ANTES de disparar la acción HTTP (suscribir después = mensaje perdido = rojo intermitente). Timeout de captura acotado.
- **Test 15 (tiempo transcurrido)**: usar fake timers o inyectar reloj; depender de `Date.now()` real hace el test frágil a minutos límite.
- **Tests 17/18 (socket en KDS)**: el mock de `socket.io-client` debe capturar los handlers registrados y permitir dispararlos manualmente; un mock que "auto-emite" en la conexión da verdes falsos sobre el render inicial.
- **Concurrencia KDS**: dos eventos seguidos (`created` + `status-changed`) deben dejar la tarjeta en la columna final correcta — el store debe aplicar eventos en orden de llegada sin refetch.
- **Regresión general**: ejecutar los 134 previos tras el Bloque 2 (refactor CancelOrder), Bloque 5 (gateway) y al final. Ningún cambio en ui-components está autorizado en esta oleada.

## 5. Definición de "verde" por bloque

Bloque terminado = sus tests en verde + bloques anteriores en verde + 134 previos en verde + cero `skip`/`todo`/`only` nuevos. Cierre de oleada: 26/26 + checks 24–26 + 134/134 previos = **160/160**.
