# Architecture Decision Records

## ADR-001: Arquitectura de microservicios sobre monolito
- **Fecha:** 2026-10-03
- **Estado:** Aceptado
- **Contexto:** SaaS B2B2C multi-tenant para restaurantes/bares con dominios claramente separables (identidad, catálogo, sesiones de mesa, pedidos).
- **Decisión:** Microservicios independientes, cada uno con Arquitectura Hexagonal interna (puertos y adaptadores), organizados en un monorepo (Turborepo/Nx).
- **Consecuencias:** Mayor complejidad operativa (Docker Compose, API Gateway, mensajería) a cambio de despliegue y escalado independientes por dominio.

## ADR-002: TDD estricto con circuit breaker
- **Fecha:** 2026-10-03
- **Estado:** Aceptado
- **Contexto:** Evitar que el agente ejecutor (Agy) escriba lógica de negocio sin cobertura o entre en loops de intentos fallidos.
- **Decisión:** Ciclo Red-Green-Refactor obligatorio. Máximo 3 intentos por test; al 3er fallo, Agy se detiene y reporta al Orquestador, quien decide si es un problema de implementación o un bloqueo arquitectónico (en cuyo caso se pausa la oleada y se pide intervención humana).
- **Consecuencias:** Desarrollo más lento por test, pero con cobertura garantizada desde el primer commit de cada feature.

## ADR-003: Comunicación síncrona/asíncrona mixta
- **Fecha:** 2026-10-03
- **Estado:** Aceptado
- **Contexto:** Algunas operaciones son consultas simples entre servicios; otras son mutaciones que afectan múltiples dominios (ej. crear un pedido afecta Catalog, Ordering y Session).
- **Decisión:** HTTP/GraphQL síncrono para consultas; eventos vía Redis Streams/Pub-Sub para mutaciones cross-dominio.
- **Consecuencias:** Consistencia eventual en flujos cross-dominio; requiere diseño cuidadoso de los contratos de eventos (ver `02_Dominio/Diccionario.md`).

## ADR-005: Multi-tenancy por `tenantId` inyectado desde JWT, nunca desde input
- **Fecha:** 2026-10-03
- **Estado:** Aceptado
- **Contexto:** Riesgo de fuga de datos entre tenants si un cliente pudiera enviar `tenantId` en el body/input.
- **Decisión:** El gateway extrae `tenantId` del claim del JWT y lo inyecta como header `x-tenant-id`; los servicios lo leen solo de ahí y lo exigen como primer parámetro en todo método de repositorio. Cualquier `tenantId` recibido en body/input se ignora.
- **Consecuencias:** Aislamiento forzado por contrato (no por convención); verificado con test de aislamiento cruzado entre tenants (Oleada 1, test 26).

## ADR-006: ORM por servicio sin acoplamiento físico (Prisma)
- **Fecha:** 2026-10-03
- **Estado:** Aceptado
- **Contexto:** Identity y Catalog son microservicios independientes pero Catalog necesita referenciar tenants de Identity.
- **Decisión:** Prisma 5, un `schema.prisma` y un cliente generado por servicio. Las referencias cruzadas (`tenantId` en Catalog) son columnas `String` planas, sin relación Prisma ni FK física hacia la DB del otro servicio.
- **Consecuencias:** Cero acoplamiento físico entre bases de datos; validado con test de imports cruzados (Oleada 1, test 46).

## ADR-007: Bento Box como sistema de diseño de frontends
- **Fecha:** 2026-10-03
- **Estado:** Aceptado
- **Contexto:** Directiva de UI/UX del usuario para `@apps/admin-dashboard` y `@apps/client-pwa`.
- **Decisión:** Layouts tipo Bento Box (tarjetas de border-radius alto, sombras suaves, alto contraste, acentos vibrantes solo en datos clave). Kimi invoca su skill "uxui promax" al planificar cualquier módulo frontend; todos los valores viven en CSS custom properties (`--bento-*`), prohibido hardcodear hex/px en componentes.
- **Consecuencias:** Consistencia visual garantizada por tokens centralizados; cobertura de tests de contraste WCAG y de ausencia de hardcoding (Oleada 1, tests 37-44). Ver `01_Arquitectura/UI_UX_Guidelines.md`.

## ADR-008: Autonomía absoluta del Orquestador (bucle sin checkpoints humanos)
- **Fecha:** 2026-10-03
- **Estado:** Aceptado
- **Contexto:** Acelerar el desarrollo del MVP sin pausar en cada oleada a pedir autorización.
- **Decisión:** El Orquestador ejecuta el bucle Planificación Roja → Ejecución Roja → Planificación Verde → Ejecución Verde → Cierre/Doc → siguiente oleada de forma continua. Ante agotamiento del circuit breaker de Agy, se activa un Fix Loop (Kimi diagnostica y entrega plan de corrección sin código) con límite de 3 intentos antes de escalar a "Bloqueo Irresoluble" para el humano.
- **Consecuencias:** Mayor velocidad de iteración; el humano solo interviene ante bloqueos estructurales reales, no en cada paso del ciclo TDD.

## ADR-009: Checkout vive en Ordering Service, no en el gateway
- **Fecha:** 2026-10-06
- **Estado:** Aceptado
- **Contexto:** El cierre de visita necesita sumar Orders, registrar un cobro y cerrar la sesión de mesa — podría vivir como orquestación en el gateway o como endpoints nuevos en Ordering.
- **Decisión:** Vive en Ordering: la cuenta es un read-model sobre sus propias Orders, y el gateway nunca ha tenido lógica de negocio (solo tabla de rutas declarativa desde Oleada 0). La orquestación con Session Service se hace con un puerto anticorrupción nuevo (`SessionServicePort`), simétrico a `CatalogValidationPort` de Oleada 3.
- **Consecuencias:** El gateway se mantiene como BFF puramente declarativo en las 6 oleadas. Idempotencia del cobro garantizada estructuralmente con `@@unique([tenantId, sessionId])` en la tabla `Payment`, sin locks aplicativos.

## ADR-010: Verificación independiente del Orquestador antes de cerrar una oleada
- **Fecha:** 2026-10-06
- **Estado:** Aceptado
- **Contexto:** En el cierre de Oleada 5, Agy reportó "182/182 tests, build limpio", pero al correr `pnpm -r run build` directamente el Orquestador encontró un `OrderStatus` sin importar que rompía la compilación de `services/ordering` — invisible para los tests porque ts-jest no hace type-check estricto de cada ruta. Precedente: Agy también había cometido un error aritmético en el cierre de Oleada 2 (reportó 134/134 cuando el total real era 104).
- **Decisión:** El Orquestador no da una oleada por cerrada solo con el reporte del agente ejecutor; corre él mismo los comandos de verificación (`pnpm -r test`, `pnpm -r run build`) antes de actualizar la bóveda como completada.
- **Consecuencias:** Costo de tiempo adicional por oleada, a cambio de que la bóveda nunca registre un estado "✅ Completada" que no sea cierto.

## ADR-004: Feature flags obligatorios para UI incompleta
- **Fecha:** 2026-10-03
- **Estado:** Aceptado
- **Contexto:** El desarrollo avanza por oleadas; sin control, quedarían vistas rotas o funcionalidades a medias visibles en producción.
- **Decisión:** Todo lo que no pertenezca a la oleada en curso se envuelve en `<FeatureGuard>` + `featureFlags.ts`, mostrando un placeholder "Próximamente" si el flag está en `false`.
- **Consecuencias:** Overhead menor de boilerplate por feature, a cambio de UI siempre coherente de cara al usuario.
