# Restaurante-OS Client PWA — MASTER (Source of Truth)

> REGLA DE BÓVEDA (vigente): estructura **Bento Box** en TODO módulo frontend.
> Este MASTER establece la paleta oficial aprobada **Lima & Tinta** (#0E100B, #D7F35C, #ECEEE6, #FAFAF6)
> y la tipografía autorizada (Bricolage Grotesque + DM Sans), manteniendo las pautas móviles
> de accesibilidad y usabilidad (touch targets ≥44px, safe areas, gestos).

## Contexto

Experiencia de CLIENTE en móvil (guest mode vía QR de mesa), NO dashboard. Mobile-first real:
1 columna → 2 (≥640px). Sesión temporal: nada de persistencia de cuenta.

## Principios (hereda bóveda Bento)

1. Tarjetas radius 24px / internos 16px; sombra suave; gap 16px.
2. Minimalista: cero decoración sin función.
3. Texto ≥ 4.5:1; KPI grande ≥ 3:1.
4. Acento vibrante SOLO en datos clave (precio) y CTA primario. Lima (#D7F35C) SOLO como fondo con texto tinta (#0E100B) encima; nunca como texto sobre papel.
5. Iconos SVG (Phosphor) con `aria-hidden` junto a texto; nunca emojis.
6. Estado con texto + color, nunca solo color (disponibilidad, obligatorio).
7. Touch targets ≥ 44px (estándar de producto; supera WCAG 24px), separación ≥ 8px.
8. Safe areas: contenido nunca bajo notch/barras de gesto.

## Tokens (misma hoja `--bento-*`, valores de marca cliente)

```
--bento-page-bg:        #ECEEE6   /* Hueso */
--bento-card-bg:        #FAFAF6   /* Papel */
--bento-card-radius:    24px
--bento-inner-radius:   16px
--bento-pill-radius:    9999px
--bento-grid-gap:       16px
--bento-card-shadow:    0 4px 6px rgba(0,0,0,0.05)
--bento-text:           #0E100B   /* Tinta: ~15:1 sobre card-bg */
--bento-text-muted:     #52525B   /* ~5.2:1 sobre card-bg */
--bento-accent:         #D7F35C   /* Lima: chips y acentos con texto tinta, ≥4.5:1 */
--bento-accent-strong:  #0E100B   /* Tinta: CTA primario + texto papel */
--bento-tinta:          #0E100B
--bento-lima:           #D7F35C
--bento-hueso:          #ECEEE6
--bento-papel:          #FAFAF6
--bento-border:         #E2E4DC
--bento-warning:        #F59E0B
--bento-amber:          #F59E0B
--bento-amber-strong:   #92400E
--bento-success:        #15803D
--bento-destructive:    #DC2626
--bento-focus-ring:     2px solid #0E100B
--bento-touch-target:   44px
--bento-touch-gap:      8px
--bento-safe-bottom:    env(safe-area-inset-bottom)
```

PROHIBIDO hardcodear hex/px en componentes: todo sale de estos tokens.

## Tipografía

- Heading: **Bricolage Grotesque** (400/500/600/700). Body: **DM Sans** (400/500/600/700).
- Google Fonts: `https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..700&family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700&display=swap`

## Patrones móviles

- Grid: 1 columna → 2 (≥640px); `grid-auto-rows: minmax(140px, auto)`.
- `CategoryChipRail`: scroll horizontal con scroll-snap SOLO en el rail; sticky; safe-area top.
- `ProductDetailSheet`: bottom sheet `role="dialog" aria-modal`, foco gestionado, cierre por botón + swipe-down sin romper scroll/back del sistema.
- Gestos: swipe horizontal SOLO en carruseles/raíles; prohibido swipe de pantalla completa.
- `prefers-reduced-motion`: sheet y transiciones se vuelven instantáneos.
- Verificación: 375px obligatorio.

## Componentes base

Reutiliza `@packages/ui-components` (`BentoGrid`, `BentoCard`, `KpiValue`, `AvailabilityToggle`, `FeatureGuard`, `Proximamente`) sin cambiar su API. Contratos de los componentes de dominio del PWA en `docs/OLEADA-2-MANIFIESTO.md` §4.3.

## Accesibilidad (checklist obligatorio)

- [ ] Touch targets ≥ 44px, separación ≥ 8px
- [ ] Texto ≥ 4.5:1; precio ≥ 3:1 (texto grande)
- [ ] Safe-area insets aplicados en header, rail y sheet
- [ ] Sheet: `role="dialog"`, `aria-modal`, foco al abrir/cerrar
- [ ] Iconos decorativos `aria-hidden`; imágenes de producto con `alt`
- [ ] "No disponible" / "obligatorio" con texto, no solo color
- [ ] Errores con `role="alert"`
- [ ] `prefers-reduced-motion` respetado

## Anti-patrones (bloqueantes)

- Hex/px fuera de la hoja de tokens
- Acento lima como texto sobre fondo claro (lima solo como fondo de chip con texto tinta)
- Efectos decorativos (patterns animados, duotonos sin función)
- Emojis como iconos
- Gestos de pantalla completa que rompan scroll/back
- Touch targets < 44px
- Grid de 3+ columnas en móvil
