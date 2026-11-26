import * as THREE from 'three';
import type { StrengthMap } from '../core/types';
import { box, cyl, mats } from './materials';

/**
 * Park playground. Scripted rides (slide, climb, bars) follow each rider's
 * own timer. Rocking and spinning rides share one clock so the seat and the
 * rider stay on the same angle.
 */

export interface RidePose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  emote: string;
  loop: boolean;
  line: string;
}

interface Ride {
  id: string;
  name: string;
  blurb: string;
  duration: number;
  slots: number;
  awards: Partial<StrengthMap>;
  slotLabel: (slot: number) => string;
  approach: (slot: number) => { x: number; z: number };
  sample: (slot: number, t: number) => RidePose;
  spin?: (root: THREE.Object3D) => void;
}

const paint = {
  red: new THREE.MeshStandardMaterial({ color: 0xd64545, roughness: 0.55 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.55 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x3d7ec9, roughness: 0.55 }),
  green: new THREE.MeshStandardMaterial({ color: 0x3c9a5a, roughness: 0.55 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xe07a5f, roughness: 0.55 }),
  purple: new THREE.MeshStandardMaterial({ color: 0x7d5cbf, roughness: 0.55 }),
  pink: new THREE.MeshStandardMaterial({ color: 0xe38bb0, roughness: 0.55 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf7f4ee, roughness: 0.6 }),
  brown: new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.75 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2f343c, roughness: 0.7 }),
};

let rideNow = 0;

export function setRideNow(time: number): void {
  rideNow = time;
}

function grounded(at: { x: number; z: number }, yaw: number): RidePose {
  return { x: at.x, y: 0, z: at.z, yaw, pitch: 0, roll: 0, emote: 'idle', loop: true, line: '' };
}

function lerpAngle(a: number, b: number, u: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * u;
}

function mix(from: RidePose, to: RidePose, u: number, line: string): RidePose {
  const e = THREE.MathUtils.clamp(u, 0, 1);
  const s = e * e * (3 - 2 * e);
  return {
    x: THREE.MathUtils.lerp(from.x, to.x, s),
    y: THREE.MathUtils.lerp(from.y, to.y, s),
    z: THREE.MathUtils.lerp(from.z, to.z, s),
    yaw: lerpAngle(from.yaw, to.yaw, s),
    pitch: THREE.MathUtils.lerp(from.pitch, to.pitch, s),
    roll: THREE.MathUtils.lerp(from.roll, to.roll, s),
    emote: s < 0.4 ? 'walk' : to.emote,
    loop: s < 0.4 ? true : to.loop,
    line,
  };
}

/** Mount, hold the live pose, then step back to the approach. */
function cycle(
  t: number,
  duration: number,
  approach: { x: number; z: number },
  live: () => RidePose,
  mountLine: string,
  mount = 0.7,
  leave = 0.75,
): RidePose {
  const pose = live();
  if (t < mount) return mix(grounded(approach, pose.yaw), pose, t / mount, mountLine);
  if (t > duration - leave) return mix(pose, grounded(approach, pose.yaw), (t - (duration - leave)) / leave, 'יורד מהמתקן');
  return pose;
}

function smooth(t: number, start: number, end: number): number {
  if (t <= start) return 0;
  if (t >= end) return 1;
  const u = (t - start) / (end - start);
  return u * u * (3 - 2 * u);
}

/** Local point on a pivot that rolls around Z. */
function aroundZ(px: number, py: number, pz: number, lx: number, ly: number, lz: number, angle: number): { x: number; y: number; z: number } {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: px + lx * c - ly * s, y: py + lx * s + ly * c, z: pz + lz };
}

/** Local point on a pivot that swings around X. */
function aroundX(px: number, py: number, pz: number, lx: number, ly: number, lz: number, angle: number): { x: number; y: number; z: number } {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: px + lx, y: py + ly * c - lz * s, z: pz + ly * s + lz * c };
}

/** Local point on a pivot that spins around Y. */
function aroundY(px: number, py: number, pz: number, lx: number, ly: number, lz: number, angle: number): { x: number; y: number; z: number } {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: px + lx * c + lz * s, y: py + ly, z: pz - lx * s + lz * c };
}

function rig(name: string, x: number, y: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(x, y, z);
  return group;
}

function slope(x: number, z0: number, y0: number, z1: number, y1: number, width: number, thick: number, material: THREE.Material): THREE.Mesh {
  const dz = z1 - z0;
  const dy = y1 - y0;
  const mesh = box(width, thick, Math.hypot(dz, dy), material, x, (y0 + y1) / 2, (z0 + z1) / 2);
  mesh.rotation.x = Math.atan2(y0 - y1, dz);
  return mesh;
}

const SLIDE = {
  x: 17,
  ladderZ: -6.55,
  topY: 3.05,
  standZ: -5.35,
  chuteZ0: -4.55,
  chuteZ1: -0.45,
  endY: 0.22,
  landZ: 0.35,
  approachZ: -7.45,
};

