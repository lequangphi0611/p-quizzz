import type { ShareTokenStore } from '../ports/share.js';

/** Test double for the share page's token (PRODUCT.md §7.33b). */
export class InMemoryShareTokenStore implements ShareTokenStore {
  private token: string | null = null;

  async get() {
    return this.token;
  }

  async getOrCreate(candidate: string) {
    this.token ??= candidate;
    return this.token;
  }

  async replace(token: string) {
    this.token = token;
  }
}
