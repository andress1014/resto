# Page Override: kds (Admin Dashboard)

> Override de `design-system/restaurante-os-admin/MASTER.md` para la ruta `/kds` (Panel Operativo de cocina).
> Hereda tokens y principios del MASTER admin (Lexend/Source Sans 3, paleta slate, Bento).
> Fuente UX: skill ui-ux-pro-max (dataset ux-guidelines: live badge updates, submit feedback).

## Contexto

Pantalla de cocina en tablet/monitor, consultada de pie y a distancia. Prioridad: legibilidad inmediata
y un solo gesto por orden (avanzar estado). Sin polling: todo llega por socket.

## Reglas específicas

1. **Board de 3 columnas** (`PLACED`, `IN_KITCHEN`, `READY`) dentro de `BentoGrid`; `DELIVERED`/`CANCELLED` salen del board. Columnas colapsan a 1 en ≤768px.
2. **UNA sola región live**: `KdsLiveAnnouncer` con `role="status" aria-atomic="true"` y mensajes completos ("Nueva orden de la mesa 5"). Prohibido un live region por tarjeta o badges con números desnudos.
3. **Contadores de columna** como texto completo ("3 órdenes") en slot de ancho reservado (cero saltos de layout cuando llegan órdenes).
4. **Acción de avance** = un CTA primario por tarjeta (siguiente estado según `ORDER_STATUS_TRANSITIONS`); feedback loading→success/error con `aria-busy`; error con `role="alert"` dentro de la tarjeta.
5. **Tiempo transcurrido** como `KpiValue`: neutral por defecto, `tone="destructive"` al superar `KDS_ALERT_MINUTES` (15 min) — único acento vibrante además de los CTA.
6. **ServiceCallPanel** siempre visible (columna lateral o franja superior); cada llamada muestra mesa + nota + hora como texto; "Resolver" es botón con nombre accesible ("Resolver llamada de la mesa 3").
7. **Actualizaciones por socket sin robar foco ni desplazar la tarjeta que el cocinero está tocando**: inserciones nuevas al final de su columna.
8. Tipografía de tarjeta: nombre de mesa en heading (Lexend 600), items en body (Source Sans 3) con cantidad en negrita; modificadores en línea secundaria `--bento-text-muted`.
9. Estado vacío por columna: texto plano "Sin órdenes" — cero ilustraciones.
10. `<FeatureGuard flag="kitchen-display">` envuelve la ruta; OFF → `Proximamente` en BentoCard.