const HILL = { x: -19, z: 9, crest: 1.46 };
const HORSE = { x: 2, z: -12, seat: 0.94 };
const SWING = { x: 9, z: 13, hinge: 2.55, len: 2.02, gap: 0.72 };
const SEESAW = { x: 18, y: 0.5, z: 6, reach: 1.15 };
const WHEEL = { x: -8, z: -12, radius: 1.18, seat: 0.5 };
const CLIMB = { x: 21, z: -9, top: 1.62 };
const BARS = { z: -14, x0: 14.15, x1: 17.25, hang: 0.72 };
const SAND = { x: 11, z: -1 };
const TUNNEL = { z: -4, x0: -15.45, x1: -12.55 };
const NEST = { x: -18, z: -6, hinge: 2.2, len: 1.55 };
const DUCK = { x: 3, z: 15, seat: 0.72 };
const BEAM = { x: 21, z0: 0.55, z1: 3.45, y: 0.46 };
const SPIN = { x: -12, z: 12, radius: 0.58 };

function sampleSlide(_slot: number, t: number): RidePose {
  const base = { x: SLIDE.x, yaw: 0, roll: 0, loop: true };
  if (t < 2.6) {
    return {
      ...base,
      y: SLIDE.topY * smooth(t, 0.05, 2.5),
      z: SLIDE.ladderZ,
      pitch: 0,
      emote: 'walk',
      line: 'מטפס בסולם',
    };
  }
  if (t < 3.55) {
    const up = smooth(t, 2.6, 3.1);
    const toEdge = smooth(t, 3.1, 3.5);
    return {
      ...base,
      y: SLIDE.topY,
      z: THREE.MathUtils.lerp(THREE.MathUtils.lerp(SLIDE.ladderZ, SLIDE.standZ, up), SLIDE.chuteZ0, toEdge),
      pitch: 0,
      emote: toEdge > 0.2 ? 'idle' : 'walk',
      line: toEdge > 0.85 ? 'עומד בראש המגלשה' : 'עולה למשטח',
    };
  }
  if (t < 5.4) {
    const u = smooth(t, 3.55, 5.3);
    return {
      ...base,
      y: THREE.MathUtils.lerp(SLIDE.topY, SLIDE.endY, u),
      z: THREE.MathUtils.lerp(SLIDE.chuteZ0, SLIDE.chuteZ1, u),
      pitch: 0.5,
      emote: 'sit',
      loop: false,
      line: 'גולש למטה',
    };
  }
  const u = smooth(t, 5.4, 6.35);
  return {
    ...base,
    y: THREE.MathUtils.lerp(SLIDE.endY, 0, u),
    z: THREE.MathUtils.lerp(SLIDE.chuteZ1, SLIDE.landZ, u),
    pitch: THREE.MathUtils.lerp(0.5, 0, u),
    emote: u > 0.55 ? 'idle' : 'sit',
    loop: u > 0.55,
    line: 'נוחת',
  };
}

function hillPose(): RidePose {
  const angle = Math.sin(rideNow * 1.15) * 0.42;
  const at = aroundZ(HILL.x, 0, HILL.z, 0, HILL.crest, 0, angle);
  return {
    ...at,
    yaw: Math.PI / 2,
    pitch: 1.15,
    roll: angle,
    emote: 'idle',
    loop: true,
    line: 'שוכב על הר סל ומתנדנד',
  };
}

function horsePose(): RidePose {
  const angle = Math.sin(rideNow * 2.35) * 0.36;
  const at = aroundZ(HORSE.x, 0, HORSE.z, 0, HORSE.seat, 0.02, angle);
  return { ...at, yaw: 0, pitch: 0, roll: angle, emote: 'sit', loop: false, line: 'רוכב על סוס הנדנדה' };
}

function swingPose(slot: number): RidePose {
  const angle = Math.sin(rideNow * 2.15 + slot * 1.25) * 0.62;
  const x = SWING.x + (slot === 0 ? -SWING.gap : SWING.gap);
  const at = aroundX(x, SWING.hinge, SWING.z, 0, -SWING.len + 0.08, 0, angle);
  return { ...at, yaw: 0, pitch: angle, roll: 0, emote: 'sit', loop: false, line: 'מתנדנד קדימה ואחורה' };
}

function seesawPose(slot: number): RidePose {
  const angle = Math.sin(rideNow * 1.65) * 0.32;
  const lx = slot === 0 ? -SEESAW.reach : SEESAW.reach;
  const at = aroundZ(SEESAW.x, SEESAW.y, SEESAW.z, lx, 0.14, 0, angle);
  return {
    ...at,
    yaw: 0,
    pitch: 0,
    roll: angle,
    emote: 'sit',
    loop: false,
    line: 'מתנדנד על נדנדת האיזון',
  };
}

function wheelPose(): RidePose {
  const angle = rideNow * 0.62;
  const at = aroundY(WHEEL.x, WHEEL.seat, WHEEL.z, 0, 0, WHEEL.radius, angle);
  return { ...at, yaw: angle, pitch: 0, roll: 0, emote: 'sit', loop: false, line: 'מסתובב על הקרוסלה' };
}

