import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join } from 'node:path';

/** Minimal 32x32 RGBA PNG generator (solid teal rounded-ish square). */
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function png(size = 32) {
  const { 0: r, 1: g, 2: b } = [61, 155, 143];
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x++) {
      const edge = x < 2 || y < 2 || x >= size - 2 || y >= size - 2;
      const i = 1 + x * 4;
      row[i] = edge ? 26 : r;
      row[i + 1] = edge ? 35 : g;
      row[i + 2] = edge ? 50 : b;
      row[i + 3] = 255;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = join(process.cwd(), 'src-tauri', 'icons');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'icon.png'), png(32));
writeFileSync(join(dir, '32x32.png'), png(32));
writeFileSync(join(dir, '128x128.png'), png(128));
writeFileSync(join(dir, 'henry.w@example.net'), png(256));
writeFileSync(join(dir, 'icon.ico'), png(32)); // placeholder; tauri may prefer real ico
console.log('Icons written to src-tauri/icons');
