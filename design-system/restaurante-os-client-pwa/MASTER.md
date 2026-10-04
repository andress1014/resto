# Restaurante-OS Client PWA — MASTER (Source of Truth)

> REGLA DE BÓVEDA (vigente): estructura **Bento Box** en TODO módulo frontend.
> Este MASTER corrige la salida automática del skill ("Vibrant & Block-based": efectos decorativos,
> gaps 48px+, scroll-snap agresivo), descartada por violar la regla. Se conservan del skill:
> paleta restaurant (rojo apetitoso + dorado), tipografía culinary (Playfair Display SC + Karla)
> y las pautas móviles del dataset (touch targets, safe areas, gestos).

## Contexto

Experiencia de CLIENTE en móvil (guest mode vía QR de mesa), NO dashboard. Mobile-first real:
1 columna → 2 (≥640px). Sesión temporal: nada de persistencia de cuenta.

## Principios (hereda bóveda Bento)

1. Tarjetas radius 24px / internos 16px; sombra suave; gap 16px.
2. Minimalista: cero decoración sin función.
3. Texto ≥ 4.5:1; KPI grande ≥ 3:1.
4. Acento vibrante SOLO en datos clave (precio) y CTA primario.
5. Iconos SVG (Phosphor) con `aria-hidden` junto a texto; nunca emojis.
6. Estado con texto + color, nunca solo color (disponibilidad, obligatorio).
7. Touch targets ≥ 44px (estándar de producto; supera WCAG 24px), separación ≥ 8px.
8. Safe areas: contenido nunca bajo notch/barras de gesto.

## Tokens (misma hoja `--bento-*`, valores de marca cliente)

```
--bento-page-bg:        #FEF2F2
--bento-card-bg:        #FFFFFF
--bento-card-radius:    24px
--bento-inner-radius:   16px
--bento-grid-gap:       16px
--bento-card-shadow:    0 4px 6px rgba(0,0,0,0.05)
--bento-text:           #450A0A
--bento-text-muted:     #475569
--bento-accent:         #A16207   /* dorado; SOLO precio (KpiValue) */
--bento-accent-strong:  #DC2626   /* CTA primario + texto blanco */
--bento-success:        #15803D
--bento-destructive:    #DC2626
--bento-focus-ring:     2px solid #450A0A, offset 2px
--bento-touch-target:   44px
--bento-touch-gap:      8px
--bento-safe-bottom:    env(safe-area-inset-bottom)
```

PROHIBIDO hardcodear hex/px en componentes: todo sale de estos tokens.

## Tipografía

- Heading: **Playfair Display SC** (400/700). Body: **Karla** (400/500/600/700).
- Google Fonts: `https://fonts.googleapis.com/css2?family=Karla:wght@400;500;600;700&family=Playfair+Display+SC:wght@400;700&display=swap`

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
- Acento dorado en texto que no sea precio
- Efectos decorativos (patterns animados, duotonos sin función)
- Emojis como iconos
- Gestos de pantalla completa que rompan scroll/back
- Touch targets < 44px
- Grid de 3+ columnas en móvil
