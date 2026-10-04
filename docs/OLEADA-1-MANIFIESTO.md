# OLEADA 1 — Manifiesto Técnico: Core SaaS y Catálogo

> Entregable del Planificador. Arquitectura, contratos e interfaces únicamente.
> PROHIBIDO implementar: AGY inicia Fase Roja con los tests de la sección 5.

## 0. Decisiones y reconciliación con Oleada 0

- **Bases de datos**: la directiva las llama `identity_db` y `catalog_db`; la Oleada 0 ya creó `resto_identity` y `resto_catalog` en `infra/postgres/init/00-create-databases.sql`. Se mantienen los nombres de Oleada 0 (`resto_identity`, `resto_catalog`) para no tocar infraestructura ya operativa. Mapeo: `identity_db` ≡ `resto_identity`, `catalog_db` ≡ `catalog_db` ≡ `resto_catalog`. Si se prefiere renombrar, es una línea del init script — decisión del usuario, no bloqueante.
- **ORM**: Prisma 5 por servicio. Cada servicio tiene su propio `schema.prisma`, su propio `@prisma/client` generado y sus propias migraciones. Ningún schema referencia tablas del otro: las referencias cruzadas (p. ej. `tenantId` en catálogo) son **columnas String planas**, acoplamiento lógico, nunca físico.
- **Auth**: access JWT (15 min, claims `sub`, `tenantId`, `role`, `email`) + refresh token opaco rotativo persistido hasheado. El gateway sigue verificando con `JWT_SECRET` compartido (JWKS queda para oleada posterior).
- **Tenancy**: `tenantId` NUNCA viaja en body ni en input GraphQL. Lo inyecta el gateway como `x-tenant-id` desde el claim del JWT. Los servicios lo leen de cabecera/contexto y lo aplican en TODA consulta.

## 1. Esquemas de datos (Prisma)

### 1.1 Identity — `services/identity/prisma/schema.prisma` → DB `resto_identity`

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("IDENTITY_DATABASE_URL") }

enum TenantStatus { ACTIVE SUSPENDED }
enum Role { ADMIN MANAGER STAFF CUSTOMER }
enum UserStatus { ACTIVE INVITED SUSPENDED }

model Tenant {
  id        String       @id @default(uuid())
  name      String
  slug      String       @unique
  status    TenantStatus @default(ACTIVE)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
  users     User[]
}

model User {
  id            String         @id @default(uuid())
  tenantId      String
  tenant        Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  email         String
  passwordHash  String
  displayName   String
  role          Role           @default(ADMIN)
  status        UserStatus     @default(ACTIVE)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  refreshTokens RefreshToken[]
  @@unique([tenantId, email])
  @@index([email])
}

model RefreshToken {
  id        String    @id @default(uuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())
  @@index([userId])
}
```

Reglas: `passwordHash` jamás sale del servicio; `RefreshToken` guarda hash, nunca el token en claro; borrado de tenant en cascada sobre users y tokens.

### 1.2 Catalog — `services/catalog/prisma/schema.prisma` → DB `resto_catalog`

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("CATALOG_DATABASE_URL") }

model Category {
  id        String    @id @default(uuid())
  tenantId  String    // referencia LÓGICA a identity.Tenant — sin FK física
  name      String
  sortOrder Int       @default(0)
  isActive  Boolean   @default(true)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  products  Product[]
  @@unique([tenantId, name])
  @@index([tenantId])
}

model Product {
  id             String                 @id @default(uuid())
  tenantId       String                 // referencia lógica, sin FK
  categoryId     String
  category       Category               @relation(fields: [categoryId], references: [id])
  name           String
  description    String?
  price          Decimal                @db.Decimal(10, 2)
  imageUrl       String?
  isAvailable    Boolean                @default(true)
  sortOrder      Int                    @default(0)
  createdAt      DateTime               @default(now())
  updatedAt      DateTime               @updatedAt
  modifierGroups ProductModifierGroup[]
  @@index([tenantId, categoryId])
}

model ModifierGroup {
  id            String                 @id @default(uuid())
  tenantId      String                 // referencia lógica, sin FK
  name          String                 // ej. "Extras", "Quitar ingredientes"
  minSelections Int                    @default(0)
  maxSelections Int                    @default(1)
  isRequired    Boolean                @default(false)
  options       ModifierOption[]
  products      ProductModifierGroup[]
  @@index([tenantId])
}

model ModifierOption {
  id         String        @id @default(uuid())
  groupId    String
  group      ModifierGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  name       String        // ej. "Sin cebolla"
  priceDelta Decimal       @default(0) @db.Decimal(10, 2)
  isDefault  Boolean       @default(false)
  @@index([groupId])
}

model ProductModifierGroup {
  productId String
  groupId   String
  product   Product       @relation(fields: [productId], references: [id], onDelete: Cascade)
  group     ModifierGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  @@id([productId, groupId])
}
```