function sampleClimb(_slot: number, t: number): RidePose {
  const base = { x: CLIMB.x, roll: 0, loop: true };
  if (t < 2.15) {
    return {
      ...base,
      y: CLIMB.top * smooth(t, 0.05, 2.05),
      z: CLIMB.z - 0.85,
      yaw: 0,
      pitch: 0.15,
      emote: 'walk',
      line: 'מטפס על המתקן',
    };
  }
  if (t < 3.55) {
    const u = smooth(t, 2.15, 3.45);
    return {
      ...base,
      y: CLIMB.top,
      z: THREE.MathUtils.lerp(CLIMB.z - 0.7, CLIMB.z + 0.7, u),
      yaw: 0,
      pitch: 0.35,
      emote: 'walk',
      line: 'חוצה את המתקן למעלה',
    };
  }
  const u = smooth(t, 3.55, 5.55);
  return {
    ...base,
    y: THREE.MathUtils.lerp(CLIMB.top, 0, u),
    z: CLIMB.z + 0.9,
    yaw: 0,
    pitch: 0.1 * (1 - u),
    emote: u > 0.85 ? 'idle' : 'walk',
    line: 'יורד מהמתקן',
  };
}

function sampleBars(_slot: number, t: number): RidePose {
  if (t < 1.25) {
    return {
      x: BARS.x0,
      y: BARS.hang * smooth(t, 0.05, 1.15),
      z: BARS.z,
      yaw: Math.PI / 2,
      pitch: 0,
      roll: 0,
      emote: 'walk',
      loop: true,
      line: 'מטפס אל סולם הקופים',
    };
  }
  if (t < 4.45) {
    const u = smooth(t, 1.25, 4.3);
    return {
      x: THREE.MathUtils.lerp(BARS.x0, BARS.x1, u),
      y: BARS.hang + Math.sin(t * 6) * 0.04,
      z: BARS.z,
      yaw: Math.PI / 2,
      pitch: 0.2,
      roll: 0,
      emote: 'idle',
      loop: true,
      line: 'מתקדם בידיים על הסולם',
    };
  }
  const u = smooth(t, 4.45, 5.45);
  return {
    x: BARS.x1,
    y: THREE.MathUtils.lerp(BARS.hang, 0, u),
    z: BARS.z,
    yaw: Math.PI / 2,
    pitch: 0,
    roll: 0,
    emote: u > 0.7 ? 'idle' : 'walk',
    loop: true,
    line: 'קופץ למטה',
  };
}

function sampleSand(_slot: number, t: number): RidePose {
  const playing = t < 6.2;
  const u = playing ? 0 : smooth(t, 6.2, 6.9);
  return {
    x: SAND.x + Math.sin(t * 1.4) * 0.22 * (1 - u),
    y: 0,
    z: THREE.MathUtils.lerp(SAND.z + Math.cos(t * 0.9) * 0.16, SAND.z + 1.35, u),
    yaw: Math.sin(t * 0.7) * 0.6 * (1 - u),
    pitch: 0.35 * (1 - u),
    roll: 0,
    emote: u > 0.5 ? 'idle' : 'play',
    loop: true,
    line: playing ? 'בונה בארגז החול' : 'קם מהחול',
  };
}

function sampleTunnel(_slot: number, t: number): RidePose {
  if (t < 3.55) {
    const u = smooth(t, 0.15, 3.4);
    return {
      x: THREE.MathUtils.lerp(TUNNEL.x0, TUNNEL.x1, u),
      y: 0.2,
      z: TUNNEL.z,
      yaw: Math.PI / 2,
      pitch: 1.05,
      roll: 0,
      emote: 'walk',
      loop: true,
      line: 'זוחל במנהרה',
    };
  }
  const u = smooth(t, 3.55, 4.2);
  return {
    x: TUNNEL.x1 + 0.7 * u,
    y: 0.2 * (1 - u),
    z: TUNNEL.z,
    yaw: Math.PI / 2,
    pitch: 1.05 * (1 - u),
    roll: 0,
    emote: u > 0.6 ? 'idle' : 'walk',
    loop: true,
    line: 'יוצא מהמנהרה',
  };
}

function nestPose(): RidePose {
  const angle = Math.sin(rideNow * 1.25) * 0.48;
  const at = aroundX(NEST.x, NEST.hinge, NEST.z, 0, -NEST.len + 0.16, 0, angle);
  return { ...at, yaw: 0, pitch: angle * 0.65, roll: 0, emote: 'sit', loop: false, line: 'יושב בנדנדת הקן' };
}

function duckPose(): RidePose {
  const wave = Math.sin(rideNow * 3.5);
  const bounce = Math.abs(wave);
  return {
    x: DUCK.x,
    y: DUCK.seat + bounce * 0.38 + 0.2,
    z: DUCK.z,
    yaw: Math.PI / 2,
    pitch: wave * 0.22,
    roll: 0,
    emote: 'sit',
    loop: false,
    line: 'קופץ על ברווז הקפיץ',
  };
}

function sampleBeam(_slot: number, t: number): RidePose {
  const trip = ((t % 6.4) / 6.4) * 2;
  const forth = trip < 1;
  const u = forth ? trip : 2 - trip;
  return {
    x: BEAM.x,
    y: BEAM.y,
    z: THREE.MathUtils.lerp(BEAM.z0, BEAM.z1, u),
    yaw: forth ? 0 : Math.PI,
    pitch: 0,
    roll: Math.sin(t * 5.2) * 0.1,
    emote: 'walk',
    loop: true,
    line: 'הולך על קורת שיווי המשקל',
  };
}

