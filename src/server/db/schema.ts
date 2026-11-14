// Drizzle schema. Entities follow docs/PRODUCT.md §3 (Exam, Session, Participant, Attempt, Answer).
// Tables are added feature by feature; run `npm run db:generate` after changing this file.
import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
