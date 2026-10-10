import { PaymentMethod } from '@packages/shared-types';
import { ValidationError } from './errors';

export const VALID_PAYMENT_METHODS: readonly PaymentMethod[] = ['CASH', 'CARD', 'OTHER'] as const;

export function validatePaymentMethod(method: string): PaymentMethod {
  if (!VALID_PAYMENT_METHODS.includes(method as PaymentMethod)) {
    throw new ValidationError(
      `Método de pago inválido: ${method}. Debe ser uno de: ${VALID_PAYMENT_METHODS.join(', ')}`
    );
  }
  return method as PaymentMethod;
}