function spinPose(): RidePose {
  const angle = rideNow * 1.7;
  const at = aroundY(SPIN.x, 0.22, SPIN.z, SPIN.radius, 0, 0, angle);
  return { ...at, yaw: angle + Math.PI, pitch: 0, roll: 0.08, emote: 'idle', loop: true, line: 'מסתובב על הסביבון' };
}

const rides: Ride[] = [
  {
    id: 'slide',
    name: 'מגלשה ענקית',
    blurb: 'מטפסים בסולם, עומדים למעלה, ואז גולשים',
    duration: 6.5,
    slots: 1,
    awards: { courage: 1 },
    slotLabel: () => 'לטפס ולגלוש במגלשה הענקית',
    approach: () => ({ x: SLIDE.x, z: SLIDE.approachZ }),
    sample: sampleSlide,
  },
  {
    id: 'hill',
    name: 'הר סל',
    blurb: 'שוכבים על הר סל ומתנדנדים איתו',
    duration: 7.4,
    slots: 1,
    awards: { flexibility: 1 },
    slotLabel: () => 'לשכב על הר סל',
    approach: () => ({ x: HILL.x + 2.35, z: HILL.z }),
    sample: (_slot, t) => cycle(t, 7.4, { x: HILL.x + 2.35, z: HILL.z }, hillPose, 'נשכב על הר סל', 1.05, 0.8),
    spin: (root) => {
      const pivot = root.getObjectByName('rig-hill');
      if (pivot) pivot.rotation.z = Math.sin(rideNow * 1.15) * 0.42;
    },
  },
  {
    id: 'horse',
    name: 'סוס נדנדה',
    blurb: 'יושבים על סוס הנדנדה ומתנדנדים',
    duration: 6.6,
    slots: 1,
    awards: { flexibility: 1 },
    slotLabel: () => 'לרכוב על סוס הנדנדה',
    approach: () => ({ x: HORSE.x + 1.25, z: HORSE.z }),
    sample: (_slot, t) => cycle(t, 6.6, { x: HORSE.x + 1.25, z: HORSE.z }, horsePose, 'עולה על הסוס'),
    spin: (root) => {
      const pivot = root.getObjectByName('rig-horse');
      if (pivot) pivot.rotation.z = Math.sin(rideNow * 2.35) * 0.36;
    },
  },
  {
    id: 'swing',
    name: 'נדנדה',
    blurb: 'יושבים על הנדנדה ועפים קדימה ואחורה',
    duration: 7.2,
    slots: 2,
    awards: { flexibility: 1 },
    slotLabel: (slot) => (slot === 0 ? 'לשבת על הנדנדה' : 'לשבת על הנדנדה השנייה'),
    approach: (slot) => ({ x: SWING.x + (slot === 0 ? -SWING.gap : SWING.gap), z: SWING.z - 1.7 }),
    sample: (slot, t) =>
      cycle(t, 7.2, { x: SWING.x + (slot === 0 ? -SWING.gap : SWING.gap), z: SWING.z - 1.7 }, () => swingPose(slot), 'עולה על הנדנדה'),
    spin: (root) => {
      for (let slot = 0; slot < 2; slot++) {
        const pivot = root.getObjectByName(`rig-swing-${slot}`);
        if (pivot) pivot.rotation.x = Math.sin(rideNow * 2.15 + slot * 1.25) * 0.62;
      }
    },
  },
  {
    id: 'seesaw',
    name: 'נדנדת איזון',
    blurb: 'יושבים בקצה ועולים ויורדים',
    duration: 7.2,
    slots: 2,
    awards: { friendship: 1 },
    slotLabel: (slot) => (slot === 0 ? 'לשבת על נדנדת האיזון' : 'לשבת בקצה השני'),
    approach: (slot) => ({ x: SEESAW.x + (slot === 0 ? -SEESAW.reach : SEESAW.reach), z: SEESAW.z + 1.35 }),
    sample: (slot, t) =>
      cycle(
        t,
        7.2,
        { x: SEESAW.x + (slot === 0 ? -SEESAW.reach : SEESAW.reach), z: SEESAW.z + 1.35 },
        () => seesawPose(slot),
        'עולה על נדנדת האיזון',
      ),
    spin: (root) => {
      const pivot = root.getObjectByName('rig-seesaw');
      if (pivot) pivot.rotation.z = Math.sin(rideNow * 1.65) * 0.32;
    },
  },
  {
    id: 'carousel',
    name: 'קרוסלה',
    blurb: 'יושבים על הקרוסלה ומסתובבים',
    duration: 8,
    slots: 1,
    awards: { friendship: 1 },
    slotLabel: () => 'לעלות על הקרוסלה',
    approach: () => ({ x: WHEEL.x, z: WHEEL.z - 2.35 }),
    sample: (_slot, t) => cycle(t, 8, { x: WHEEL.x, z: WHEEL.z - 2.35 }, wheelPose, 'עולה על הקרוסלה', 0.8),
    spin: (root) => {
      const pivot = root.getObjectByName('rig-carousel');
      if (pivot) pivot.rotation.y = rideNow * 0.62;
    },
  },
  {
    id: 'climb',
    name: 'מתקן טיפוס',
    blurb: 'מטפסים למעלה, חוצים את המתקן, ויורדים',
    duration: 5.8,
    slots: 1,
    awards: { courage: 1 },
    slotLabel: () => 'לטפס על המתקן',
    approach: () => ({ x: CLIMB.x, z: CLIMB.z - 1.7 }),
    sample: sampleClimb,
  },
  {
    id: 'bars',
    name: 'סולם קופים',
    blurb: 'מטפסים, מתקדמים בידיים, וקופצים למטה',
    duration: 5.6,
    slots: 1,
    awards: { courage: 1 },
    slotLabel: () => 'לטפס על סולם הקופים',
    approach: () => ({ x: BARS.x0 - 0.85, z: BARS.z }),
    sample: sampleBars,
  },
  {
    id: 'sandbox',
    name: 'ארגז חול',
    blurb: 'יושבים ובונים בחול',
    duration: 7,
    slots: 1,
    awards: { creativity: 1 },
    slotLabel: () => 'לשחק בארגז החול',
    approach: () => ({ x: SAND.x, z: SAND.z + 1.35 }),
    sample: sampleSand,
  },
  {
    id: 'tunnel',
    name: 'מנהרה',
    blurb: 'זוחלים דרך המנהרה',
    duration: 4.3,
    slots: 1,
    awards: { courage: 1 },
    slotLabel: () => 'לזחול במנהרה',
    approach: () => ({ x: TUNNEL.x0 - 0.9, z: TUNNEL.z }),
    sample: sampleTunnel,
  },
  {
    id: 'nest',
    name: 'נדנדת קן',
    blurb: 'יושבים בקן ומתנדנדים',
    duration: 7.2,
    slots: 1,
    awards: { flexibility: 1 },
    slotLabel: () => 'לשבת בנדנדת הקן',
    approach: () => ({ x: NEST.x, z: NEST.z - 1.85 }),
    sample: (_slot, t) => cycle(t, 7.2, { x: NEST.x, z: NEST.z - 1.85 }, nestPose, 'עולה לנדנדת הקן'),
    spin: (root) => {
      const pivot = root.getObjectByName('rig-nest');
      if (pivot) pivot.rotation.x = Math.sin(rideNow * 1.25) * 0.48;
    },
  },
  {
    id: 'duck',
    name: 'ברווז קפיץ',
    blurb: 'קופצים על ברווז הקפיץ',
    duration: 5.8,
    slots: 1,
    awards: { flexibility: 1 },
    slotLabel: () => 'לקפוץ על הברווז',
    approach: () => ({ x: DUCK.x + 1.15, z: DUCK.z }),
    sample: (_slot, t) => cycle(t, 5.8, { x: DUCK.x + 1.15, z: DUCK.z }, duckPose, 'עולה על הברווז'),
    spin: (root) => {
      const bounce = Math.abs(Math.sin(rideNow * 3.5));
      const body = root.getObjectByName('duck-body');
      const spring = root.getObjectByName('duck-spring');
      if (body) body.position.y = DUCK.seat + bounce * 0.38;
      if (spring) spring.scale.y = 0.4 + bounce * 0.85;
    },
  },
  {
    id: 'beam',
    name: 'קורת שיווי משקל',
    blurb: 'הולכים לאט על הקורה ושומרים על שיווי משקל',
    duration: 6.5,
    slots: 1,
    awards: { restraint: 1 },
    slotLabel: () => 'ללכת על הקורה',
    approach: () => ({ x: BEAM.x, z: BEAM.z0 - 0.95 }),
    sample: sampleBeam,
  },
  {
    id: 'spinner',
    name: 'סביבון',
    blurb: 'עומדים על הסביבון ומסתובבים',
    duration: 6.4,
    slots: 1,
    awards: { flexibility: 1 },
    slotLabel: () => 'להסתובב על הסביבון',
    approach: () => ({ x: SPIN.x, z: SPIN.z - 1.55 }),
    sample: (_slot, t) => cycle(t, 6.4, { x: SPIN.x, z: SPIN.z - 1.55 }, spinPose, 'עולה על הסביבון'),
    spin: (root) => {
      const pivot = root.getObjectByName('rig-spinner');
      if (pivot) pivot.rotation.y = rideNow * 1.7;
    },
  },
];

