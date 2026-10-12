# Restaurante-OS Admin — MASTER (Source of Truth)

> REGLA DE BÓVEDA (vigente desde Oleada 1): todo módulo frontend sigue estética **Bento Box**.
> Este MASTER establece la paleta oficial aprobada **Lima & Tinta** (#0E100B, #D7F35C, #ECEEE6, #FAFAF6)
> y la tipografía autorizada (Bricolage Grotesque + DM Sans) sobre la estructura `bento-box-grid`.

## Principios

1. Tarjetas con border-radius alto (24px tarjeta / 16px internos).
2. Sombras suaves, nunca duras.
3. Separación clara: gap de grid 16px.
4. Minimalista: cero elementos decorativos sin función.
5. Alto contraste: texto ≥ 4.5:1 sobre su superficie.
6. Acentos vibrantes SOLO para datos clave (KPIs, CTAs primarios, estados). Lima (#D7F35C) SOLO como fondo con texto tinta (#0E100B) encima; nunca como texto sobre papel.
7. Iconos SVG (Phosphor), `aria-hidden` junto a texto; nunca emojis como iconos.
8. Color nunca como único indicador de estado (texto + color).

## Tokens (CSS custom properties)

```
--bento-page-bg:        #ECEEE6   /* Hueso */
--bento-card-bg:        #FAFAF6   /* Papel */
--bento-card-radius:    24px
--bento-inner-radius:   16px
--bento-pill-radius:    9999px
--bento-grid-gap:       16px
--bento-card-shadow:    0 4px 6px rgba(0,0,0,0.05)
--bento-hover-scale:    1.02      /* solo tarjetas interactivas */
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
```

PROHIBIDO hardcodear hex/px en componentes: todo valor visual sale de estos tokens.

## Grid y layout

- CSS Grid: 4 columnas → 2 (≤1024px) → 1 (≤640px); `grid-auto-rows: minmax(160px, auto)`.
- Spans de tarjeta: 1 o 2 celdas.
- Hover scale 1.02 SOLO en tarjetas interactivas; desactivado con `prefers-reduced-motion`.

## Tipografía

- Heading: **Bricolage Grotesque** (400/500/600/700). Body: **DM Sans** (400/500/600/700).
- Google Fonts: `https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..700&family=DM+Sans:ital,opsz,wght@0,9..40,400..700;1,9..40,400..700&display=swap`

## Componentes base (contratos en docs/OLEADA-1-MANIFIESTO.md §E.2)

- `BentoGrid` (`data-component="bento-grid"`)
- `BentoCard` (`data-component="bento-card"`, variants: default | kpi | action)
- `KpiValue` (`data-component="kpi-value"`, único autorizado a usar acentos vibrantes)
- `AvailabilityToggle` (`role="switch"`, `aria-checked`)

## Accesibilidad (checklist obligatorio)

- [ ] Texto ≥ 4.5:1; texto grande/KPI ≥ 3:1
- [ ] Foco visible (token `--bento-focus-ring`) en todo elemento interactivo
- [ ] `prefers-reduced-motion` desactiva hover scale y transiciones
- [ ] Iconos decorativos `aria-hidden="true"`; controles de icono con nombre accesible
- [ ] Switches con `role="switch"` + `aria-checked`; operables por teclado
- [ ] Errores de formulario inline con `role="alert"`

## Anti-patrones (bloqueantes en review)

- Hex/px hardcodeados fuera de la hoja de tokens
- Acento vibrante en texto que no sea dato clave
- Elementos decorativos sin función
- Emojis como iconos
- Estado comunicado solo con color
- Sombras duras o radios bajos (<16px)

## Páginas

Overrides por página en `design-system/restaurante-os-admin/pages/[page].md` (si existe, prevalece sobre este MASTER).
