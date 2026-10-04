# OLEADA 1 — Plan de Ejecución de la Fase Verde (para AGY)

> Estado de partida: 44/44 tests en rojo (stubs/DTOs/firmas que compilan). Oleada 0: 30/30 en verde.
> Este documento NO contiene código. Define orden, capas, restricciones y riesgos.
> Regla de oro de la fase: **los tests no se tocan**. Solo se reemplazan stubs por implementación real. Los puertos de `@packages/shared-types` están CONGELADOS: sus firmas no cambian.

## 1. Orden exacto de resolución de módulos

```
BLOQUE 0  Infraestructura Prisma (ambos servicios)        → habilita check 45
BLOQUE 1  Identity: dominio + casos de uso (Suite A)      → tests 1–10
BLOQUE 2  Identity: adaptadores + HTTP (Suite B)          → tests 11–15
BLOQUE 3  Catalog: dominio + casos de uso (Suite C)       → tests 16–23
BLOQUE 4  Catalog: adaptadores + GraphQL (Suite D)        → tests 24–28
BLOQUE 5  ui-components: tokens + primitivos Bento        → tests 37–40, 43, 44 (nivel primitivo)
BLOQUE 6  Admin Dashboard: api client + páginas           → tests 29–36, luego 41–42
BLOQUE 7  Cierre: gateway (1 fila), E2E, full suite       → checks 46–48 + regresión Oleada 0
```

Justificación del orden:
- **Inside-out siempre**: dominio puro (síncrono) → aplicación (casos de uso contra puertos) → infraestructura (adaptadores) → interfaces (HTTP/GraphQL) → composition root. Nunca al revés.
- Identity antes que Catalog porque su contrato de JWT/headers es prerequisito conceptual del contexto de Catalog y del E2E (bloque 7).
- **Bloque 5 antes que Bloque 6** (¡atención, no es el orden numérico de los tests!): los tests 32 y 36 de la Suite E.1 asertan `data-component="bento-card"/"bento-grid"`, así que las páginas no pueden ponerse en verde sin los primitivos. Se resuelve antes el nivel primitivo de E.2, luego E.1, y por último los tests 41–42 que observan componentes ya montados (`ProductCard`).
- Bloques 1–2 y 3–4 son paralelizables entre personas tras el bloque 0; el bloque 6 (con MSW) también es paralelizable una vez terminado el 5.
- Dentro de cada suite: **un test rojo a la vez** → mínimo código para verde → refactor → siguiente. No adelantar implementación de tests posteriores.

## 2. Archivos y capas por bloque (secuencia hexagonal)

### BLOQUE 0 — Infra Prisma (identity + catalog)

1. `services/identity/prisma/schema.prisma` — tal cual §1.1 del manifiesto (Tenant, User, RefreshToken, enums).
2. `services/catalog/prisma/schema.prisma` — tal cual §1.2 (Category, Product, ModifierGroup, ModifierOption, ProductModifierGroup).
3. Migraciones iniciales de cada servicio (`prisma migrate dev`) y verificación de check 45 (`migrate deploy` limpio sobre `resto_identity` y `resto_catalog`).
4. Generación de los DOS Prisma client, uno por servicio, cada uno apuntando a su propia `DATABASE_URL`.
5. Utilidades de test: helper para levantar/limpiar la DB de test por suite (truncate entre tests), sin tocar aún lógica de negocio.

No se escribe ninguna línea de dominio aquí. Entregable del bloque: DBs migradas y clients generados.

### BLOQUE 1 — Identity, Suite A (tests 1–10)

Secuencia de archivos:

1. `src/domain/` — entidades y reglas puras y síncronas: validación de password (≥8), formato/normalización de slug, invariantes de User/Tenant. Aquí viven los errores de dominio (`EMAIL_TAKEN`, `SLUG_TAKEN`, `VALIDATION_ERROR`, `INVALID_CREDENTIALS`) como tipos, mapeados desde `shared-types/common/errors.ts`.
2. `src/application/RegisterTenant.ts` → tests 1, 2, 3, 4.
3. `src/application/Login.ts` → tests 5, 6.
4. `src/application/RefreshSession.ts` → tests 7, 8.
5. `src/application/InviteUser.ts` → tests 9, 10.