**Garantía de desacoplamiento físico**: los únicos campos que aluden a identity son `tenantId String` sin `relation`. Un check de cierre (test 38) verifica que no exista import cruzado entre los Prisma client de ambos servicios.

## 2. Contratos API

### 2.1 Identity Service (REST, upstream :4001)

| Método + path upstream | Gateway público | Auth | Body → Respuesta |
|---|---|---|---|
| POST `/auth/register` | POST `/v1/auth/register` | pública | `RegisterTenantRequest` → `201 RegisterTenantResult` |
| POST `/auth/login` | POST `/v1/auth/login` | pública | `{ email, password, tenantSlug? }` → `200 AuthTokens + UserDTO` |
| POST `/auth/refresh` | POST `/v1/auth/refresh` | pública | `{ refreshToken }` → `200 AuthTokens` (rotación: el anterior queda revocado) |
| POST `/auth/logout` | POST `/v1/auth/logout` | token | `{ refreshToken }` → `204` |
| GET `/identity/me` | GET `/v1/identity/me` | headers gateway | → `200 UserDTO` |
| POST `/identity/users` | POST `/v1/identity/users` ⚠️ fila nueva en tabla del gateway | token + rol `admin` | `{ email, displayName, role: manager\|staff }` → `201 UserDTO` |
| GET/PATCH `/identity/users/:id` | GET/PATCH `/v1/identity/users/:id` | token + rol `admin` | → `UserDTO` (solo del mismo tenant) |
| GET `/health` | (agregado en `/health`) | interna | `{ status: 'ok' }` |

⚠️ Cambio sobre Oleada 0: añadir UNA fila a `services/gateway/src/routes/`: `POST /v1/identity/users` → identity, protegida, rol `admin`. Nada más cambia en el gateway.

DTOs de registro (viven en `@packages/shared-types`, ver §3):
```ts
RegisterTenantRequest  { restaurantName, slug?, adminEmail, adminPassword, adminDisplayName }
RegisterTenantResult   { tenant: TenantDTO, user: UserDTO, tokens: AuthTokens }
AuthTokens             { accessToken, refreshToken, expiresIn }
```

JWT de acceso: `{ sub: userId, tenantId, role, email, iat, exp }`, HS256 con `JWT_SECRET`, 15 min.
Errores: contrato de Oleada 0 `{ error: { code, message } }` — códigos: `VALIDATION_ERROR`, `EMAIL_TAKEN`, `SLUG_TAKEN`, `INVALID_CREDENTIALS` (idéntico para email inexistente y password erróneo), `TOKEN_EXPIRED`, `FORBIDDEN`, `NOT_FOUND`.

### 2.2 Catalog Service (GraphQL, upstream :4002/graphql, vía `ANY /v1/graphql`)

Contexto Apollo: `{ tenantId, userId, role }` construido EXCLUSIVAMENTE desde `x-tenant-id`/`x-user-id`/`x-user-role`. Sin cabecera → error `UNAUTHENTICATED`.

