import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'public', 'assets', 'audio', 'vo');

function loadEnv() {
  const text = fs.readFileSync(path.join(root, '.env'), 'utf8');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

function redact(message, secrets) {
  let out = String(message);
  for (const secret of secrets) {
    if (secret) out = out.split(secret).join('[redacted]');
  }
  return out.slice(0, 400);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pcmToWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function lines() {
  const situations = JSON.parse(fs.readFileSync(path.join(root, 'content', 'situations.json'), 'utf8'));
  const characters = JSON.parse(fs.readFileSync(path.join(root, 'content', 'characters.json'), 'utf8'));
  const clips = [];
  const list = Array.isArray(situations) ? situations : situations.situations ?? [];
  for (const situation of list) {
    if (!situation?.id || !situation.description) continue;
    clips.push({ id: `sit-${situation.id}`, text: situation.description });
  }
  const people = [...(characters.players ?? []), ...(characters.npcs ?? [])];
  for (const person of people) {
    clips.push({ id: `talk-${person.id}`, text: `שלום! אני ${person.name}.` });
    clips.push({ id: `talk-${person.id}-happy`, text: `${person.name}: היי! כיף לראות אותך.` });
    clips.push({ id: `talk-${person.id}-angry`, text: `${person.name}: עכשיו קצת קשה לי.` });
    clips.push({ id: `talk-${person.id}-sad`, text: `${person.name}: היי. יום לא פשוט.` });
  }
  return clips;
}

async function listTtsModels(key) {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', {
    headers: { 'x-goog-api-key': key },
  });
  const json = await res.json();
  if (!res.ok) {
    return { status: res.status, models: [], error: json.error?.message ?? json.error?.status ?? 'list failed' };
  }
  const models = (json.models ?? [])
    .map((model) => model.name?.replace('models/', '') ?? '')
    .filter((name) => /tts|preview/i.test(name) && /tts/i.test(name));
  return { status: res.status, models };
}

async function synthesize(key, model, text) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': key,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Leda' } } },
      },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error?.message ?? `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const inline = json.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;
  if (!inline?.data) throw new Error('response had no audio');
  return inline;
}

function writeAudio(file, inline) {
  const bytes = Buffer.from(inline.data, 'base64');
  const mime = inline.mimeType ?? '';
  if (mime.includes('wav')) {
    fs.writeFileSync(file, bytes);
    return;
  }
  const rateMatch = mime.match(/rate=(\d+)/);
  const rate = rateMatch ? Number(rateMatch[1]) : 24000;
  fs.writeFileSync(file, pcmToWav(bytes, rate));
}

const env = loadEnv();
const key = env.GEMINI_API_KEY;
const secrets = Object.values(env).filter((value) => value && value.length > 8);
if (!key) {
  console.error('GEMINI_API_KEY missing');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const clips = lines();
console.log(`clips ${clips.length}`);

const listed = await listTtsModels(key);
console.log(`models status ${listed.status} tts ${listed.models.join(', ') || '(none)'}`);
if (listed.error) console.log(redact(listed.error, secrets));

const models = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview'];
console.log(`rotate ${models.join(', ')}`);

let cursor = 0;
async function synthesizeNext(text) {
  let lastError = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = models[attempt % models.length];
    try {
      const audio = await synthesize(key, candidate, text);
      return audio;
    } catch (error) {
      lastError = error;
      const wait = error.status === 429 ? 20000 : 4000;
      console.log(`wait ${candidate} ${error.status ?? ''} ${redact(error.message, secrets)}`);
      await sleep(wait);
    }
  }
  throw lastError ?? new Error('tts failed');
}

let written = 0;
let failed = 0;
let burst = 0;
for (const clip of clips) {
  const file = path.join(outDir, `${clip.id}.wav`);
  if (fs.existsSync(file) && fs.statSync(file).size > 1000) {
    written += 1;
    continue;
  }
  const model = models[burst % models.length];
  try {
    const inline = await synthesize(key, model, clip.text);
    writeAudio(file, inline);
    written += 1;
    burst += 1;
    console.log(`ok ${clip.id}`);
    if (burst % 6 === 0) await sleep(65000);
    else await sleep(1200);
  } catch (error) {
    failed += 1;
    console.log(`skip ${clip.id} ${error?.status ?? ''} ${redact(error?.message, secrets)}`);
    if (error?.status === 429) await sleep(65000);
  }
}

console.log(`done written ${written} failed ${failed}`);
if (failed) process.exit(3);