Cada caso de uso depende SOLO de los puertos de `@packages/shared-types/identity/ports` y se prueba contra los fakes en memoria que ya existen de la fase roja. En este bloque NO se importa Prisma, bcrypt ni jsonwebtoken en `application/`: los puertos `PasswordHasher`/`TokenIssuer` siguen mockeados. Orden interno recomendado: RegisterTenant primero (crea el vocabulario), luego Login, luego RefreshSession (su semántica de rotación alimenta el test 8), luego InviteUser.

### BLOQUE 2 — Identity, Suite B (tests 11–15)

Secuencia de archivos:

1. `src/infrastructure/persistence/PrismaTenantRepository.ts`
2. `src/infrastructure/persistence/PrismaUserRepository.ts`
3. `src/infrastructure/persistence/PrismaRefreshTokenRepository.ts`
4. `src/infrastructure/security/BcryptPasswordHasher.ts`
5. `src/infrastructure/security/JwtTokenIssuer.ts` (HS256, `JWT_SECRET`, 15 min, claims `sub/tenantId/role/email`)
6. `src/interfaces/http/middleware/requireGatewayIdentity.ts` — lee `x-user-id`/`x-tenant-id`/`x-user-role`; ausentes → 401.
7. `src/interfaces/http/middleware/errorHandler.ts` — mapea errores de dominio a `{ error: { code, message } }` (test 14).
8. `src/interfaces/http/auth.routes.ts` (register/login/refresh/logout) y `src/interfaces/http/identity.routes.ts` (me, users).
9. `src/app.ts` — composition root: instancia Prisma client, construye adaptadores, inyecta en casos de uso, monta rutas. `index.ts` solo hace listen.

Tests en orden: 11 (persistencia + hash), 12 (JWT verificable), 13 (cabeceras → 200/401), 14 (contrato de error), 15 (rol → 403/201).

### BLOQUE 3 — Catalog, Suite C (tests 16–23)

Secuencia de archivos:

1. `src/domain/` — invariantes: precio ≥ 0 (test 17), `maxSelections ≥ minSelections` (test 21), regla `CATEGORY_NOT_EMPTY` (test 20).
2. `src/application/` casos de uso, en este orden: `CreateCategory` (16), `CreateProduct` (17, 18), `UpdateProduct` (19), `DeleteCategory` (20), `CreateModifierGroup` (21), `AttachModifierGroup` (22), `SetProductAvailability` (23).

Misma disciplina que Identity: solo puertos de `shared-types/catalog/ports` + fakes en memoria. El aislamiento de tenant se ejercita aquí con fakes (test 19) para que en el bloque 4 sea imposible saltárselo.

### BLOQUE 4 — Catalog, Suite D (tests 24–28)

Secuencia de archivos:

1. `src/infrastructure/persistence/PrismaCategoryRepository.ts`
2. `src/infrastructure/persistence/PrismaProductRepository.ts` (incluye `attach/detachModifierGroup`, `setAvailability`)
3. `src/infrastructure/persistence/PrismaModifierGroupRepository.ts` (incluye `addOption/removeOption`)
4. `src/interfaces/graphql/context.ts` — construye `{ tenantId, userId, role }` EXCLUSIVAMENTE desde cabeceras `x-*`; ausente `x-tenant-id` → error `UNAUTHENTICATED` (test 27).
5. `src/interfaces/graphql/typeDefs.ts` — SDL tal cual §2.2 del manifiesto.
6. `src/interfaces/graphql/resolvers.ts` — delegan en casos de uso; mapean errores de dominio a `extensions.code` (test 28).
7. `src/app.ts` — composition root (Apollo + Express).

Ojo con la serialización: `price`/`priceDelta` son `Decimal` en Prisma y `Float` en GraphQL — convertir en la capa de infraestructura, nunca devolver el objeto Decimal crudo al resolver.