export function rideById(id: string): Ride | undefined {
  return rides.find((ride) => ride.id === id);
}

export function allRides(): readonly Ride[] {
  return rides;
}

export function sampleRide(id: string, slot: number, t: number): RidePose {
  const ride = rideById(id);
  if (!ride) return grounded({ x: 0, z: 0 }, 0);
  return ride.sample(Math.max(0, Math.min(slot, ride.slots - 1)), t);
}

export function approachOf(id: string, slot: number): { x: number; z: number } {
  const ride = rideById(id);
  if (!ride) return { x: 0, z: 0 };
  return ride.approach(Math.max(0, Math.min(slot, ride.slots - 1)));
}

export function playgroundSpots(): Array<{ id: string; slot: number; label: string; x: number; z: number }> {
  const spots: Array<{ id: string; slot: number; label: string; x: number; z: number }> = [];
  for (const ride of rides) {
    for (let slot = 0; slot < ride.slots; slot++) {
      const at = ride.approach(slot);
      spots.push({ id: ride.id, slot, label: ride.slotLabel(slot), x: at.x, z: at.z });
    }
  }
  return spots;
}

export function animateRides(root: THREE.Object3D): void {
  for (const ride of rides) ride.spin?.(root);
}

function buildSlide(parent: THREE.Group): void {
  const deck = box(1.55, 0.16, 1.45, paint.yellow, SLIDE.x, SLIDE.topY - 0.08, -5.28);
  parent.add(deck);
  parent.add(box(1.55, 0.42, 0.08, paint.yellow, SLIDE.x, SLIDE.topY + 0.18, -5.95));
  parent.add(box(0.08, 0.5, 1.45, paint.yellow, SLIDE.x - 0.74, SLIDE.topY + 0.16, -5.28));
  parent.add(box(0.08, 0.5, 1.45, paint.yellow, SLIDE.x + 0.74, SLIDE.topY + 0.16, -5.28));
  for (const side of [-0.62, 0.62]) {
    parent.add(box(0.12, SLIDE.topY, 0.12, paint.blue, SLIDE.x + side, SLIDE.topY / 2, SLIDE.ladderZ));
  }
  for (let y = 0.38; y < SLIDE.topY - 0.15; y += 0.34) {
    parent.add(box(1.15, 0.07, 0.1, paint.yellow, SLIDE.x, y, SLIDE.ladderZ));
  }
  parent.add(box(0.14, SLIDE.topY - 0.3, 0.14, paint.blue, SLIDE.x - 0.7, (SLIDE.topY - 0.3) / 2, -4.7));
  parent.add(box(0.14, SLIDE.topY - 0.3, 0.14, paint.blue, SLIDE.x + 0.7, (SLIDE.topY - 0.3) / 2, -4.7));
  parent.add(slope(SLIDE.x, SLIDE.chuteZ0, SLIDE.topY - 0.02, SLIDE.chuteZ1, SLIDE.endY, 0.92, 0.1, paint.red));
  parent.add(slope(SLIDE.x - 0.48, SLIDE.chuteZ0, SLIDE.topY + 0.16, SLIDE.chuteZ1, SLIDE.endY + 0.2, 0.08, 0.28, paint.red));
  parent.add(slope(SLIDE.x + 0.48, SLIDE.chuteZ0, SLIDE.topY + 0.16, SLIDE.chuteZ1, SLIDE.endY + 0.2, 0.08, 0.28, paint.red));
}