```graphql
type Category   { id, name, sortOrder, isActive, products: [Product!]! }
type Product    { id, name, description, price: Float!, imageUrl, isAvailable, sortOrder,
                  category: Category!, modifierGroups: [ModifierGroup!]! }
type ModifierGroup { id, name, minSelections, maxSelections, isRequired, options: [ModifierOption!]! }
type ModifierOption { id, name, priceDelta: Float!, isDefault }

type Query {
  categories: [Category!]!
  category(id: ID!): Category
  products(categoryId: ID, onlyAvailable: Boolean): [Product!]!
  product(id: ID!): Product
  modifierGroups: [ModifierGroup!]!
}

type Mutation {
  createCategory(input: CreateCategoryInput!): Category!
  updateCategory(id: ID!, input: UpdateCategoryInput!): Category!
  deleteCategory(id: ID!): Boolean!                       # falla si tiene productos (CATEGORY_NOT_EMPTY)
  createProduct(input: CreateProductInput!): Product!
  updateProduct(id: ID!, input: UpdateProductInput!): Product!
  deleteProduct(id: ID!): Boolean!
  setProductAvailability(id: ID!, isAvailable: Boolean!): Product!
  createModifierGroup(input: CreateModifierGroupInput!): ModifierGroup!
  updateModifierGroup(id: ID!, input: UpdateModifierGroupInput!): ModifierGroup!
  deleteModifierGroup(id: ID!): Boolean!
  addModifierOption(groupId: ID!, input: AddModifierOptionInput!): ModifierOption!
  removeModifierOption(id: ID!): Boolean!
  attachModifierGroup(productId: ID!, groupId: ID!): Product!    # idempotente
  detachModifierGroup(productId: ID!, groupId: ID!): Product!
}

input CreateCategoryInput  { name: String!, sortOrder: Int }
input UpdateCategoryInput  { name: String, sortOrder: Int, isActive: Boolean }
input CreateProductInput   { categoryId: ID!, name: String!, description: String, price: Float!,
                             imageUrl: String, sortOrder: Int }
input UpdateProductInput   { name: String, description: String, price: Float, imageUrl: String,
                             categoryId: ID, sortOrder: Int }
input CreateModifierGroupInput { name: String!, minSelections: Int, maxSelections: Int, isRequired: Boolean }
input UpdateModifierGroupInput { name: String, minSelections: Int, maxSelections: Int, isRequired: Boolean }
input AddModifierOptionInput   { name: String!, priceDelta: Float, isDefault: Boolean }
```

TODAS las queries/mutations filtran por `context.tenantId` en la capa de repositorio. Errores GraphQL con `extensions.code`: `UNAUTHENTICATED`, `BAD_USER_INPUT`, `NOT_FOUND`, `CONFLICT`, `CATEGORY_NOT_EMPTY`.

## 3. Puertos y adaptadores — `@packages/shared-types`

Nuevos módulos (todo interfaces y DTOs, cero implementación):

```
packages/shared-types/src/
├── index.ts
├── common/
│   ├── UseCase.ts          # interface UseCase<I, O> { execute(input: I): Promise<O> }
│   └── errors.ts           # DomainError + códigos compartidos
├── identity/
│   ├── dtos.ts             # TenantDTO, UserDTO, AuthTokens, RegisterTenantRequest/Result, AccessTokenClaims
│   └── ports.ts
└── catalog/
    ├── dtos.ts             # CategoryDTO, ProductDTO, ModifierGroupDTO, ModifierOptionDTO
    └── ports.ts
```

### 3.1 Puertos de Identity

