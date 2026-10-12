# UI/UX Guidelines — Frontends (`@apps/admin-dashboard`, `@apps/client-pwa`)

Vigente desde la Oleada 1. Aplica a todo módulo frontend futuro.

## Estética requerida

- **Estructura:** layouts modulares tipo "Bento Box".
- **Geometría:** tarjetas con border-radius alto, sombras suaves, separación clara entre bloques.
- **Color:** minimalista, alto contraste, fondos limpios, acentos vibrantes (amarillo/azul) reservados para datos clave.
- **Restricción:** prohibido cualquier elemento decorativo sin función estricta.

## Proceso obligatorio

- **Kimi:** al planificar cualquier módulo frontend, debe invocar la skill "uxui promax" dentro de su propia sesión, estructurar los componentes base según Bento Box, y redactar las pruebas de UI/UX (React Testing Library y/o regresión visual) que validen esa estructura — como parte del manifiesto, sin código.
- **Agy:** construye los componentes respetando estrictamente la estética Bento Box e implementa lo necesario para llevar esas pruebas de UI/UX a verde en Fase Verde.

## Actualizacion 2026-10-11: linea Lima & Tinta (vigente)

Direccion visual aprobada por el usuario para Admin y PWA, derivada de las imagenes de referencia (bento, sidebar oscuro de iconos, KPIs con delta, tabs pill, chips de estado, modal de confirmacion).

- **Paleta:** tinta `#0E100B`, lima `#D7F35C` (solo datos clave y chips), hueso `#ECEEE6` (fondo), papel `#FAFAF6` (tarjetas). Sin naranja, azules sueltos ni otros acentos fuera de los tokens `--bento-*`.
- **Tipografia:** Bricolage Grotesque (titulos) y DM Sans (texto).
- **Tarjetas:** `BentoCard` con fondo papel, padding interno por token (`--bento-card-padding`), radio 24px y sombra suave. Foco solo con `:focus-visible`.
- **Kit:** `packages/ui-components/src/kit/` (12 componentes, `labels.ts` con etiquetas en espanol de estados y metodos de pago). Prohibido renderizar enums crudos (`IN_KITCHEN`, `CASH`) o ids de mesa en la UI.
- **Admin:** layout `(panel)` con `PanelShell` (sidebar de iconos, contenedor de 1200px; KDS a ancho completo, una sola live region).
- **PWA:** mobile first (375px), objetivos tactiles de 44px recomendados, pie fijo con safe-area y `CartFab`.
- **Verificacion:** los tests jsdom no detectan CSS roto. Todo cambio visual se confirma en Chrome (para 375px usar un iframe, el resize de ventana no cambia el viewport).
