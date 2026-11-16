import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from '../db/client.js';
import { appMeta } from '../db/schema.js';

export const ADMIN_COOKIE = 'pq_admin';
const META_KEY = 'admin_password_hash';
const KEY_LEN = 64;
const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

// Stored as "<salt hex>:<hash hex>". Never log or return either the password or this value.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LEN);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Per-app auth state. Session tokens live in memory only: restarting the server means logging in again.
export function createMentorAuth(db: Db) {
  const tokens = new Set<string>();

  const getHash = () => db.select().from(appMeta).where(eq(appMeta.key, META_KEY)).get()?.value ?? null;

  return {
    isSetup: () => getHash() !== null,
    // Returns false when a password already exists. The insert is the atomic check (the key is the primary key),
    // so two concurrent setups cannot both win even though hashing awaits in between.
    async setPassword(password: string): Promise<boolean> {
      const value = await hashPassword(password);
      const res = db.insert(appMeta).values({ key: META_KEY, value, updatedAt: new Date() }).onConflictDoNothing().run();
      return res.changes > 0;
    },
    async checkPassword(password: string) {
      const stored = getHash();
      return stored !== null && verifyPassword(password, stored);
    },
    issueToken() {
      const token = randomBytes(32).toString('base64url');
      tokens.add(token);
      return token;
    },
    hasToken: (token: string | undefined) => !!token && tokens.has(token),
    revoke: (token: string | undefined) => void (token && tokens.delete(token)),
  };
}
export type MentorAuth = ReturnType<typeof createMentorAuth>;

// onRequest hook for every /api/admin/* route except setup, login and status.
export function requireMentor(auth: MentorAuth) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!auth.hasToken(req.cookies[ADMIN_COOKIE])) return reply.code(401).send({ error: 'Cần đăng nhập' });
  };
}
