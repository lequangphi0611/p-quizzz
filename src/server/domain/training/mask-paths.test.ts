import { describe, expect, it } from 'vitest';
import { maskHomePaths } from './mask-paths.js';

describe('maskHomePaths', () => {
  it('masks /home/<name> and /Users/<name>, keeping the rest of the path', () => {
    expect(maskHomePaths('Read /home/lan/bai-tap/src/cart.ts')).toBe('Read ~/bai-tap/src/cart.ts');
    expect(maskHomePaths('cd /Users/Lan Nguyen/x')).toBe('cd ~ Nguyen/x'); // a space ends the name: the path is not quoted
    expect(maskHomePaths('cd "/Users/lan.nguyen/x"')).toBe('cd "~/x"');
    expect(maskHomePaths('ls /Users/lan')).toBe('ls ~');
  });

  it('masks /var/home/<name> and the WSL form /mnt/<drive>/Users/<name>', () => {
    expect(maskHomePaths('Read /var/home/lan/bai-tap/a.ts')).toBe('Read ~/bai-tap/a.ts');
    expect(maskHomePaths('cd /mnt/c/Users/Lan/bai-tap')).toBe('cd ~/bai-tap');
    expect(maskHomePaths('cd /mnt/D/users/lan')).toBe('cd ~');
    expect(maskHomePaths('/var/lib/x /mnt/data/y')).toBe('/var/lib/x /mnt/data/y');
  });

  it('masks Windows paths on any drive, with backslash or slash, whatever the case of Users', () => {
    expect(maskHomePaths(String.raw`Get-ChildItem C:\Users\Lan\bai-tap\src`)).toBe(String.raw`Get-ChildItem ~\bai-tap\src`);
    expect(maskHomePaths('type D:/Users/lan/notes.txt')).toBe('type ~/notes.txt');
    expect(maskHomePaths(String.raw`e:\users\LAN\x`)).toBe(String.raw`~\x`);
    expect(maskHomePaths(String.raw`"C:\Users\Lan Pham\x"`)).toBe(String.raw`"~ Pham\x"`);
  });

  it('masks several paths in one text and in many lines', () => {
    expect(maskHomePaths('✓ Read /home/a/x\n✗ Bash cat C:\\Users\\b\\y /Users/c/z')).toBe('✓ Read ~/x\n✗ Bash cat ~\\y ~/z');
  });

  it('leaves relative and unrelated paths alone', () => {
    for (const same of ['src/home/foo', './home/x', 'Read src/cart.ts', '~/bai-tap', '/homework/a', 'https://x.test/Users', 'the Users folder', 'C:\\Program Files\\x', '/usr/local/bin']) {
      expect(maskHomePaths(same), same).toBe(same);
    }
  });

  it('is idempotent', () => {
    const once = maskHomePaths('Read /home/lan/a C:\\Users\\Lan\\b');
    expect(maskHomePaths(once)).toBe(once);
  });
});
