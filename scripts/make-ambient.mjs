import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function wavNoise(seconds, volume = 0.08, tone = 0) {
  const rate = 22050;
  const n = Math.floor(rate * seconds);
  const data = Buffer.alloc(44 + n * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(36 + n * 2, 4);
  data.write('WAVE', 8);
  data.write('fmt ', 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(n * 2, 40);
  let noise = 0;
  for (let i = 0; i < n; i++) {
    noise = noise * 0.96 + (Math.random() * 2 - 1) * 0.04;
    const hum = tone ? Math.sin((2 * Math.PI * tone * i) / rate) * 0.03 : 0;
    const sample = Math.max(-1, Math.min(1, noise * volume * 12 + hum));
    data.writeInt16LE(sample * 32767, 44 + i * 2);
  }
  return data;
}

const root = join(process.cwd(), 'public', 'assets', 'audio');
const ambient = join(root, 'ambient');
const music = join(root, 'music');
mkdirSync(ambient, { recursive: true });
mkdirSync(music, { recursive: true });

const clips = {
  traffic: wavNoise(4, 0.12, 90),
  home: wavNoise(4, 0.04, 180),
  school: wavNoise(4, 0.07, 240),
  shop: wavNoise(4, 0.08, 140),
  birds: wavNoise(4, 0.06, 520),
  animals: wavNoise(4, 0.1, 110),
};
for (const [name, buf] of Object.entries(clips)) {
  writeFileSync(join(ambient, `${name}.wav`), buf);
}
writeFileSync(join(music, 'theme.wav'), wavNoise(6, 0.05, 220));
console.log('Wrote ambient wav placeholders');