```ts
export interface TenantRepository {
  findById(id: string): Promise<TenantDTO | null>;
  findBySlug(slug: string): Promise<TenantDTO | null>;
  save(tenant: TenantDTO): Promise<TenantDTO>;
}
export interface UserRepository {
  findById(id: string): Promise<UserDTO | null>;
  findByEmail(tenantId: string, email: string): Promise<UserDTO | null>;
  listByTenant(tenantId: string): Promise<UserDTO[]>;
  save(user: UserDTO & { passwordHash: string }): Promise<UserDTO>;
}
export interface RefreshTokenRepository {
  save(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findValidByHash(tokenHash: string): Promise<{ id: string; userId: string } | null>;
  revoke(id: string): Promise<void>;
}
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}
export interface TokenIssuer {
  issueAccessToken(claims: Omit<AccessTokenClaims, 'iat' | 'exp'>): string;
  generateRefreshToken(): { raw: string; hash: string };
}

// Casos de uso (firmas)
export type RegisterTenantUseCase = UseCase<RegisterTenantRequest, RegisterTenantResult>;
export type LoginUseCase          = UseCase<{ email: string; password: string; tenantSlug?: string }, { user: UserDTO; tokens: AuthTokens }>;
export type RefreshSessionUseCase = UseCase<{ refreshToken: string }, AuthTokens>;
export type InviteUserUseCase     = UseCase<{ tenantId: string; email: string; displayName: string; role: 'MANAGER' | 'STAFF' }, UserDTO>;
```

Adaptadores (los implementa AGY en `services/identity/src/infrastructure/`): `PrismaTenantRepository`, `PrismaUserRepository`, `PrismaRefreshTokenRepository`, `BcryptPasswordHasher`, `JwtTokenIssuer`.

### 3.2 Puertos de Catalog

```ts
export interface CategoryRepository {
  listByTenant(tenantId: string): Promise<CategoryDTO[]>;
  findById(tenantId: string, id: string): Promise<CategoryDTO | null>;
  save(tenantId: string, category: CategoryDTO): Promise<CategoryDTO>;
  delete(tenantId: string, id: string): Promise<void>;
  hasProducts(tenantId: string, id: string): Promise<boolean>;
}
export interface ProductRepository {
  listByTenant(tenantId: string, filter?: { categoryId?: string; onlyAvailable?: boolean }): Promise<ProductDTO[]>;
  findById(tenantId: string, id: string): Promise<ProductDTO | null>;
  save(tenantId: string, product: ProductDTO): Promise<ProductDTO>;
  delete(tenantId: string, id: string): Promise<void>;
  setAvailability(tenantId: string, id: string, isAvailable: boolean): Promise<ProductDTO>;
  attachModifierGroup(tenantId: string, productId: string, groupId: string): Promise<void>;
  detachModifierGroup(tenantId: string, productId: string, groupId: string): Promise<void>;
}
export interface ModifierGroupRepository {
  listByTenant(tenantId: string): Promise<ModifierGroupDTO[]>;
  findById(tenantId: string, id: string): Promise<ModifierGroupDTO | null>;
  save(tenantId: string, group: ModifierGroupDTO): Promise<ModifierGroupDTO>;
  delete(tenantId: string, id: string): Promise<void>;
  addOption(tenantId: string, groupId: string, option: ModifierOptionDTO): Promise<ModifierOptionDTO>;
  removeOption(tenantId: string, optionId: string): Promise<void>;
}
```

Obsérvese: `tenantId` es primer parámetro de TODOS los métodos — el aislamiento multi-tenant se fuerza por contrato, no por convención.

## 4. Estructura interna de los servicios y del dashboard

```
services/identity/src/
├── index.ts, app.ts
├── config/
├── domain/                 # entidades y reglas (password ≥ 8, slug formato, etc.)
├── application/            # casos de uso (dependen solo de ports de shared-types)
├── infrastructure/         # adaptadores Prisma/bcrypt/jwt
└── interfaces/http/        # controllers + rutas Express

services/catalog/src/
├── index.ts, app.ts
├── domain/, application/
├── infrastructure/         # adaptadores Prisma
└── interfaces/graphql/     # SDL + resolvers (delegan en casos de uso)

apps/admin-dashboard/src/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── onboarding/page.tsx          # crear restaurante (POST /v1/auth/register)
│   └── (panel)/menu/page.tsx        # categorías, productos, modificadores
├── components/
└── lib/api.ts                       # fetch client contra gateway; adjunta Bearer; refresh en 401
```

## 5. Casos de prueba exactos (Fase Roja de AGY)

### A. Identity — unitarios de casos de uso (repos/adaptadores fake en memoria)

