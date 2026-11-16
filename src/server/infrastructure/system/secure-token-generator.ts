import { randomBytes } from 'node:crypto';
import type { TokenGenerator } from '../../application/ports/token-generator.js';

/** 32 random bytes as base64url (43 characters): the same format participant tokens always had. */
export class SecureTokenGenerator implements TokenGenerator {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }
}
