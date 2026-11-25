import * as THREE from 'three';

const CLIP: Record<string, RegExp> = {
  walk: /walk/i,
  run: /run/i,
  idle: /idle/i,
  stomp: /punch|slash/i,
  clean: /pick/i,
  // SitDown only. A broader /defeat|death/ match hits Death first and the character collapses.
  sad: /sitdown/i,
  hide: /sit/i,
  sit: /sitdown/i,
  stand: /standup/i,
  jump: /jump/i,
  play: /jump|victory/i,
  talk: /idle/i,
  phone: /idle/i,
  cook: /pick/i,
  whisper: /idle/i,
};

export function pickClip(clips: THREE.AnimationClip[], kind: string): THREE.AnimationClip | undefined {
  const re = CLIP[kind] ?? /idle/i;
  return clips.find((clip) => re.test(clip.name)) ?? clips.find((clip) => /idle/i.test(clip.name)) ?? clips[0];
}

export function reactionKind(text: string): string {
  if (/כעס|נעל|בורח|נבהל|אנח|עזב|כבד|מתלהט|מתכווץ/.test(text)) return 'sad';
  if (/חייכ|כיף|כבוד|מסכימ|גאה|צוחק|נעים|מהנהנ|מרגיע/.test(text)) return 'play';
  return 'talk';
}
