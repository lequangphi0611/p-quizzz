import type { AdminCredentialStore, AdminSessionStore, PasswordHasher } from '../ports/admin-auth.js';

/** Not a real hash: `hashed:<password>`. Fast and predictable. */
export class FakePasswordHasher implements PasswordHasher {
  async hash(password: string) {
    return `hashed:${password}`;
  }

  async verify(password: string, stored: string) {
    return stored === `hashed:${password}`;
  }
}

export class InMemoryAdminCredentialStore implements AdminCredentialStore {
  constructor(private hash: string | null = null) {}

  async get() {
    return this.hash;
  }

  async saveIfAbsent(hash: string) {
    if (this.hash !== null) return false;
    this.hash = hash;
    return true;
  }
}

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
