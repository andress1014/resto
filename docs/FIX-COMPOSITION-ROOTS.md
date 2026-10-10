# Fix post-MVP: Composition roots cableados a fakes en memoria

> Hallazgo crítico del 2026-10-06 al probar el MVP (182/182 tests) contra Docker Compose real.
> Plan entregado por Kimi en el pane, transcrito aquí para que no se pierda.

## Diagnóstico confirmado

Los 4 `services/*/src/app.ts` de producción estaban cableados a los repositorios `InMemory*` de `infrastructure/fakes/`, no a los adaptadores reales:

| Servicio | Adaptadores reales | Estado antes del fix |
|---|---|---|
| catalog | PrismaCategoryRepository, PrismaProductRepository, PrismaModifierGroupRepository | Existían, faltaba cablear |
| ordering | PrismaOrderRepository, PrismaPaymentRepository, RedisCartRepository, RedisServiceCallRepository, GraphqlCatalogValidationAdapter, RedisEventPublisher, HttpSessionServiceAdapter | Existían, faltaba cablear |
| identity | NINGUNO (solo BcryptPasswordHasher, JwtTokenIssuer) | Había que IMPLEMENTAR |
| session | NINGUNO (ni `ioredis` instalado) | Había que IMPLEMENTAR |

Causa raíz: ningún Plan de Ejecución Verde de las Oleadas 1-5 exigió recablear el composition root ni un smoke E2E en Docker como criterio de cierre. Los 182 tests nunca lo detectaron porque cada test inyecta sus propios fakes directamente.

`app.ts` hace doble función: composition root de producción Y arnés de tests (seeds hardcodeados en module-scope). Un swap ingenuo rompe la mayoría de los 182 tests — hay que extraer seeds/hooks a helpers de test primero.

## Orden de ejecución: Catalog → Session → Identity → Ordering

### Paso 0 (prerequisito transversal) — Schema en Postgres
1. Generar migraciones reales con `prisma migrate dev` en identity, catalog, ordering (crear `prisma/migrations/`).
2. El arranque del contenedor debe correr `prisma migrate deploy` antes de iniciar Node.
3. Verificar con `docker exec resto_postgres psql -U postgres -d resto_catalog -c '\dt'`.

### Paso 1 — Catalog (solo cableado) ✅ CERRADO 2026-10-06
`createCatalogApp(deps?)`: sin deps instancia PrismaClient + los 3 PrismaRepository reales; con deps usa lo inyectado. Riesgo: IDs ahora los genera Prisma, errores Prisma deben seguir mapeando a códigos de dominio.
**Verificado por el Orquestador:** producto creado vía gateway → visible en `SELECT` directo a Postgres → sobrevive `docker compose restart catalog`.

### Paso 2 — Session (implementar + cablear) — EN CURSO
Implementar `RedisTableRepository` y `RedisTableSessionRepository` en `infrastructure/redis/` contra los puertos de `shared-types`, usando los patrones de `infrastructure/redis/keys.ts`. Agregar `ioredis` a `package.json`. Sacar el seed hardcodeado (`table-1`/`valid-key`) a un helper de test separado.
Riesgos: TTL debe ser `EXPIRE` real sobre el HASH (no fingido); el puntero mesa→sesión debe limpiarse de verdad al cerrar o las mesas quedan "ocupadas" fantasma.

### Paso 3 — Identity (implementar + cablear) — PENDIENTE
Implementar `PrismaTenantRepository`, `PrismaUserRepository`, `PrismaRefreshTokenRepository`. Eliminar defaults fake en constructores de `RegisterTenant.ts`, `Login.ts`, `RefreshSession.ts`, `InviteUser.ts`. Eliminar la fabricación de usuario ficticio en `/identity/me` (debe devolver 404 real).
Riesgos: rotación/revocación de refresh tokens debe respetar expiración real en Postgres; bcrypt es más lento que el fake, puede requerir ajustar timeouts de tests.

### Paso 4 — Ordering (el más delicado, solo cableado pero con extracción previa) — PENDIENTE
PRIMERO mover a un helper de test separado los 8 seeds de órdenes, el seed de service call, el seed de producto, y el middleware de simulación `session-catalog-down` que hoy viven en `app.ts`. DESPUÉS cablear producción con: PrismaOrderRepository + PrismaPaymentRepository, RedisCartRepository + RedisServiceCallRepository + RedisEventPublisher (ioredis **db 1**, no cruzar con el db 0 de session), GraphqlCatalogValidationAdapter. Quitar el `export * from fakes` de `index.ts`.
Riesgos: verificar TTL correcto desde config (no hardcodeado); el test 17 (catálogo caído) debe migrar a un fake inyectado vía deps; verificar que el realtime wiring (RedisEventSubscriber + SocketIoRealtimeEmitter) esté suscrito en el arranque real; eliminar el passthrough inútil en `app.ts` líneas 188-192.

## Criterio de cierre
- **Por servicio:** una escritura vía gateway → fila real en Postgres/Redis por query directa → sobrevive un `docker compose restart <servicio>` (prueba definitiva anti-fake).
- **Global:** repetir el flujo E2E completo (crear producto → abrir sesión → carrito → confirmar pedido) sin `PRODUCT_NOT_FOUND`, y `pnpm -r test` debe seguir en 182/182 con los fakes inyectados explícitamente donde corresponda.

## Fix de infraestructura asociado: Prisma + musl/Alpine
`node:20-alpine` (musl libc) requiere declarar `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` en cada `schema.prisma` — `apk add openssl` solo no basta. Además `apk add --no-cache openssl libc6-compat` en los Dockerfiles, y usar `./node_modules/.bin/prisma` en vez de `npx prisma` en el CMD. **Rebuild con `--no-cache` es obligatorio** tras este fix (la caché de Docker esconde el motor viejo). Verificación: debe existir `libquery_engine-linux-musl-openssl-3.0.x.so.node` dentro del contenedor.
Plan B si esto no basta: cambiar la imagen base a `node:20-slim` (Debian/glibc) y `binaryTargets` a `["native", "debian-openssl-3.0.x"]`.

## Cobertura para que no vuelva a pasar (pendiente de implementar)

**Capa 1 — Guarda estática del composition root:** regla ESLint `no-restricted-imports` en el composition root prohibiendo `**/infrastructure/fakes/**`, + test que audite el grafo de imports real del entrypoint. Convención: separar composition root (`src/main.ts`) de la factory `createXApp(deps)` que los tests usan.

**Capa 2 — Smoke E2E contra Docker Compose en CI:** `docker compose up --profile services` → healthchecks → flujo mínimo por servicio (register/login/refresh, createProduct→query, createTable→open session, cart→confirm) + check de durabilidad (`docker compose restart <svc>` y re-query) + check de persistencia directa (`psql -c "SELECT count(*) FROM ..."`).

**Capa 3 — Proceso:** todo Plan de Ejecución Verde futuro debe incluir obligatoriamente el paso de cableado del composition root y la verificación E2E en Docker como criterio de cierre, no opcional.
