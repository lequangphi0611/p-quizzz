import { deflateRawSync } from 'node:zlib';
import type { ArchiveFile, ArchiveWriter } from '../../application/ports/archive-writer.js';
import type { Clock } from '../../application/ports/clock.js';

// A zip writer small enough to read in one sitting, so no library is needed (docs/architecture.md §11.10). It writes the plain
// format (no Zip64): up to 65 535 files and 4 GiB per file and in all, far above what an export can reach.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const UTF8_FLAG = 0x0800;
const DEFLATE = 8;
const VERSION = 20;
const LIMIT = 0xffffffff;

/** MS-DOS date and time, local, two-second steps. */
function dosStamp(d: Date): { time: number; date: number } {
  const year = Math.min(Math.max(d.getFullYear(), 1980), 2107);
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

interface Entry {
  name: Buffer;
  crc: number;
  compressed: Buffer;
  size: number;
  offset: number;
}

export class NodeZipWriter implements ArchiveWriter {
  constructor(private readonly clock: Clock) {}

  async zip(files: readonly ArchiveFile[]): Promise<Buffer> {
    if (files.length > 0xffff) throw new RangeError('Too many files for a zip');
    const { time, date } = dosStamp(this.clock.now());
    const parts: Buffer[] = [];
    const entries: Entry[] = [];
    let offset = 0;

    for (const file of files) {
      const name = Buffer.from(file.name, 'utf8');
      const data = Buffer.from(file.content, 'utf8');
      const compressed = deflateRawSync(data);
      if (data.length > LIMIT || compressed.length > LIMIT || offset > LIMIT) throw new RangeError('File too large for a zip');
      const entry: Entry = { name, crc: crc32(data), compressed, size: data.length, offset };
      const header = Buffer.alloc(30);
      header.writeUInt32LE(0x04034b50, 0);
      header.writeUInt16LE(VERSION, 4);
      header.writeUInt16LE(UTF8_FLAG, 6);
      header.writeUInt16LE(DEFLATE, 8);
      header.writeUInt16LE(time, 10);
      header.writeUInt16LE(date, 12);
      header.writeUInt32LE(entry.crc, 14);
      header.writeUInt32LE(compressed.length, 18);
      header.writeUInt32LE(entry.size, 22);
      header.writeUInt16LE(name.length, 26);
      header.writeUInt16LE(0, 28);
      parts.push(header, name, compressed);
      offset += header.length + name.length + compressed.length;
      entries.push(entry);
    }

    const centralStart = offset;
    for (const e of entries) {
      const header = Buffer.alloc(46);
      header.writeUInt32LE(0x02014b50, 0);
      header.writeUInt16LE(VERSION, 4);
      header.writeUInt16LE(VERSION, 6);
      header.writeUInt16LE(UTF8_FLAG, 8);
      header.writeUInt16LE(DEFLATE, 10);
      header.writeUInt16LE(time, 12);
      header.writeUInt16LE(date, 14);
      header.writeUInt32LE(e.crc, 16);
      header.writeUInt32LE(e.compressed.length, 20);
      header.writeUInt32LE(e.size, 24);
      header.writeUInt16LE(e.name.length, 28);
      header.writeUInt32LE(e.offset, 42);
      parts.push(header, e.name);
      offset += header.length + e.name.length;
    }
    if (offset > LIMIT) throw new RangeError('Archive too large for a zip');

    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(offset - centralStart, 12);
    end.writeUInt32LE(centralStart, 16);
    parts.push(end);
    return Buffer.concat(parts);
  }
}