1. `RegisterTenant` crea tenant + usuario ADMIN y devuelve tokens.
2. `RegisterTenant` con email ya usado en ese tenant → `EMAIL_TAKEN`.
3. `RegisterTenant` con slug tomado → `SLUG_TAKEN`.
4. `RegisterTenant` con password < 8 caracteres → `VALIDATION_ERROR`.
5. `Login` con credenciales válidas → tokens + `UserDTO` sin `passwordHash`.
6. `Login` con password erróneo o email inexistente → mismo `INVALID_CREDENTIALS` en ambos casos.
7. `RefreshSession` con refresh válido → nuevo par de tokens Y el refresh anterior queda revocado (rotación).
8. `RefreshSession` con refresh revocado o expirado → `INVALID_CREDENTIALS`.
9. `InviteUser` crea usuario MANAGER/STAFF en el tenant del admin autenticado.
10. `InviteUser` ignora cualquier `tenantId` del input: siempre usa el del token.

### B. Identity — integración (Supertest + Postgres de test)

11. `POST /auth/register` 201 → tenant y user persistidos; el password en DB está hasheado (no contiene el claro).
12. `POST /auth/login` 200 → access JWT verificable con `JWT_SECRET` y claims `sub/tenantId/role` correctos.
13. `GET /identity/me` con `x-user-id`/`x-tenant-id` → 200 con el perfil del tenant correcto; sin cabeceras → 401.
14. Todas las respuestas de error cumplen `{ error: { code, message } }`.
15. `POST /identity/users` con rol STAFF → 403; con rol ADMIN → 201.

### C. Catalog — unitarios de casos de uso (repos fake)

16. `CreateCategory` persiste con el `tenantId` del contexto.
17. `CreateProduct` con precio negativo → `BAD_USER_INPUT`.
18. `CreateProduct` con `categoryId` inexistente en el tenant → `NOT_FOUND`.
19. `UpdateProduct` apuntando a un producto de OTRO tenant → `NOT_FOUND` (aislamiento).
20. `DeleteCategory` con productos asociados → `CATEGORY_NOT_EMPTY`.
21. `CreateModifierGroup` con `maxSelections < minSelections` → `BAD_USER_INPUT`.
22. `attachModifierGroup` duplicado → idempotente, no crea fila duplicada.
23. `setProductAvailability(false)` → el producto sigue listándose con `isAvailable: false`; con `onlyAvailable: true` desaparece del listado.

### D. Catalog — integración GraphQL (Supertest POST `/graphql` con `x-tenant-id`)

24. `mutation createCategory` → `query categories` la devuelve.
25. Flujo completo: `createModifierGroup` + `addModifierOption` → `attachModifierGroup` → `query product` incluye el grupo con opciones y `priceDelta`.
26. Aislamiento: datos creados por tenant A son invisibles en TODAS las queries de tenant B.
27. Query sin `x-tenant-id` → error `UNAUTHENTICATED`.
28. Errores llevan `extensions.code` ∈ {`BAD_USER_INPUT`, `NOT_FOUND`, `CONFLICT`, `CATEGORY_NOT_EMPTY`}.

### E. Admin Dashboard — UI/UX Bento Box (Testing Library + MSW)

> **Regla de bóveda vigente desde esta oleada**: todo módulo frontend sigue estética **Bento Box** — tarjetas con border-radius alto, sombras suaves, separación clara, minimalista, alto contraste (texto ≥ 4.5:1), acentos vibrantes SOLO para datos clave, cero elementos decorativos sin función. Esta sección fue planificada invocando el skill **ui-ux-pro-max**: fuente de estilo autorizada `bento-box-grid` (dataset del skill); las dos salidas de `--design-system` (Dark Mode OLED y Brutalism) se descartaron por contradecir la regla de bóveda. Tipografía elegida del dataset: **"Corporate Trust"** (Lexend para headings + Source Sans 3 para cuerpo) por legibilidad y accesibilidad, descartando la opción monoespaciada.

#### E.1 Tokens de diseño (CSS custom properties — PROHIBIDO hardcodear hex/px en componentes)

