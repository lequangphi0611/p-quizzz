import { AdminAlreadySetupError, InvalidCredentialsError } from '../../../domain/auth/errors.js';
import type { AdminCredentialStore, AdminSessionStore, PasswordHasher } from '../../ports/admin-auth.js';
import type { TokenGenerator } from '../../ports/token-generator.js';

interface Deps {
  credentials: AdminCredentialStore;
  sessions: AdminSessionStore;
  hasher: PasswordHasher;
  tokens: TokenGenerator;
}

export interface AdminStatusResult {
  setupDone: boolean;
  loggedIn: boolean;
}

export class GetAdminStatus {
  constructor(private readonly deps: Pick<Deps, 'credentials' | 'sessions'>) {}

  async execute(token: string | undefined): Promise<AdminStatusResult> {
    return { setupDone: (await this.deps.credentials.get()) !== null, loggedIn: this.deps.sessions.has(token) };
  }
}

/** First-run password setup. Returns a logged-in token. */
export class SetupAdmin {
  constructor(private readonly deps: Deps) {}

  async execute(password: string): Promise<string> {
    if ((await this.deps.credentials.get()) !== null) throw new AdminAlreadySetupError();
    // The atomic insert is the real check: hashing awaits, so two setups can both pass the one above.
    if (!(await this.deps.credentials.saveIfAbsent(await this.deps.hasher.hash(password)))) throw new AdminAlreadySetupError();
    return issue(this.deps);
  }
}

/** Returns a logged-in token. Same `InvalidCredentialsError` whether the password is wrong or none is set up. */
export class LoginAdmin {
  constructor(private readonly deps: Deps) {}

  async execute(password: string): Promise<string> {
    const stored = await this.deps.credentials.get();
    if (stored === null || !(await this.deps.hasher.verify(password, stored))) throw new InvalidCredentialsError();
    return issue(this.deps);
  }
}

export class LogoutAdmin {
  constructor(private readonly sessions: AdminSessionStore) {}

  execute(token: string | undefined): void {
    this.sessions.revoke(token);
  }
}

/** Is this token a logged-in mentor? Backs the `requireMentor` hook. */
export class AuthenticateAdmin {
  constructor(private readonly sessions: AdminSessionStore) {}

  execute(token: string | undefined): boolean {
    return this.sessions.has(token);
  }
}

function issue({ tokens, sessions }: Deps): string {
  const token = tokens.generate();
  sessions.add(token);
  return token;
}
