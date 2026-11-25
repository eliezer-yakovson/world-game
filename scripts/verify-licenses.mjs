import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = join(process.cwd(), 'public', 'assets');
const ALLOWED = new Set(['.glb', '.gltf', '.png', '.jpg', '.jpeg', '.webp', '.mp3', '.ogg', '.wav', '.svg', '.md', '.gitkeep', '.txt']);

/** Files that must never ship (common proprietary / non-commercial markers). */
const BLOCKED_NAME_PARTS = ['all-rights-reserved', 'noncommercial', 'editorial-only'];

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}

const files = walk(ROOT);
let ok = true;
for (const file of files) {
  const lower = file.toLowerCase();
  const ext = extname(lower);
  if (ext && !ALLOWED.has(ext) && !lower.endsWith('gitkeep')) {
    console.error('Extention not allowed:', file);
    ok = false;
  }
  for (const part of BLOCKED_NAME_PARTS) {
    if (lower.includes(part)) {
      console.error('Blocked license marker in filename:', file);
      ok = false;
    }
  }
}

if (ok) {
  console.log(`License verify OK (${files.length} files under public/assets). Remember: only CC0/MIT/Apache assets.`);
  process.exit(0);
}
process.exit(1);