```
--bento-page-bg:        #F5F5F7   /* fondo de página, neutro */
--bento-card-bg:        #FFFFFF   /* superficie de tarjeta */
--bento-card-radius:    24px      /* radio alto de tarjeta */
--bento-inner-radius:   16px      /* elementos internos (chips, inputs) */
--bento-grid-gap:       16px      /* separación clara entre tarjetas */
--bento-card-shadow:    0 4px 6px rgba(0,0,0,0.05)  /* sombra suave */
--bento-hover-scale:    1.02      /* SOLO tarjetas interactivas */
--bento-text:           #1E293B   /* ~14:1 sobre card-bg ✓ */
--bento-text-muted:     #64748B   /* ~4.8:1 sobre card-bg ✓ */
--bento-accent:         #EA580C   /* vibrante; SOLO datos clave grandes (≥3:1) */
--bento-accent-strong:  #C2410C   /* fondo de CTA primario con texto blanco (≥4.5:1) */
--bento-success:        #15803D   /* disponible/activo, seguro como texto */
--bento-destructive:    #DC2626   /* no disponible/eliminar, ≥4.5:1 */
--bento-focus-ring:     2px solid #1E293B con offset 2px
```

Tipografía: heading **Lexend**, body **Source Sans 3** (`https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap`). Grid: CSS Grid 4 columnas → 2 (≤1024px) → 1 (≤640px), `grid-auto-rows: minmax(160px, auto)`. Iconos: Phosphor (`@phosphor-icons/react`), SVG, `aria-hidden` cuando acompañan texto visible. NUNCA emojis como iconos.

#### E.2 Primitivos base — `@packages/ui-components/src/bento/`

```tsx
// Contratos de props — NO implementación
export interface BentoGridProps {
  children: React.ReactNode;
  cols?: 4 | 3 | 2;                 // default 4
  className?: string;
}
// Renderiza <div data-component="bento-grid">; gap y columnas SOLO vía var(--bento-*); colapso 4→2→1.

export interface BentoCardProps {
  children: React.ReactNode;
  span?: 1 | 2;                     // celdas del grid que ocupa
  variant?: 'default' | 'kpi' | 'action';
  interactive?: boolean;            // solo entonces: hover scale 1.02, cursor pointer, foco visible
  onClick?: () => void;
  className?: string;
}
// Renderiza <article data-component="bento-card" data-variant={variant} data-interactive={interactive}>;
// radius, sombra y fondo SOLO vía var(--bento-card-radius/shadow/bg).

export interface KpiValueProps {
  value: string;
  label: string;
  tone?: 'accent' | 'success' | 'destructive' | 'neutral';   // default 'neutral'
}
// Renderiza <div data-component="kpi-value" data-tone={tone}>.
// ÚNICO componente autorizado a usar --bento-accent / --bento-success / --bento-destructive en texto grande.

export interface AvailabilityToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;                    // nombre accesible OBLIGATORIO
}
// Switch accesible: role="switch", aria-checked, activable por teclado.
```

#### E.3 Componentes de dominio — `apps/admin-dashboard/src/components/`

- `AppShell`: rail lateral de navegación (iconos Phosphor + etiqueta) + `<main>` con `BentoGrid`.
- `CategoryCard` (BentoCard): nombre, contador de productos, badge de estado con texto + color (nunca solo color).
- `ProductCard` (BentoCard): nombre, **precio como `KpiValue tone="accent"`** (dato clave), `AvailabilityToggle`, contador de modificadores.
- `ModifierGroupCard` (BentoCard): nombre, rango `minSelections–maxSelections`, lista de opciones con `priceDelta` (KpiValue neutral).
- `MenuToolbar`: CTAs primarios ("Nueva categoría", "Nuevo producto") — único fondo `--bento-accent-strong` de la página.
- Páginas: `/login` (BentoCard centrada), `/onboarding` (grid de 1 columna con tarjeta de formulario), `/menu` (toolbar + grid de `CategoryCard`; sección de `ProductCard`; sección de `ModifierGroupCard`). El item "Analytics" del rail se envuelve en `<FeatureGuard flag="analytics">` → `BentoCard` con `Proximamente`.

