# OLEADA 2 — Plan de Ejecución de la Fase Verde (para AGY)

> Estado de partida: 30/30 tests en rojo (stubs que compilan). Oleadas 0+1: 104/104 en verde.
> Este documento NO contiene código. Regla de oro: **los tests no se tocan**; los puertos de `@packages/shared-types/session/` están CONGELADOS; solo se reemplazan stubs por implementación real.

## 1. Orden exacto de resolución de módulos

```
BLOQUE 0  Preparación: config/env + cliente Redis de test        → habilita Suite B
BLOQUE 1  Session: dominio + casos de uso + adaptadores hoja     → tests 1–10 (Suite A)
BLOQUE 2  Session: repositorios Redis + HTTP                     → tests 11–15 (Suite B)
BLOQUE 3  Gateway: filas nuevas + inyección x-session-id         → regresión 104 tests
BLOQUE 4  Client PWA: tokens + sesión guest + páginas Bento      → tests 16–27 (Suite C)
BLOQUE 5  Cierre: E2E real + full suite                          → checks 28–30
```

Justificación:
- **Inside-out**: dominio → aplicación → infraestructura → interfaces → composition root. Nunca al revés.
- Bloque 1 incluye los **adaptadores hoja sin infraestructura** (`JwtGuestTokenIssuer`, `QrcodeGeneratorAdapter`) porque sus tests (8, 9, 10) no necesitan Redis: se verdean junto a sus casos de uso.
- **Bloque 3 (gateway) va antes del PWA aunque el PWA use MSW**: las URLs reales del gateway son el contrato que los handlers MSW replican; fijar primero la fuente de verdad evita verdes falsos en Suite C.
- Bloque 4 puede paralelizarse con el 3 SOLO si los handlers MSW se escriben contra §2.2 del manifiesto, no contra la implementación a medio hacer.
- Dentro de cada suite: un test rojo a la vez → mínimo código → refactor → siguiente.

## 2. Archivos y capas por bloque (secuencia hexagonal)

### BLOQUE 0 — Preparación

1. `services/session/src/config/` — `SESSION_TTL_SECONDS` (default 14400), `PWA_BASE_URL`, `JWT_SECRET`, `REDIS_URL`. Todo por env; nada hardcodeado.
2. `src/infrastructure/redis/client.ts` — factoría de `ioredis` (db0) + helpers de nombres de clave EXACTOS según §1 del manifiesto (`session:{id}`, `tenant:{t}:table:{tb}:session`, etc.). Los tests de integración inspeccionan estas claves: un prefijo distinto = rojo.
3. Redis de test disponible para la Suite B + helper de limpieza (flush de las claves del tenant de test entre tests).

No se escribe dominio aquí. Entregable: config + cliente + helpers de claves.

### BLOQUE 1 — Session, Suite A (tests 1–10)

Secuencia de archivos:

1. `src/domain/` — invariantes y errores de dominio (`QR_KEY_INVALID`, `TABLE_NOT_FOUND`, `TABLE_INACTIVE`, `SESSION_NOT_FOUND`, `SESSION_EXPIRED`, `FORBIDDEN`, `VALIDATION_ERROR`); cálculo `expiresAt = createdAt + ttl`; política de lectura (staff del tenant vs guest con `sessionId` coincidente — alimenta el test 7).
2. `src/application/CreateTable.ts` — soporte de todos los demás (genera `tableId` + `qrKey`).
3. `src/application/OpenTableSession.ts` → tests 1, 2, 3, 4 (idempotencia por mesa aquí; ver riesgo de concurrencia en §4).
4. `src/application/CloseTableSession.ts` → tests 5, 6.
5. `src/application/GetTableSession.ts` → test 7.
6. `src/infrastructure/security/JwtGuestTokenIssuer.ts` → test 8 (adaptador hoja: mismo `JWT_SECRET`, claims exactos, `exp = now + ttl`).
7. `src/infrastructure/qr/QrcodeGeneratorAdapter.ts` → test 9 (formato de URL `/t/{tenantId}/{tableId}?k=...` + `pngDataUrl` con prefijo `data:image/png;base64,`).
8. `src/application/GenerateTableQr.ts` y `src/application/RotateTableQrKey.ts` → tests 9, 10.
9. `src/application/ListTableSessions.ts` — cierra la superficie de puertos (sin test propio en A; lo ejercita B/D).

`application/` y `domain/` NO importan `ioredis`, `qrcode`, `jsonwebtoken` ni Express: solo puertos de shared-types. Los repos siguen siendo los fakes de la fase roja.

