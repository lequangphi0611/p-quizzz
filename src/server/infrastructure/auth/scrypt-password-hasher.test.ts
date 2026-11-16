import { describe, expect, it } from 'vitest';
import { ScryptPasswordHasher } from './scrypt-password-hasher.js';

describe('ScryptPasswordHasher', () => {
  it('verifies the right password only, with a fresh salt each time', async () => {
    const h = new ScryptPasswordHasher();
    const a = await h.hash('secret1');
    const b = await h.hash('secret1');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(await h.verify('secret1', a)).toBe(true);
    expect(await h.verify('secret2', a)).toBe(false);
    expect(await h.verify('secret1', 'garbage')).toBe(false);
  });
});
