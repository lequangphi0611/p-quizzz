export type DomainErrorKind = 'not_found' | 'conflict' | 'invalid' | 'forbidden' | 'unauthenticated';

/**
 * Base class for business-rule failures. `kind` says what went wrong in business terms;
 * the HTTP layer decides which status that becomes. `message` is shown to the user (Vietnamese).
 */
export class DomainError extends Error {
  constructor(
    readonly kind: DomainErrorKind,
    message: string,
    /** Optional machine-readable reason the web acts on (e.g. `identity_in_use`); the status and `error` text stay the contract. */
    readonly code?: string,
    /** Optional extra fields sent next to `error`/`code` (e.g. which questions are missing a reason). */
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
