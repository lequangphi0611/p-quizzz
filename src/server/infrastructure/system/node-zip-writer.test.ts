import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FakeClock } from '../../application/testing/fakes.js';
import { readZip } from './zip-test-reader.js';
import { crc32, NodeZipWriter } from './node-zip-writer.js';

const writer = () => new NodeZipWriter(new FakeClock(new Date(2026, 10, 24, 9, 30, 10)));

describe('crc32', () => {
  it('matches the known check value', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
    expect(crc32(Buffer.alloc(0))).toBe(0);
  });
});

describe('NodeZipWriter', () => {
  it('writes files that read back whole, with UTF-8 text, empty files and a big file', async () => {
    const big = 'dòng dài có dấu\n'.repeat(50_000);
    const zip = await writer().zip([
      { name: '00-tong-quan.md', content: '# Tổng quan\nxin chào ✓' },
      { name: '01-lan.md', content: '' },
      { name: '02-mai.md', content: big },
    ]);
    const files = readZip(zip);
    expect([...files.keys()]).toEqual(['00-tong-quan.md', '01-lan.md', '02-mai.md']);
    expect(files.get('00-tong-quan.md')).toBe('# Tổng quan\nxin chào ✓');
    expect(files.get('01-lan.md')).toBe('');
    expect(files.get('02-mai.md')).toBe(big);
  });

  it('writes an empty archive that is still a valid zip', async () => {
    expect(readZip(await writer().zip([])).size).toBe(0);
  });

  it('stamps the entries with the clock, local time', async () => {
    const zip = await writer().zip([{ name: 'a.md', content: 'x' }]);
    const central = zip.readUInt32LE(zip.length - 6);
    const time = zip.readUInt16LE(central + 12);
    const date = zip.readUInt16LE(central + 14);
    expect([time >> 11, (time >> 5) & 63, (time & 31) * 2]).toEqual([9, 30, 10]);
    expect([(date >> 9) + 1980, (date >> 5) & 15, date & 31]).toEqual([2026, 11, 24]);
  });

  // The system tool is the real judge of compatibility; skipped where it is not installed (Windows).
  it.skipIf(!hasUnzip())('is accepted by the system unzip', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'zip-test-'));
    try {
      const file = join(dir, 'out.zip');
      writeFileSync(file, await writer().zip([{ name: '01-lan.md', content: 'Tiếng Việt có dấu' }, { name: '02-mai.md', content: 'b' }]));
      execFileSync('unzip', ['-tq', file]);
      execFileSync('unzip', ['-q', '-d', join(dir, 'x'), file]);
      expect(readFileSync(join(dir, 'x', '01-lan.md'), 'utf8')).toBe('Tiếng Việt có dấu');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function hasUnzip(): boolean {
  try {
    execFileSync('unzip', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