function buildHill(parent: THREE.Group): void {
  const pivot = rig('rig-hill', HILL.x, 0, HILL.z);
  const mound = new THREE.Mesh(new THREE.SphereGeometry(1.55, 18, 12), paint.green);
  mound.scale.set(1.15, 0.62, 1.05);
  mound.position.y = 0.48;
  mound.castShadow = true;
  pivot.add(mound);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 10), mats.grass);
  cap.scale.set(1.3, 0.45, 1.1);
  cap.position.y = 1.05;
  pivot.add(cap);
  parent.add(pivot);
}

function buildHorse(parent: THREE.Group): void {
  const pivot = rig('rig-horse', HORSE.x, 0, HORSE.z);
  const front = box(0.72, 0.08, 0.72, paint.brown, 0, 0.24, 0.36);
  front.rotation.x = -0.55;
  const back = box(0.72, 0.08, 0.72, paint.brown, 0, 0.24, -0.36);
  back.rotation.x = 0.55;
  pivot.add(front, back);
  pivot.add(box(0.38, 0.46, 1.05, paint.brown, 0, 0.66, 0));
  const neck = box(0.2, 0.46, 0.22, paint.brown, 0, 1.02, 0.46);
  neck.rotation.x = -0.45;
  pivot.add(neck);
  pivot.add(box(0.24, 0.24, 0.42, paint.brown, 0, 1.28, 0.68));
  pivot.add(box(0.14, 0.1, 0.24, paint.orange, 0, 1.2, 0.9));
  pivot.add(box(0.08, 0.18, 0.08, paint.brown, -0.08, 1.48, 0.62));
  pivot.add(box(0.08, 0.18, 0.08, paint.brown, 0.08, 1.48, 0.62));
  pivot.add(box(0.1, 0.32, 0.4, paint.dark, 0, 1.28, 0.42));
  pivot.add(box(0.34, 0.08, 0.32, paint.red, 0, 0.92, 0));
  pivot.add(box(0.08, 0.32, 0.08, paint.dark, 0, 0.72, -0.58));
  for (const [lx, lz] of [
    [-0.14, 0.32],
    [0.14, 0.32],
    [-0.14, -0.32],
    [0.14, -0.32],
  ] as Array<[number, number]>) {
    pivot.add(box(0.09, 0.34, 0.09, paint.brown, lx, 0.4, lz));
  }
  parent.add(pivot);
}