### BLOQUE 5 — ui-components Bento (tests 37–40, 43, 44 a nivel primitivo)

Secuencia de archivos:

1. `packages/ui-components/src/bento/tokens.css` — TODAS las custom properties de §E.1 del manifiesto (incluye media queries de breakpoints 4→2→1 y de `prefers-reduced-motion`). Tests 39, 40, 44 leen esta hoja.
2. `packages/ui-components/src/bento/BentoGrid.tsx` → test 37.
3. `packages/ui-components/src/bento/BentoCard.tsx` → tests 38, 43.
4. `packages/ui-components/src/bento/KpiValue.tsx` → prepara el 41.
5. `packages/ui-components/src/bento/AvailabilityToggle.tsx` → prepara el 34.
6. `packages/ui-components/src/index.ts` — exportar los primitivos.

Regla: los componentes referencian `var(--bento-*)`; el único archivo con valores hex/px es `tokens.css`.

### BLOQUE 6 — Admin Dashboard (tests 29–36, luego 41–42)

Secuencia de archivos:

1. `apps/admin-dashboard/src/lib/api.ts` — fetch client al gateway: adjunta Bearer, ante 401 un único refresh vía `POST /v1/auth/refresh` (test 31). Primero, porque todas las páginas dependen de él.
2. `src/lib/auth.ts` (o equivalente) — almacenamiento de tokens y guard de rutas (test 35).
3. `src/app/(auth)/login/page.tsx` → test 31.
4. `src/app/onboarding/page.tsx` → tests 29, 30.
5. `src/components/` — `AppShell`, `CategoryCard`, `ProductCard`, `ModifierGroupCard`, `MenuToolbar`, montados sobre los primitivos del bloque 5.
6. `src/app/(panel)/menu/page.tsx` → tests 32, 33, 34, 36.
7. Cierre de E.2 a nivel componente: tests 41 (acento solo en `KpiValue` del precio en `ProductCard`) y 42 (iconos `aria-hidden`, sin `<img>` sin `alt`, sin emojis).

Los handlers MSW de la fase roja son el contrato: las URLs deben ser exactamente las del gateway (`/v1/auth/register`, `/v1/graphql`, etc.). Si un handler y el manifiesto difieren, se corrige el handler, no el test ni el manifiesto.

### BLOQUE 7 — Cierre (checks 46–48)

1. Añadir la ÚNICA fila nueva al gateway: `POST /v1/identity/users` (token + rol `admin`) en `services/gateway/src/routes/`. Inmediatamente después, correr los 30 tests de Oleada 0: deben seguir 30/30 en verde.
2. Check 46: regla de imports (lint o test) que prohíbe imports cruzados entre los Prisma client de identity y catalog.
3. Check 47: E2E real `register → login → createCategory → query categories` a través del gateway.
4. Check 48: `pnpm test` completo (identity, catalog, admin-dashboard, ui-components) + `pnpm build` de shared-types.

## 3. Restricciones arquitectónicas que AGY NO debe romper

