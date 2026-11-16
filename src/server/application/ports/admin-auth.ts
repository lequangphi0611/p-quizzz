/** Hashes mentor passwords. Never log or return a password or a stored hash. */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, stored: string): Promise<boolean>;
}

/** Where the mentor's password hash lives. */
export interface AdminCredentialStore {
  /** The stored hash, or null before first-run setup. */
  get(): Promise<string | null>;
  /** Stores the hash only if none exists yet; false when one already did. The check is atomic, so two concurrent setups cannot both win. */
  saveIfAbsent(hash: string): Promise<boolean>;
}

/** Logged-in mentor tokens. In memory only: restarting the server means logging in again. */
export interface AdminSessionStore {
  add(token: string): void;
  has(token: string | undefined): boolean;
  revoke(token: string | undefined): void;
}
