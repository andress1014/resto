# Page Override: checkout (Admin Dashboard)

> Override de `design-system/restaurante-os-admin/MASTER.md` para la ruta `/checkout` (cierre de visita y cobro manual).
> Hereda tokens y principios del MASTER admin. Ruta envuelta en `<FeatureGuard flag="payments">`.
> Fuente UX: skill ui-ux-pro-max (dataset ux-guidelines: confirmation dialogs, submit feedback, error summary, form labels).

## Contexto

El staff cobra y libera la mesa. Acción con consecuencia irreversible en el MVP (no hay "descobrar"):
la confirmación explícita es obligatoria, no opcional.

## Reglas específicas

1. **Paso de confirmación obligatorio**: `ConfirmPaymentButton` nunca cobra al primer click; abre confirmación inline con el total y la consecuencia ("¿Registrar cobro de {total} y liberar la mesa?"). Sin modal bloqueante si puede ser inline; si es modal, foco atrapado y cierre con Escape.
2. **Feedback de envío**: loading (`aria-busy`) → success (`PaymentSuccessCard` con texto "Cobro registrado. Mesa liberada.") o error con `role="alert"` ENFOCABLE dentro de la tarjeta. Nunca éxito silencioso ni toast como único canal.
3. **`SESSION_CLOSE_FAILED`**: el error ofrece "Reintentar cierre" como acción explícita (el backend es idempotente: reintentar es seguro y no duplica el cobro).
4. **Total de la visita** como `KpiValue tone="accent"` — único acento vibrante de la vista junto al CTA primario. Subtotales por Order en texto normal.
5. **`PaymentMethodPicker`**: `role="radiogroup"`, 3 opciones con `role="radio"` y label visible (icono Phosphor `aria-hidden` + texto "Efectivo/Tarjeta/Otro"). Prohibido placeholder-only o selección implícita; sin selección → CTA disabled evidente.
6. **`BillOrderLine`**: hora de la Order, items (cantidad + nombre + modificadores en línea secundaria muted), subtotal a la derecha en slot de ancho fijo (cero saltos de layout). Orders canceladas NO se muestran.
7. **`ActiveTablesGrid`**: BentoCards con label de mesa + hora de apertura; al cobrar, la tarjeta desaparece en el refetch sin mover el foco del staff al success. Estado vacío: "No hay mesas activas" en texto plano.
8. Touch targets ≥44px en todo lo interactivo; la vista debe ser operable solo con teclado (el staff puede usar un terminal sin ratón).
9. La mesa y su total deben ser legibles a un brazo de distancia (nombre de mesa en heading Lexend 600, total ≥24px).
