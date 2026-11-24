import { inflateRawSync } from 'node:zlib';
import { crc32 } from './node-zip-writer.js';

/**
 * A reader for the zips this app writes, for tests. It walks the central directory the way `unzip` does, inflates each entry
 * and checks its CRC and size, so a wrong header fails here instead of on the mentor's machine.
 */
export function readZip(zip: Buffer): Map<string, string> {
  const eocd = zip.length - 22;
  if (zip.readUInt32LE(eocd) !== 0x06054b50) throw new Error('no end-of-central-directory record');
  const count = zip.readUInt16LE(eocd + 10);
  let pos = zip.readUInt32LE(eocd + 16);
  const out = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(pos) !== 0x02014b50) throw new Error(`bad central header #${i}`);
    const method = zip.readUInt16LE(pos + 10);
    const crc = zip.readUInt32LE(pos + 16);
    const csize = zip.readUInt32LE(pos + 20);
    const size = zip.readUInt32LE(pos + 24);
    const nameLen = zip.readUInt16LE(pos + 28);
    const extraLen = zip.readUInt16LE(pos + 30);
    const commentLen = zip.readUInt16LE(pos + 32);
    const local = zip.readUInt32LE(pos + 42);
    const name = zip.subarray(pos + 46, pos + 46 + nameLen).toString('utf8');
    if (zip.readUInt32LE(local) !== 0x04034b50) throw new Error(`bad local header for ${name}`);
    const dataStart = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    if (method !== 8) throw new Error(`${name}: unexpected method ${method}`);
    const data = inflateRawSync(zip.subarray(dataStart, dataStart + csize));
    if (data.length !== size) throw new Error(`${name}: size ${data.length} != ${size}`);
    if (crc32(data) !== crc) throw new Error(`${name}: crc mismatch`);
    out.set(name, data.toString('utf8'));
    pos += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