function buildSwings(parent: THREE.Group): void {
  for (const side of [-1.35, 1.35]) {
    const left = box(0.1, 2.7, 0.1, paint.blue, SWING.x + side, 1.25, SWING.z - 0.7);
    const right = box(0.1, 2.7, 0.1, paint.blue, SWING.x + side, 1.25, SWING.z + 0.7);
    left.rotation.x = 0.18;
    right.rotation.x = -0.18;
    parent.add(left, right);
  }
  parent.add(box(2.9, 0.1, 0.1, paint.blue, SWING.x, SWING.hinge, SWING.z));
  for (let slot = 0; slot < 2; slot++) {
    const x = slot === 0 ? -SWING.gap : SWING.gap;
    const pivot = rig(`rig-swing-${slot}`, SWING.x + x, SWING.hinge, SWING.z);
    pivot.add(box(0.04, SWING.len, 0.04, mats.metal, -0.22, -SWING.len / 2, 0));
    pivot.add(box(0.04, SWING.len, 0.04, mats.metal, 0.22, -SWING.len / 2, 0));
    pivot.add(box(0.62, 0.08, 0.28, paint.red, 0, -SWING.len, 0));
    parent.add(pivot);
  }
}

function buildSeesaw(parent: THREE.Group): void {
  parent.add(cyl(0.22, 0.5, paint.blue, SEESAW.x, 0.25, SEESAW.z));
  const pivot = rig('rig-seesaw', SEESAW.x, SEESAW.y, SEESAW.z);
  pivot.add(box(2.7, 0.1, 0.34, paint.green, 0, 0.05, 0));
  pivot.add(box(0.34, 0.08, 0.36, paint.red, -SEESAW.reach, 0.12, 0));
  pivot.add(box(0.34, 0.08, 0.36, paint.yellow, SEESAW.reach, 0.12, 0));
  pivot.add(cyl(0.04, 0.28, paint.dark, -SEESAW.reach, 0.28, 0));
  pivot.add(cyl(0.04, 0.28, paint.dark, SEESAW.reach, 0.28, 0));
  parent.add(pivot);
}

function buildCarousel(parent: THREE.Group): void {
  const pivot = rig('rig-carousel', WHEEL.x, 0, WHEEL.z);
  const deck = cyl(1.45, 0.16, paint.orange, 0, 0.12, 0);
  pivot.add(deck);
  pivot.add(cyl(0.1, 2.55, paint.yellow, 0, 1.32, 0));
  pivot.add(cyl(1.5, 0.1, paint.red, 0, 2.58, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    pivot.add(cyl(0.05, 2.2, paint.white, Math.sin(a) * 1.15, 1.2, Math.cos(a) * 1.15));
  }
  pivot.add(box(0.42, 0.1, 0.42, paint.purple, 0, WHEEL.seat - 0.02, WHEEL.radius));
  parent.add(pivot);
}

function buildClimb(parent: THREE.Group): void {
  for (const [dx, dz] of [
    [-0.7, -0.7],
    [0.7, -0.7],
    [-0.7, 0.7],
    [0.7, 0.7],
  ] as Array<[number, number]>) {
    parent.add(box(0.1, CLIMB.top + 0.15, 0.1, paint.green, CLIMB.x + dx, (CLIMB.top + 0.15) / 2, CLIMB.z + dz));
  }
  for (const y of [0.45, 0.95, CLIMB.top]) {
    parent.add(box(1.5, 0.08, 0.08, paint.green, CLIMB.x, y, CLIMB.z - 0.7));
    parent.add(box(1.5, 0.08, 0.08, paint.green, CLIMB.x, y, CLIMB.z + 0.7));
    parent.add(box(0.08, 0.08, 1.5, paint.green, CLIMB.x - 0.7, y, CLIMB.z));
    parent.add(box(0.08, 0.08, 1.5, paint.green, CLIMB.x + 0.7, y, CLIMB.z));
  }
}

function buildBars(parent: THREE.Group): void {
  parent.add(box(0.12, 2.5, 0.12, paint.purple, BARS.x0 - 0.15, 1.25, BARS.z));
  parent.add(box(0.12, 2.5, 0.12, paint.purple, BARS.x1 + 0.15, 1.25, BARS.z));
  parent.add(box(0.12, 2.5, 0.12, paint.purple, BARS.x0 - 0.15, 1.25, BARS.z - 0.45));
  parent.add(box(0.12, 2.5, 0.12, paint.purple, BARS.x1 + 0.15, 1.25, BARS.z - 0.45));
  parent.add(box(3.5, 0.08, 0.08, paint.purple, (BARS.x0 + BARS.x1) / 2, 2.45, BARS.z));
  parent.add(box(3.5, 0.08, 0.08, paint.purple, (BARS.x0 + BARS.x1) / 2, 2.45, BARS.z - 0.45));
  for (let x = BARS.x0; x <= BARS.x1; x += 0.55) {
    parent.add(box(0.08, 0.08, 0.55, paint.yellow, x, 2.45, BARS.z - 0.22));
  }
}

function buildSandbox(parent: THREE.Group): void {
  parent.add(box(2.5, 0.28, 1.9, mats.wood, SAND.x, 0.14, SAND.z));
  parent.add(box(2.2, 0.12, 1.6, mats.sand, SAND.x, 0.28, SAND.z));
  parent.add(box(0.16, 0.12, 0.35, paint.red, SAND.x - 0.3, 0.36, SAND.z + 0.2));
  parent.add(cyl(0.12, 0.18, paint.yellow, SAND.x + 0.35, 0.38, SAND.z - 0.15));
}

function buildTunnel(parent: THREE.Group): void {
  for (let i = 0; i < 5; i++) {
    const x = THREE.MathUtils.lerp(TUNNEL.x0, TUNNEL.x1, i / 4);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.07, 8, 14, Math.PI), paint.blue);
    arch.position.set(x, 0.02, TUNNEL.z);
    arch.rotation.y = Math.PI / 2;
    arch.castShadow = true;
    parent.add(arch);
  }
}

