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