1. **Desacoplamiento físico identity ↔ catalog**: prohibido importar el Prisma client del otro servicio, prohibido que catalog toque `resto_identity`. `tenantId` en catalog es un `String` plano sin FK (check 46 lo vigila).
2. **`tenantId` como primer parámetro, siempre**: en TODO método de repositorio. Jamás desde body, input GraphQL o query param: solo de `x-tenant-id` (gateway) → contexto. El test 26 (aislamiento total) y el 19 fallan si una sola query olvida el filtro.
3. **Los tests no se editan.** Si un test parece incorrecto, se escala al Planificador; no se "arregla" el test.
4. **Puertos congelados**: las firmas de `shared-types` (§3 del manifiesto) no cambian. La implementación se adapta al puerto, no al revés.
5. **Contratos de error exactos**: identity responde `{ error: { code, message } }`; GraphQL usa `extensions.code` con el vocabulario fijado (`UNAUTHENTICATED`, `BAD_USER_INPUT`, `NOT_FOUND`, `CONFLICT`, `CATEGORY_NOT_EMPTY`). Inventar códigos nuevos rompe tests.
6. **Seguridad**: `passwordHash` nunca sale en ningún DTO/serialización (test 5); `INVALID_CREDENTIALS` idéntico para email inexistente y password erróneo (test 6); refresh token siempre persistido hasheado; rotación atómica (revocar el anterior al emitir el nuevo, test 7).
7. **Bento sin excepciones**: hex/px SOLO en `tokens.css` (tests 37–39); acento vibrante SOLO en `KpiValue` (41); iconos SVG con `aria-hidden`, cero emojis (42); foco visible vía token (43); `prefers-reduced-motion` respetado (44).
8. **FeatureGuard fail-closed intacto**: no tocar su lógica de Oleada 0; en el dashboard solo se USA (`<FeatureGuard flag="analytics">` con `Proximamente` dentro de una `BentoCard`). Los 30 tests de Oleada 0 deben permanecer verdes tras cualquier cambio en ui-components.
9. **Gateway: una fila y nada más**: no reordenar rutas existentes, no cambiar contratos de Oleada 0.
10. **Hexagonal estricto**: `domain/` y `application/` no importan Prisma, bcrypt, Express ni Apollo. Las dependencias apuntan hacia adentro; los adaptadores se enchufan en el composition root (`app.ts`).

## 4. Riesgos y dependencias entre tests

- **Suite D depende de Suite C**: los resolvers solo cablean casos de uso; empezar D con C en rojo produce falsos fallos en cascada. No abrir D hasta tener 16–23 en verde.
- **Suite E.1 depende parcialmente de E.2**: tests 32 y 36 asertan `data-component` de primitivos Bento → bloque 5 antes que bloque 6. A la inversa, los tests 41–42 (E.2 nivel componente) dependen de `ProductCard`/`AppShell` del bloque 6: cerrarlos AL FINAL del bloque 6, no en el 5.
- **Test 7 (rotación) alimenta al 8**: si la revocación no es atómica, el 8 puede pasar "por accidente" con datos de test aislados y fallar en concurrencia real. Implementar revocar+emitir en una sola operación lógica.
- **Test 26 (aislamiento) es el de mayor riesgo silencioso**: un solo resolver que filtre mal deja pasar datos entre tenants. Defensa: el filtro `tenantId` vive en la capa de repositorio (puerto lo exige como primer parámetro), no en cada resolver.
- **Decimal → Float**: Prisma devuelve `Decimal`; GraphQL espera `Float`. Convertir en infraestructura (riesgo de serializar `"12.50"` como string y romper tests 25 y 33).
- **MSW ↔ contrato del gateway**: los handlers de E.1 deben usar las URLs exactas `/v1/...`; un desfase aquí da verdes falsos que el E2E (check 47) destapará tarde.
- **JWT en E2E**: el `JWT_SECRET` con el que identity firma (bloque 2) debe ser el mismo con el que el gateway verifica (Oleada 0) en el check 47. Configurarlo vía `.env`, nunca hardcodeado.
- **Regresión Oleada 0**: cualquier cambio en `@packages/ui-components` (bloque 5) puede romper los tests de `featureFlags`/`FeatureGuard`. Ejecutar el suite de Oleada 0 tras los bloques 5, 6 y 7 — no solo al final.
- **Check 45 antes de Suite B/D**: las integraciones con DB necesitan migraciones aplicadas; un schema a medias da errores de Prisma que parecen fallos de negocio y despistan.
- **Test 14 y 28 (contratos de error) transversales**: conviene verdearlos temprano dentro de sus bloques (middleware de errores antes que el último endpoint), porque cada endpoint nuevo los re-ejecuta.

## 5. Definición de "verde" por bloque

Un bloque solo se da por terminado cuando: (a) sus tests están en verde, (b) los tests de bloques anteriores siguen en verde, (c) los 30 de Oleada 0 siguen en verde, y (d) no hay `skip`/`todo`/`only` nuevos en el código de test. La oleada se cierra con 44/44 + checks 45–48 + 30/30 de Oleada 0.