function buildNest(parent: THREE.Group): void {
  const left = box(0.1, 2.4, 0.1, paint.brown, NEST.x - 0.7, 1.2, NEST.z);
  const right = box(0.1, 2.4, 0.1, paint.brown, NEST.x + 0.7, 1.2, NEST.z);
  left.rotation.z = 0.16;
  right.rotation.z = -0.16;
  parent.add(left, right);
  parent.add(box(1.9, 0.1, 0.1, paint.brown, NEST.x, NEST.hinge, NEST.z));
  const pivot = rig('rig-nest', NEST.x, NEST.hinge, NEST.z);
  pivot.add(box(0.05, NEST.len, 0.05, mats.metal, -0.34, -NEST.len / 2, 0));
  pivot.add(box(0.05, NEST.len, 0.05, mats.metal, 0.34, -NEST.len / 2, 0));
  pivot.add(box(0.05, NEST.len, 0.05, mats.metal, 0, -NEST.len / 2, -0.34));
  pivot.add(box(0.05, NEST.len, 0.05, mats.metal, 0, -NEST.len / 2, 0.34));
  const tire = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.1, 8, 18), paint.pink);
  tire.rotation.x = Math.PI / 2;
  tire.position.y = -NEST.len;
  tire.castShadow = true;
  pivot.add(tire);
  pivot.add(cyl(0.32, 0.08, paint.red, 0, -NEST.len, 0));
  parent.add(pivot);
}

function buildDuck(parent: THREE.Group): void {
  const spring = cyl(0.08, 0.45, mats.metal, DUCK.x, 0.28, DUCK.z);
  spring.name = 'duck-spring';
  parent.add(spring);
  const body = rig('duck-body', DUCK.x, DUCK.seat, DUCK.z);
  body.add(box(0.78, 0.42, 0.5, paint.yellow, 0, 0, 0));
  body.add(box(0.36, 0.32, 0.34, paint.yellow, 0.78, 0.3, 0));
  body.add(box(0.22, 0.1, 0.18, paint.orange, 1.02, 0.26, 0));
  body.add(box(0.08, 0.08, 0.08, paint.dark, 0.7, 0.4, 0.1));
  body.add(box(0.95, 0.1, 0.55, paint.red, 0, -0.16, 0));
  parent.add(body);
}

function buildBeam(parent: THREE.Group): void {
  parent.add(box(0.16, BEAM.y, 0.16, paint.brown, BEAM.x, BEAM.y / 2, BEAM.z0));
  parent.add(box(0.16, BEAM.y, 0.16, paint.brown, BEAM.x, BEAM.y / 2, BEAM.z1));
  parent.add(box(0.22, 0.08, BEAM.z1 - BEAM.z0 + 0.4, paint.yellow, BEAM.x, BEAM.y, (BEAM.z0 + BEAM.z1) / 2));
}

function buildSpinner(parent: THREE.Group): void {
  parent.add(cyl(0.08, 0.9, paint.dark, SPIN.x, 0.45, SPIN.z));
  const pivot = rig('rig-spinner', SPIN.x, 0, SPIN.z);
  pivot.add(cyl(0.85, 0.1, paint.orange, 0, 0.12, 0));
  pivot.add(cyl(0.06, 0.7, paint.yellow, SPIN.radius, 0.5, 0));
  pivot.add(cyl(0.06, 0.7, paint.yellow, -SPIN.radius, 0.5, 0));
  pivot.add(cyl(0.06, 0.7, paint.yellow, 0, 0.5, SPIN.radius));
  pivot.add(cyl(0.06, 0.7, paint.yellow, 0, 0.5, -SPIN.radius));
  parent.add(pivot);
}

export function buildPlayground(parent: THREE.Group): void {
  const root = new THREE.Group();
  root.name = 'playground';
  root.userData.noCollide = true;
  const east = box(18, 0.05, 20, mats.sand, 15, 0.03, -2);
  const west = box(16, 0.05, 22, mats.sand, -13, 0.03, 1);
  root.add(east, west);
  buildSlide(root);
  buildHill(root);
  buildHorse(root);
  buildSwings(root);
  buildSeesaw(root);
  buildCarousel(root);
  buildClimb(root);
  buildBars(root);
  buildSandbox(root);
  buildTunnel(root);
  buildNest(root);
  buildDuck(root);
  buildBeam(root);
  buildSpinner(root);
  parent.add(root);
}
