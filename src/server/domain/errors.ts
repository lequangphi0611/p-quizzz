export type DomainErrorKind = 'not_found' | 'conflict' | 'invalid' | 'forbidden' | 'unauthenticated';

/**
 * Base class for business-rule failures. `kind` says what went wrong in business terms;
 * the HTTP layer decides which status that becomes. `message` is shown to the user (Vietnamese).
 */
export class DomainError extends Error {
  constructor(
    readonly kind: DomainErrorKind,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
