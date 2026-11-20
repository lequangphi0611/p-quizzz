import { eq } from 'drizzle-orm';
import type { ShareTokenStore } from '../../application/ports/share.js';
import { appMeta } from './schema.js';
import type { DbAccess } from './drizzle-exam-repository.js';

const META_KEY = 'share_token';

/** The share page's token in `app_meta` (PRODUCT.md §7.33b). */
export class DrizzleShareTokenStore implements ShareTokenStore {
  constructor(
    private readonly access: DbAccess,
    private readonly now: () => Date,
  ) {}

  async get(): Promise<string | null> {
    return (await this.access(db => db.select().from(appMeta).where(eq(appMeta.key, META_KEY)).get()))?.value ?? null;
  }

  // The key is the primary key: two first requests at once keep whichever insert landed first.
  async getOrCreate(candidate: string): Promise<string> {
    return this.access(db => {
      db.insert(appMeta).values({ key: META_KEY, value: candidate, updatedAt: this.now() }).onConflictDoNothing().run();
      return db.select().from(appMeta).where(eq(appMeta.key, META_KEY)).get()!.value;
    });
  }

  async replace(token: string): Promise<void> {
    await this.access(db =>
      db.insert(appMeta).values({ key: META_KEY, value: token, updatedAt: this.now() }).onConflictDoUpdate({ target: appMeta.key, set: { value: token, updatedAt: this.now() } }).run(),
    );
  }
}
