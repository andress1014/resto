# Diccionario de Dominio — Contratos API y Eventos

## API Gateway (Oleada 0 — implementado, base pública `http://localhost:4000/v1`)

| Ruta | Auth | Destino |
|---|---|---|
| POST /v1/auth/{register,login,refresh} | pública | identity:4001 |
| POST /v1/auth/logout | token | identity:4001 |
| GET /v1/identity/me | token | identity:4001 |
| GET/PATCH /v1/identity/users/:id | token+admin | identity:4001 |
| ANY /v1/graphql | token | catalog:4002 |
| POST/GET /v1/sessions, GET/PATCH /v1/sessions/:id | token | session:4003 |
| POST/GET /v1/orders, GET /v1/orders/:id | token | ordering:4004 |
| PATCH /v1/orders/:id/status | token+staff/admin | ordering:4004 |
| WS /socket.io (ns /orders) | token en handshake | ordering:4004 |
| GET /health | pública | agregado de los 7 servicios/dependencias |

Error uniforme: `{ "error": { "code", "message" } }`. Detalle completo en `docs/OLEADA-0-MANIFIESTO.md`.

## FeatureGuard (`@packages/ui-components`, Oleada 0 — implementado)

- Puerto `FeatureFlagProvider` con `isEnabled(flag)` / `getAll()`.
- Adaptadores: `StaticFeatureFlagProvider`, `EnvFeatureFlagProvider` (lee `NEXT_PUBLIC_FEATURE_FLAGS`).
- `<FeatureGuard flag fallback?>` — fail-closed, placeholder `<Proximamente>` por defecto.

## Identity Service (Oleada 1 — implementado, REST upstream `:4001`)

| Ruta | Auth | Body → Respuesta |
|---|---|---|
| POST /auth/register | pública | `RegisterTenantRequest` → `201 RegisterTenantResult` |
| POST /auth/login | pública | `{email,password,tenantSlug?}` → `200 AuthTokens+UserDTO` |
| POST /auth/refresh | pública | `{refreshToken}` → `200 AuthTokens` (rotación) |
| POST /auth/logout | token | `{refreshToken}` → `204` |
| GET /identity/me | token | → `200 UserDTO` |
| POST /identity/users | token+admin | `{email,displayName,role}` → `201 UserDTO` |
| GET/PATCH /identity/users/:id | token+admin | → `UserDTO` (mismo tenant) |

JWT acceso 15 min, claims `sub/tenantId/role/email`. Errores: `VALIDATION_ERROR`, `EMAIL_TAKEN`, `SLUG_TAKEN`, `INVALID_CREDENTIALS`, `TOKEN_EXPIRED`, `FORBIDDEN`, `NOT_FOUND`.

## Catalog Service (Oleada 1 — implementado, GraphQL vía `/v1/graphql`)

Tipos: `Category`, `Product`, `ModifierGroup`, `ModifierOption`. Queries: `categories`, `category(id)`, `products(categoryId,onlyAvailable)`, `product(id)`, `modifierGroups`. Mutations: CRUD completo de categorías/productos/modifiers + `attachModifierGroup`/`detachModifierGroup` (idempotentes) + `setProductAvailability`. Contexto Apollo construido solo desde `x-tenant-id`/`x-user-id`/`x-user-role`; sin `x-tenant-id` → `UNAUTHENTICATED`. Errores con `extensions.code` ∈ {`BAD_USER_INPUT`,`NOT_FOUND`,`CONFLICT`,`CATEGORY_NOT_EMPTY`}.

## Session Service (Oleada 2 — implementado, REST upstream `:4003`, Redis db0)

| Ruta | Quien | Contrato |
|---|---|---|
| POST /tables | staff admin/manager | `{label}` → `201 TableDTO` |
| GET /tables | staff | → `TableDTO[]` |
| PATCH /tables/:tableId | staff admin/manager | → `TableDTO` |
| GET /tables/:tableId/qr | staff | → `QrCodeResult{url,pngDataUrl}` |
| POST /tables/:tableId/qr/rotate | staff admin/manager | → nuevo `QrCodeResult` |
| POST /sessions/open | pública | `{tenantId,tableId,qrKey}` → `{session,guestToken}` (idempotente) |
| GET /sessions/:id | staff o guest propio | → `TableSessionDTO` |
| PATCH /sessions/:id/close | staff | → `TableSessionDTO` (idempotente) |

Guest JWT: `{sub:"guest:{sessionId}", tenantId, role:"guest", sessionId}`, mismo `JWT_SECRET` del sistema. Claves Redis: `table:{tenantId}:{tableId}`, `session:{sessionId}`, `tenant:{tenantId}:table:{tableId}:session` (puntero), TTL sliding 4h. Errores: `QR_KEY_INVALID`, `TABLE_NOT_FOUND`, `TABLE_INACTIVE`, `SESSION_NOT_FOUND`, `SESSION_EXPIRED`, `FORBIDDEN`.

## Puertos (`@packages/shared-types`, Oleada 1)

- Identity: `TenantRepository`, `UserRepository`, `RefreshTokenRepository`, `PasswordHasher`, `TokenIssuer` + casos de uso `RegisterTenantUseCase`, `LoginUseCase`, `RefreshSessionUseCase`, `InviteUserUseCase`.
- Catalog: `CategoryRepository`, `ProductRepository`, `ModifierGroupRepository` — `tenantId` como primer parámetro en todos los métodos.

---

Formato esperado por entrada, a completar por Kimi antes de cada oleada:

## [Nombre del contrato]
- **Tipo:** REST / GraphQL / Evento
- **Servicio emisor / dueño:**
- **Servicios consumidores:**
- **Payload / schema:**
- **Casos de prueba asociados:**