### BLOQUE 2 — Session, Suite B (tests 11–15)

Secuencia de archivos:

1. `src/infrastructure/persistence/RedisTableRepository.ts`
2. `src/infrastructure/persistence/RedisTableSessionRepository.ts` — HASH de sesión + puntero + índice, `touch` (sliding), `close` (HSET + DEL puntero + SREM), `listByTenant` con limpieza perezosa de entradas expiradas.
3. `src/interfaces/http/middleware/requireGatewayIdentity.ts` — cabeceras `x-tenant-id`/`x-user-role`/`x-session-id`; ausentes → 401.
4. `src/interfaces/http/middleware/requireStaffRole.ts` — rol ∈ {staff, manager, admin}; escritura de mesas solo {admin, manager} → si no, 403 (test 14).
5. `src/interfaces/http/middleware/errorHandler.ts` — `{ error: { code, message } }`.
6. `src/interfaces/http/tables.routes.ts`, `sessions.routes.ts` (`/sessions/open` pública, sin staff).
7. `src/app.ts` — composition root: construye cliente Redis, repositorios, adaptadores, casos de uso, monta rutas. `index.ts` solo listen.

Tests en orden: 11 (HASH completo + TTL), 12 (puntero creado/eliminado), 13 (aislamiento 404/403), 14 (roles + `open` pública), 15 (expiración real — ver §4).

### BLOQUE 3 — Gateway

1. `services/gateway/src/routes/` — añadir EXACTAMENTE las filas de §2.2 del manifiesto; sustituir `POST /v1/sessions` por `POST /v1/sessions/open` (pública).
2. Middleware de auth: inyectar `x-session-id` cuando el JWT porta claim `sessionId`. Nada más se toca del middleware.
3. Rol `guest` permitido solo en `/v1/graphql` y `GET /v1/sessions/:id`.
4. Ejecutar INMEDIATAMENTE los 104 tests de Oleadas 0+1 + los 30 de Oleada 0 del gateway: todos verdes antes de seguir.

### BLOQUE 4 — Client PWA, Suite C (tests 16–27)

Secuencia de archivos:

1. `apps/client-pwa/src/styles/tokens.css` — overrides de marca de §4.1 del manifiesto (incluye `--bento-touch-target`, `--bento-touch-gap`, safe-area, grid 1→2). Los tests 24 y 25 leen esta hoja: va primero.
2. `src/lib/session.ts` — storage de `{ guestToken, session }` en sessionStorage.
3. `src/lib/api.ts` — fetch al gateway adjuntando el Bearer guest.
4. `src/components/GuestSessionGuard.tsx` → test 18.
5. `src/app/t/[tenantId]/[tableId]/page.tsx` (landing QR) → tests 16, 17.
6. `src/components/` — `TableSessionBadge`, `CategoryChipRail`, `ProductListCard`, `ProductDetailSheet`, `ModifierGroupPicker` → tests 19, 20, 21, 22.
7. `src/app/t/[tenantId]/[tableId]/menu/page.tsx` → tests 19, 23.
8. Cierre transversal: aserciones Bento/a11y (24, 25, 26) y FeatureGuard "Pagar" → `Proximamente` (27).

Los primitivos de `@packages/ui-components` se IMPORTAN tal cual; comportamiento nuevo = composición en el PWA, nunca edición del primitivo. Handlers MSW contra §2.2 del manifiesto; si un handler difiere del manifiesto, se corrige el handler, no el test.

### BLOQUE 5 — Cierre (checks 28–30)

1. Check 28: gateway con filas nuevas activas + 104 tests previos en verde.
2. Check 29: E2E real por gateway — staff crea mesa → obtiene QR → guest abre con la URL del QR → `query categories` vía `/v1/graphql` con guest token devuelve la carta del tenant correcto Y verifica que otro tenant no es visible.
3. Check 30: `pnpm test` completo (session, client-pwa y todo lo anterior) + `pnpm build` de shared-types.

## 3. Restricciones arquitectónicas que AGY NO debe romper

