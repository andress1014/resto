import { DomainError, DomainErrorCode } from '@packages/shared-types';

export class SessionDomainError extends DomainError {
  constructor(code: DomainErrorCode, message: string) {
    super(code, message);
  }
}
