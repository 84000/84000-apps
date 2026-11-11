import { inflateRawSync } from 'node:zlib';

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** The entries of a zip archive, by name. Stored and deflated entries only. */
export function readZip(data: Buffer): Map<string, Buffer> {
  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) {
    if (data.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a zip file.');
  const count = data.readUInt16LE(eocd + 10);
  let at = data.readUInt32LE(eocd + 16);
  const entries = new Map<string, Buffer>();
  for (let n = 0; n < count; n++) {
    if (data.readUInt32LE(at) !== CENTRAL)
      throw new Error('Corrupt zip: bad central directory.');
    const method = data.readUInt16LE(at + 10);
    const size = data.readUInt32LE(at + 20);
    const nameLength = data.readUInt16LE(at + 28);
    const extraLength = data.readUInt16LE(at + 30);
    const commentLength = data.readUInt16LE(at + 32);
    const local = data.readUInt32LE(at + 42);
    const name = data.toString('utf8', at + 46, at + 46 + nameLength);
    at += 46 + nameLength + extraLength + commentLength;
    if (size === 0xffffffff || local === 0xffffffff)
      throw new Error(`Zip64 is not supported (${name}).`);
    if (data.readUInt32LE(local) !== LOCAL)
      throw new Error(`Corrupt zip: bad local header for ${name}.`);
    const start =
      local +
      30 +
      data.readUInt16LE(local + 26) +
      data.readUInt16LE(local + 28);
    const body = data.subarray(start, start + size);
    if (method === 0) entries.set(name, body);
    else if (method === 8) entries.set(name, inflateRawSync(body));
    else throw new Error(`Unsupported zip compression ${method} (${name}).`);
  }
  return entries;
}