1. **`tenantId` primer parámetro, siempre**, en TODO método de repositorio; nunca desde body del cliente salvo en `/sessions/open` (que es pública y lo valida contra la mesa + `qrKey`).
2. **`qrKey` nunca en DTOs públicos ni logs**: solo `TableRepository.findById` lo devuelve para validación interna; las respuestas HTTP serializan `TableDTO` sin `qrKey`; la URL del QR solo la obtiene staff autenticado.
3. **TTL sliding correcto**: cada lectura/escritura renueva TTL del HASH **y del puntero a la vez** (misma expiración). Prohibido renovar uno y no el otro: puntero eterno con hash expirado (o al revés) rompe los tests 12 y 15.
4. **Guest JWT**: mismo `JWT_SECRET` del sistema, claims exactos `{ sub: "guest:{sessionId}", tenantId, role: "guest", sessionId }`, `exp = now + SESSION_TTL_SECONDS`. Ningún claim extra.
5. **Claves Redis exactas** según §1 del manifiesto — la Suite B las inspecciona directamente.
6. **Apertura idempotente y atómica**: la creación del puntero debe ser atómica (`SET NX` o transacción), o dos escaneos simultáneos del mismo QR crean dos sesiones y rompen los tests 2 y 12.
7. **Hexagonal estricto**: `domain/` y `application/` no importan `ioredis`, `qrcode`, `jsonwebtoken` ni Express. Adaptadores enchufados en `app.ts`.
8. **Primitivos Bento intocables**: el PWA solo inyecta su hoja de tokens; hex/px SOLO en `tokens.css`; acento vibrante SOLO en `KpiValue` del precio; touch targets vía token (44px), no valores sueltos.
9. **FeatureGuard fail-closed intacto**: se USA ("Pagar" → `payments` OFF → `Proximamente`), no se modifica.
10. **Gateway: filas nuevas + `x-session-id`, nada más**; los 104 tests previos verdes tras el cambio, no al final de la oleada.
11. **Contrato de error exacto**: `{ error: { code, message } }` con el vocabulario fijado (`QR_KEY_INVALID`, `TABLE_NOT_FOUND`, `TABLE_INACTIVE`, `SESSION_NOT_FOUND`, `SESSION_EXPIRED`, `FORBIDDEN`, `VALIDATION_ERROR`).
12. **Los tests no se editan.** Un test sospechoso se escala al Planificador.

## 4. Riesgos y dependencias entre tests

- **Suite B depende de Suite A**: los controllers solo cablean casos de uso. Abrir B con A en rojo produce falsos fallos en cascada.
- **Test 15 (expiración TTL) es el de mayor riesgo de flakiness**: contra Redis real NO se usan fake timers (no expiran claves). TTL de test corto (1s) + espera acotada con margen (≥1.2s). No usar `ioredis-mock` para este test: su expiración no replica la real. Mantener la espera mínima para no inflar el suite.
- **Test 12 depende del 11**: el puntero solo existe si `open` persistió bien el HASH. Verdear en orden.
- **Suite C puede dar verdes falsos**: con MSW, el PWA pasa aunque el guest token real falle end-to-end. El check 29 (E2E) es el único que valida la cadena completa `open → guestToken → gateway → x-tenant-id → catálogo`. La oleada NO se cierra sin él.
- **Test 23 (Bearer adjunto)**: el handler MSW debe ASERTAR el header `Authorization`; un handler permisivo da verde falso que solo se detectaría en el E2E.
- **MSW ↔ gateway**: los handlers se escriben contra §2.2 del manifiesto (fuente de verdad), no contra el gateway a medio implementar. Si el gateway y el manifiesto difieren al final del bloque 3, se corrige el handler (nunca el test ni el manifiesto sin escalar).
- **Concurrencia en `open`**: dos escaneos simultáneos del mismo QR sin `SET NX` → dos sesiones activas → tests 2/12 rotos de forma intermitente (el peor tipo de roto).
- **Limpieza perezosa del índice**: `listByTenant` que devuelve sesiones expiradas ("fantasmas") rompe el check 29 tras una expiración; verificar existencia del HASH al listar.
- **Serialización de fechas**: `createdAt/expiresAt/closedAt` viajan como ISO strings en Redis y en DTOs; mezclar epochs e ISO rompe comparaciones de los tests 1, 5 y 11.
- **Regresión ui-components**: el PWA importa primitivos Bento y FeatureGuard; cualquier tentación de "mejorarlos" pasa primero por correr los 104 tests previos. Composición > edición.
- **Aislamiento guest en catálogo**: el E2E (check 29) incluye verificación cruzada de tenants; si Catalog filtrara mal por `x-tenant-id`, aparece aquí aunque la Oleada 1 esté verde — escalar, no parchear Catalog desde esta oleada.

## 5. Definición de "verde" por bloque

Bloque terminado = sus tests en verde + bloques anteriores en verde + 104 tests de Oleadas 0+1 en verde + cero `skip`/`todo`/`only` nuevos. Cierre de oleada: 30/30 + checks 28–30 + 104/104 previos. Total esperado: **134/134**.
