import { eq } from 'drizzle-orm';
import type { AdminCredentialStore } from '../../application/ports/admin-auth.js';
import { appMeta } from '../../db/schema.js';
import type { DbAccess } from './drizzle-exam-repository.js';

const META_KEY = 'admin_password_hash';

/** The hash lives in `app_meta` as "<salt hex>:<hash hex>". */
export class DrizzleAdminCredentialStore implements AdminCredentialStore {
  constructor(
    private readonly access: DbAccess,
    private readonly now: () => Date,
  ) {}

  async get(): Promise<string | null> {
    return (await this.access(db => db.select().from(appMeta).where(eq(appMeta.key, META_KEY)).get()))?.value ?? null;
  }

  // The insert is the atomic check (the key is the primary key): conflict means someone else set it first.
  async saveIfAbsent(hash: string): Promise<boolean> {
    const res = await this.access(db => db.insert(appMeta).values({ key: META_KEY, value: hash, updatedAt: this.now() }).onConflictDoNothing().run());
    return res.changes > 0;
  }
}
