import { describe, expect, it } from 'vitest';
import { MASK, maskSecrets } from './secrets.js';

describe('maskSecrets', () => {
  it.each([
    ['an OpenAI-style key', 'dùng sk-live-abcdefghijklmnop1234 để gọi', 'sk-live-abcdefghijklmnop1234'],
    ['an AWS access key id', 'key AKIAIOSFODNN7EXAMPLE nè', 'AKIAIOSFODNN7EXAMPLE'],
    ['a GitHub token', 'git clone https://ghp_abcdefghijklmnopqrstuvwxyz0123456789@github.com/x/y', 'ghp_abcdefghijklmnopqrstuvwxyz0123456789'],
    ['a Slack token', 'SLACK=xoxb-1234567890-abcdefghij', 'xoxb-1234567890-abcdefghij'],
    ['a private key header', '-----BEGIN RSA PRIVATE KEY-----\nMIIE', '-----BEGIN RSA PRIVATE KEY-----'],
    ['a JWT', 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop'],
    ['a password assignment', 'DB_PASSWORD=hunter2hunter2', 'hunter2hunter2'],
    ['a quoted api key', `api_key: "abcd1234efgh5678"`, 'abcd1234efgh5678'],
  ])('masks %s', (_name, text, secret) => {
    const masked = maskSecrets(text);
    expect(masked).not.toContain(secret);
    expect(masked).toContain(MASK);
  });

  it('masks every occurrence, not only the first', () => {
    const masked = maskSecrets('sk-aaaaaaaaaaaaaaaaaaaa rồi lại sk-bbbbbbbbbbbbbbbbbbbb');
    expect(masked.split(MASK)).toHaveLength(3);
    expect(masked).not.toMatch(/sk-[ab]{10}/);
  });

  it('leaves ordinary text, short values and code alone', () => {
    const text = 'Viết hàm cộng hai số\nnpm test\nconst token = next();\npassword=abc';
    expect(maskSecrets(text)).toBe(text);
  });

  it('can be applied twice without changing the result', () => {
    const once = maskSecrets('TOKEN=abcdefgh12345678');
    expect(maskSecrets(once)).toBe(once);
  });
});
