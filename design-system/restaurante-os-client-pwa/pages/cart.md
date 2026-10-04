# Page Override: cart (Client PWA)

> Override de `design-system/restaurante-os-client-pwa/MASTER.md` para la zona de carrito
> (`CartFab`, `CartSheet`, `CartLineItem`, `QuantityStepper`, `CartSummaryBar`, `OrderConfirmationCard`).
> Hereda todos los tokens y principios del MASTER; aquí solo reglas específicas del carrito colaborativo.
> Fuente UX: skill ui-ux-pro-max (dataset ux-guidelines: content jumping, error announcements, loading).

## Reglas específicas

1. **Cero saltos de layout**: contador del `CartFab` y totales en slots de ancho/alto reservado. Un poll que añade líneas de otro guest NUNCA desplaza contenido visible ni roba el foco.
2. **Polling silencioso**: la actualización periódica (5s) no muestra spinner ni skeleton; solo la carga inicial usa skeleton estable con `aria-busy`. Pull-to-refresh deshabilitado (`overscroll-behavior: contain`): el polling lo sustituye.
3. **Errores de confirmación**: `role="alert"` dentro del `CartSheet`, foco movido al contenedor del error, carrito intacto. Nunca toast efímero como único canal.
4. **Atribución colaborativa**: `AddedByBadge` con texto legible ("Añadido por Ana"); nunca solo color ni avatar decorativo.
5. **`QuantityStepper`**: botones ≥44px, separación ≥8px, `aria-label` con el nombre del producto ("Aumentar cantidad de Tacos"); "−" en 1 elimina con confirmación inline (no modal).
6. **CTA "Enviar pedido"**: `--bento-accent-strong` + texto blanco, ancho completo dentro de `CartSummaryBar`, respeta `--bento-safe-bottom`; disabled con carrito vacío (estado disabled evidente, no solo opacidad); `aria-busy` durante el confirm.
7. **Precios**: `lineTotal` y total SIEMPRE como `KpiValue tone="accent"` (único acento vibrante de la pantalla).
8. **Estado vacío**: `CartEmptyState` es una BentoCard con texto plano; cero ilustraciones decorativas.
9. **Confirmación**: `OrderConfirmationCard` muestra id corto + estado `PLACED` con texto + color.
10. **FeatureGuard**: la zona de carrito completa va envuelta en `<FeatureGuard flag="online-ordering">`; OFF → `Proximamente` dentro de una BentoCard.
