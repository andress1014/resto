export type DomainErrorCode =
  | 'VALIDATION_ERROR'
  | 'EMAIL_TAKEN'
  | 'SLUG_TAKEN'
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'UNAUTHENTICATED'
  | 'BAD_USER_INPUT'
  | 'CONFLICT'
  | 'CATEGORY_NOT_EMPTY'
  | 'QR_KEY_INVALID'
  | 'TABLE_NOT_FOUND'
  | 'TABLE_INACTIVE'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED';

export class DomainError extends Error {
  constructor(public readonly code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