#### E.4 Casos de prueba (RTL + MSW, gateway mockeado)

**Comportamiento (actualizados con estructura Bento)**
29. Onboarding: el formulario envía `POST /v1/auth/register` con los datos del restaurante y, tras 201, redirige a `/menu`.
30. Onboarding: 409 del gateway → mensaje inline con `role="alert"` DENTRO de la BentoCard del formulario, sin redirect.
31. Login: guarda tokens y adjunta `Authorization: Bearer` en las llamadas siguientes; ante 401 intenta `POST /v1/auth/refresh` una vez.
32. `/menu` renderiza cada categoría del stub MSW como `data-component="bento-card"` dentro de `data-component="bento-grid"`.
33. Crear producto: el formulario dispara `createProduct` con el `categoryId` seleccionado y el grid se refresca.
34. `AvailabilityToggle` dispara `setProductAvailability`; el control expone `role="switch"` y `aria-checked` coherente con el estado.
35. `/menu` sin token → redirige a `/login`.
36. `<FeatureGuard flag="analytics">` con el flag apagado → BentoCard con `data-testid="proximamente"` que OCUPA su celda del grid (el layout no colapsa).

**Estructura visual Bento (nuevas)**
37. `BentoGrid` renderiza `data-component="bento-grid"` y referencia `var(--bento-grid-gap)` en su estilo; ningún valor de gap en px hardcodeado.
38. `BentoCard` referencia `var(--bento-card-radius)`, `var(--bento-card-shadow)` y `var(--bento-card-bg)`; sin hex ni px inline.
39. Tokens (test unitario puro): `--bento-card-radius` = 24px, `--bento-inner-radius` = 16px, `--bento-grid-gap` = 16px, `--bento-card-shadow` = sombra suave especificada.
40. Contraste (test unitario puro, función WCAG sobre los hex de los tokens): `--bento-text` y `--bento-text-muted` sobre `--bento-card-bg` ≥ 4.5:1; blanco sobre `--bento-accent-strong` ≥ 4.5:1; `--bento-accent` sobre card ≥ 3:1 (solo texto grande).
41. Acento vibrante solo en datos clave: en una `ProductCard` renderizada, el ÚNICO elemento con `data-tone="accent"` es el `KpiValue` del precio.
42. Cero decoración: todo SVG de icono junto a texto tiene `aria-hidden="true"`; no existe `<img>` sin `alt` en ninguna tarjeta; no hay emojis usados como iconos.
43. Controles accesibles: todo botón y switch de las tarjetas tiene nombre accesible; `BentoCard interactive` declara cursor pointer y referencia el token `--bento-focus-ring`.
44. Responsive + motion: `BentoGrid` declara el colapso 4→2→1 (hooks de breakpoint en la hoja de tokens) y el hover scale/transiciones quedan desactivados bajo `prefers-reduced-motion` (media query presente).

*Regresión visual (Playwright + baselines de screenshot): queda como mejora opcional posterior; requiere aprobar la dependencia. No es condición de cierre de esta oleada.*

### F. Cierre de oleada (smoke)

45. `prisma migrate deploy` aplica limpio sobre `resto_identity` y `resto_catalog`.
46. Check de desacoplamiento: ningún archivo de `services/catalog` importa del Prisma client de identity ni viceversa (regla lint o test de imports).
47. E2E a través del gateway: `register → login → createCategory (GraphQL vía /v1/graphql) → query categories` devuelve la categoría creada.
48. `pnpm test` verde en identity, catalog, admin-dashboard y ui-components (incluye los suites Bento 37–44); `pnpm build` compila shared-types con los nuevos módulos.

**Criterio de cierre**: tests 1–44 escritos primero en rojo y llevados a verde; checks 45–48 verificados. La fila nueva del gateway (`POST /v1/identity/users`) queda añadida a la tabla de rutas sin romper ningún test de Oleada 0.
