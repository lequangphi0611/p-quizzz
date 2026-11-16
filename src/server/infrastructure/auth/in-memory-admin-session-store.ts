import type { AdminSessionStore } from '../../application/ports/admin-auth.js';

export class InMemoryAdminSessionStore implements AdminSessionStore {
  private readonly tokens = new Set<string>();

  add(token: string) {
    this.tokens.add(token);
  }

  has(token: string | undefined) {
    return !!token && this.tokens.has(token);
  }

  revoke(token: string | undefined) {
    if (token) this.tokens.delete(token);
  }
}
