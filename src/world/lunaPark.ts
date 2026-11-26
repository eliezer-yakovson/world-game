import * as THREE from 'three';
import type { StrengthMap } from '../core/types';
import type { RidePose } from './playground';
import { box, cyl, mats } from './materials';

/**
 * Luna park. Every ride shares one clock, so the seat mesh and the rider
 * stay on the same angle. Personal time only blends the mount and the dismount.
 */

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
  red: new THREE.MeshStandardMaterial({ color: 0xd64545, roughness: 0.5 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.5 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x3d7ec9, roughness: 0.5 }),
  green: new THREE.MeshStandardMaterial({ color: 0x3c9a5a, roughness: 0.5 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xe07a5f, roughness: 0.5 }),
  purple: new THREE.MeshStandardMaterial({ color: 0x7d5cbf, roughness: 0.5 }),
  pink: new THREE.MeshStandardMaterial({ color: 0xe38bb0, roughness: 0.5 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf7f4ee, roughness: 0.55 }),
  brown: new THREE.MeshStandardMaterial({ color: 0x8a5a32, roughness: 0.7 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.65 }),
  teal: new THREE.MeshStandardMaterial({ color: 0x2a9d8f, roughness: 0.5 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xf0d060, roughness: 0.4, metalness: 0.35, emissive: 0x5a4010, emissiveIntensity: 0.25 }),
};

const WHEEL = { x: -18, y: 5.5, z: 7, radius: 4.05 };
const DROP = { x: 18, z: 7, period: 9, low: 0.72, high: 6.7 };
const SHIP = { x: 0, y: 4.05, z: 0.6, deck: -2.45 };
const CHAIN = { x: -16, z: -11, hub: 4.4, attach: 0.85, length: 2.45 };
const BUMP = [
  { x: 11.2, z: -10, rx: 2.45, rz: 1.7, speed: 1.15, phase: 0.2 },
  { x: 16.4, z: -10, rx: 2.45, rz: 1.7, speed: -1.02, phase: 1.1 },
];

/** Seats share one ride. Approaches are the boarding marks on the path. */
const WHEEL_APPROACH = [-19.05, -18, -16.95, -15.9].map((x) => ({ x, z: WHEEL.z + 4.2 }));
const DROP_APPROACH = [16.75, 17.8, 18.85, 19.9].map((x) => ({ x, z: DROP.z + 3.4 }));
const SHIP_X = [-1.08, -0.36, 0.36, 1.08];
const SHIP_APPROACH = SHIP_X.map((x) => ({ x, z: 5.35 }));
const CHAIN_APPROACH = [-17.55, -16.5, -15.45, -14.4].map((x) => ({ x, z: CHAIN.z + 4.4 }));
const BUMP_APPROACH = [
  { x: 11.15, z: -5.45 },
  { x: 12.35, z: -5.45 },
  { x: 15.15, z: -5.45 },
  { x: 16.35, z: -5.45 },
];
const DROP_SEAT = [
  { x: 0.42, z: 0.62 },
  { x: -0.42, z: 0.62 },
  { x: 0.78, z: -0.28 },
  { x: -0.78, z: -0.28 },
];

/** Queue mark 0 is closest to the ride. The line steps away along the path. */
const LINES: Record<string, { x: number; z: number; yaw: number; dx: number; dz: number; count: number; along: 'x' | 'z' }> = {
  'luna-wheel': { x: -14.35, z: 13.15, yaw: -Math.PI / 2, dx: 0.96, dz: 0, count: 4, along: 'x' },
  'luna-drop': { x: 15.15, z: 13.15, yaw: Math.PI / 2, dx: -0.96, dz: 0, count: 4, along: 'x' },
  'luna-ship': { x: 1.15, z: 8.15, yaw: Math.PI, dx: 0, dz: 0.96, count: 4, along: 'z' },
  'luna-chain': { x: -13.3, z: -5.35, yaw: Math.PI, dx: 0.96, dz: 0, count: 4, along: 'x' },
  'luna-bump': { x: 9.4, z: -5.35, yaw: Math.PI, dx: -0.96, dz: 0, count: 4, along: 'x' },
};

const PATH_NODES: Array<{ id: string; x: number; z: number }> = [
  { id: 'door', x: 0, z: 21.2 },
  { id: 'gate', x: 0, z: 16.5 },
  { id: 'cross', x: 0, z: 12.2 },
  { id: 'wheel', x: -16.5, z: 12.2 },
  { id: 'drop', x: 18.2, z: 12.2 },
  { id: 'west', x: -10.5, z: 12.2 },
  { id: 'east', x: 10.5, z: 12.2 },
  { id: 'ship', x: 0, z: 7.2 },
  { id: 'westMid', x: -10.5, z: 2 },
  { id: 'eastMid', x: 10.5, z: 2 },
  { id: 'westLow', x: -10.5, z: -4.6 },
  { id: 'eastLow', x: 10.5, z: -4.6 },
  { id: 'low', x: 0, z: -4.6 },
  { id: 'chain', x: -16, z: -4.6 },
  { id: 'bump', x: 13.8, z: -4.6 },
  { id: 'south', x: 0, z: -12 },
];

const PATH_LINKS: Array<[string, string]> = [
  ['door', 'gate'],
  ['gate', 'cross'],
  ['cross', 'west'],
  ['west', 'wheel'],
  ['cross', 'east'],
  ['east', 'drop'],
  ['cross', 'ship'],
  ['west', 'westMid'],
  ['westMid', 'westLow'],
  ['east', 'eastMid'],
  ['eastMid', 'eastLow'],
  ['westLow', 'chain'],
  ['westLow', 'low'],
  ['low', 'eastLow'],
  ['eastLow', 'bump'],
  ['low', 'south'],
];

let rideNow = 0;

export function setLunaNow(time: number): void {
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
  const s = THREE.MathUtils.clamp(u, 0, 1);
  const e = s * s * (3 - 2 * s);
  return {
    x: THREE.MathUtils.lerp(from.x, to.x, e),
    y: THREE.MathUtils.lerp(from.y, to.y, e),
    z: THREE.MathUtils.lerp(from.z, to.z, e),
    yaw: lerpAngle(from.yaw, to.yaw, e),
    pitch: THREE.MathUtils.lerp(from.pitch, to.pitch, e),
    roll: THREE.MathUtils.lerp(from.roll, to.roll, e),
    emote: e < 0.4 ? 'walk' : to.emote,
    loop: e < 0.4 ? true : to.loop,
    line,
  };
}

function cycle(
  t: number,
  duration: number,
  approach: { x: number; z: number },
  live: () => RidePose,
  mountLine: string,
  mount = 0.8,
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

/** Local point on a pivot that rolls around Z, so the swing reads from the south. */
function aroundZ(px: number, py: number, pz: number, lx: number, ly: number, lz: number, angle: number): { x: number; y: number; z: number } {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: px + lx * c - ly * s, y: py + lx * s + ly * c, z: pz + lz };
}

function rig(name: string, x: number, y: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(x, y, z);
  return group;
}

function wrap(time: number, period: number): number {
  return ((time % period) + period) % period;
}

function gondola(slot: number): { x: number; y: number; z: number } {
  const angle = rideNow * 0.58 + slot * Math.PI;
  const radius = WHEEL.radius + 0.15;
  return {
    x: WHEEL.x + Math.cos(angle) * radius,
    y: WHEEL.y + Math.sin(angle) * radius,
    z: WHEEL.z,
  };
}

function wheelPose(slot: number): RidePose {
  const car = slot < 2 ? 0 : 1;
  const at = gondola(car);
  const height = Math.sin(rideNow * 0.58 + car * Math.PI);
  return {
    x: at.x + (slot % 2 === 0 ? -0.36 : 0.36),
    y: at.y + 0.08,
    z: at.z,
    yaw: 0,
    pitch: 0,
    roll: 0,
    emote: 'sit',
    loop: false,
    line: height > 0.35 ? 'למעלה בגלגל, יחד' : height < -0.35 ? 'למטה בגלגל, יחד' : 'יושבים יחד והגלגל מסתובב',
  };
}

function dropPhase(): { y: number; line: string; emote: string; pitch: number; loop: boolean } {
  const p = wrap(rideNow, DROP.period);
  const low = DROP.low;
  const high = DROP.high;
  if (p < 3.2) {
    return { y: low + (high - low) * smooth(p, 0.15, 3.05), line: 'הקרון עולה למעלה', emote: 'idle', pitch: -0.32, loop: true };
  }
  if (p < 4.45) return { y: high, line: 'בראש המגדל', emote: 'idle', pitch: -0.12, loop: true };
  if (p < 5.15) {
    return { y: high + (low - high) * smooth(p, 4.45, 5.1), line: 'נופל למטה', emote: 'jump', pitch: 0.48, loop: true };
  }
  if (p < 6.35) {
    const u = (p - 5.15) / 1.2;
    return { y: low + Math.sin(u * Math.PI) * (1 - u) * 1.15, line: 'הקרון קופץ', emote: 'jump', pitch: 0.22, loop: true };
  }
  return { y: low, line: 'על המגדל', emote: 'idle', pitch: 0, loop: true };
}

function dropPose(slot: number): RidePose {
  const phase = dropPhase();
  const seat = DROP_SEAT[slot] ?? DROP_SEAT[0];
  return {
    x: DROP.x + seat.x,
    y: phase.y + 0.08,
    z: DROP.z + seat.z,
    yaw: 0,
    pitch: phase.pitch,
    roll: 0,
    emote: phase.emote,
    loop: phase.loop,
    line: phase.line,
  };
}

function shipAngle(): number {
  return Math.sin(rideNow * 1.2) * 0.95;
}

function shipSeat(slot: number): { x: number; y: number; z: number; roll: number } {
  const angle = shipAngle();
  const localX = SHIP_X[slot] ?? 0;
  const at = aroundZ(SHIP.x, SHIP.y, SHIP.z, localX, SHIP.deck + 0.22, 0, angle);
  return { ...at, roll: angle };
}

function shipPose(slot: number): RidePose {
  const at = shipSeat(slot);
  return {
    x: at.x,
    y: at.y,
    z: at.z,
    yaw: 0,
    pitch: 0,
    roll: at.roll,
    emote: 'sit',
    loop: false,
    line: Math.abs(at.roll) > 0.55 ? 'הספינה למעלה' : 'הספינה למטה',
  };
}

function chainMotion(): { spin: number; out: number } {
  return {
    spin: rideNow * 1.05,
    out: 0.18 + 0.74 * (0.5 - 0.5 * Math.cos(rideNow * 0.4)),
  };
}

function chainSeat(index: number): { x: number; y: number; z: number; yaw: number; pitch: number } {
  const { spin, out } = chainMotion();
  const angle = spin + index * (Math.PI / 2);
  const horizontal = CHAIN.attach + Math.sin(out) * CHAIN.length;
  const drop = Math.cos(out) * CHAIN.length;
  return {
    x: CHAIN.x + Math.cos(angle) * horizontal,
    y: CHAIN.hub - drop,
    z: CHAIN.z + Math.sin(angle) * horizontal,
    yaw: Math.atan2(Math.cos(angle), Math.sin(angle)),
    pitch: -out,
  };
}

function chainPose(slot: number): RidePose {
  const at = chainSeat(slot);
  const opening = Math.sin(rideNow * 0.4) > 0;
  return {
    x: at.x,
    y: at.y + 0.08,
    z: at.z,
    yaw: at.yaw,
    pitch: -0.22 + at.pitch * 0.2,
    roll: 0,
    emote: 'sit',
    loop: false,
    line: opening ? 'השרשרת נפתחת החוצה' : 'השרשרת מתקרבת',
  };
}

function bumperRaw(slot: number): { x: number; z: number; yaw: number } {
  const spec = BUMP[slot];
  const angle = rideNow * spec.speed + spec.phase;
  const x = spec.x + Math.cos(angle) * spec.rx;
  const z = spec.z + Math.sin(angle) * spec.rz;
  const dx = -Math.sin(angle) * spec.rx * spec.speed;
  const dz = Math.cos(angle) * spec.rz * spec.speed;
  return { x, z, yaw: Math.atan2(dx, dz) };
}

function bumperWorld(slot: number): { x: number; z: number; yaw: number; roll: number; bump: number } {
  const a = bumperRaw(0);
  const b = bumperRaw(1);
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dz) || 1;
  const bump = dist < 1.5 ? (1.5 - dist) / 1.5 : 0;
  const nx = dx / dist;
  const nz = dz / dist;
  const me = slot === 0 ? a : b;
  const sign = slot === 0 ? -1 : 1;
  return {
    x: me.x + nx * bump * 0.55 * sign,
    z: me.z + nz * bump * 0.55 * sign,
    yaw: me.yaw,
    roll: bump * 0.35 * sign,
    bump,
  };
}

function bumperPose(slot: number): RidePose {
  const at = bumperWorld(slot < 2 ? 0 : 1);
  const lx = slot % 2 === 0 ? -0.28 : 0.28;
  const lz = 0.02;
  const c = Math.cos(at.yaw);
  const s = Math.sin(at.yaw);
  return {
    x: at.x + lx * c + lz * s,
    y: 0.78,
    z: at.z - lx * s + lz * c,
    yaw: at.yaw,
    pitch: at.bump * 0.2,
    roll: at.roll,
    emote: 'sit',
    loop: false,
    line: at.bump > 0.2 ? 'מתנגשים יחד' : 'נוהגים יחד במעגל',
  };
}

const rides: Ride[] = [
  {
    id: 'luna-wheel',
    name: 'גלגל ענק',
    blurb: 'יושבים בקרון והגלגל מסתובב',
    duration: 11,
    slots: 4,
    awards: { friendship: 1 },
    slotLabel: (slot) => (slot < 2 ? (slot === 0 ? 'לשבת בקרון, משמאל' : 'לשבת בקרון, לידו') : slot === 2 ? 'לשבת בקרון שממול' : 'לשבת לידו בקרון שממול'),
    approach: (slot) => WHEEL_APPROACH[Math.min(slot, WHEEL_APPROACH.length - 1)],
    sample: (slot, t) => cycle(t, 11, WHEEL_APPROACH[Math.min(slot, WHEEL_APPROACH.length - 1)], () => wheelPose(slot), 'עולה לקרון'),
    spin: (root) => {
      const wheel = root.getObjectByName('rig-ferris');
      if (wheel) wheel.rotation.z = rideNow * 0.58;
      for (let slot = 0; slot < 2; slot++) {
        const car = root.getObjectByName(`rig-gondola-${slot}`);
        const at = gondola(slot);
        if (car) car.position.set(at.x, at.y, at.z);
      }
    },
  },
  {
    id: 'luna-drop',
    name: 'מגדל הנפילה',
    blurb: 'עולים למעלה, עוצרים, ונופלים',
    duration: 9,
    slots: 4,
    awards: { courage: 2 },
    slotLabel: (slot) => ['לעמוד במגדל, מימין', 'לעמוד במגדל, משמאל', 'לעמוד במגדל, מאחור מימין', 'לעמוד במגדל, מאחור משמאל'][slot] ?? 'לעמוד במגדל עם כולם',
    approach: (slot) => DROP_APPROACH[Math.min(slot, DROP_APPROACH.length - 1)],
    sample: (slot, t) => cycle(t, 9, DROP_APPROACH[Math.min(slot, DROP_APPROACH.length - 1)], () => dropPose(slot), 'עולה על המגדל'),
    spin: (root) => {
      const car = root.getObjectByName('rig-drop');
      if (car) car.position.y = dropPhase().y;
    },
  },
  {
    id: 'luna-ship',
    name: 'ספינת פיראטים',
    blurb: 'יושבים והספינה מתנדנדת גבוה',
    duration: 9,
    slots: 4,
    awards: { courage: 1, friendship: 1 },
    slotLabel: (slot) => ['לשבת בספינה, בקצה השמאלי', 'לשבת בספינה, משמאל', 'לשבת בספינה, מימין', 'לשבת בספינה, בקצה הימני'][slot] ?? 'לשבת בספינה',
    approach: (slot) => SHIP_APPROACH[Math.min(slot, SHIP_APPROACH.length - 1)],
    sample: (slot, t) => cycle(t, 9, SHIP_APPROACH[Math.min(slot, SHIP_APPROACH.length - 1)], () => shipPose(slot), 'עולה לספינה'),
    spin: (root) => {
      const ship = root.getObjectByName('rig-ship');
      if (ship) ship.rotation.z = shipAngle();
    },
  },
  {
    id: 'luna-chain',
    name: 'שרשראות',
    blurb: 'יושבים, מסתובבים, והכיסא עף החוצה',
    duration: 8,
    slots: 4,
    awards: { courage: 1, flexibility: 1 },
    slotLabel: (slot) => `לשבת על שרשרת ${slot + 1}`,
    approach: (slot) => CHAIN_APPROACH[Math.min(slot, CHAIN_APPROACH.length - 1)],
    sample: (slot, t) => cycle(t, 8, CHAIN_APPROACH[Math.min(slot, CHAIN_APPROACH.length - 1)], () => chainPose(slot), 'עולה על השרשרת'),
    spin: (root) => {
      const hub = root.getObjectByName('rig-chain-hub');
      if (hub) hub.rotation.y = chainMotion().spin;
      for (let index = 0; index < 4; index++) {
        const seat = chainSeat(index);
        const chair = root.getObjectByName(`rig-chain-seat-${index}`);
        if (chair) {
          chair.position.set(seat.x, seat.y, seat.z);
          chair.rotation.order = 'YXZ';
          chair.rotation.set(seat.pitch * 0.35, seat.yaw, 0);
        }
        const link = root.getObjectByName(`chain-link-${index}`);
        if (link) {
          const { spin } = chainMotion();
          const angle = spin + index * (Math.PI / 2);
          hang(
            link,
            CHAIN.x + Math.cos(angle) * CHAIN.attach,
            CHAIN.hub,
            CHAIN.z + Math.sin(angle) * CHAIN.attach,
            seat.x,
            seat.y + 0.2,
            seat.z,
          );
        }
      }
    },
  },
  {
    id: 'luna-bump',
    name: 'מכוניות מתנגשות',
    blurb: 'נוהגים במעגל ומתנגשים',
    duration: 8,
    slots: 4,
    awards: { flexibility: 1 },
    slotLabel: (slot) => ['לנהוג באדומה', 'לשבת ליד הנהג באדומה', 'לנהוג בכחולה', 'לשבת ליד הנהג בכחולה'][slot] ?? 'לעלות למכונית',
    approach: (slot) => BUMP_APPROACH[Math.min(slot, BUMP_APPROACH.length - 1)],
    sample: (slot, t) => cycle(t, 8, BUMP_APPROACH[Math.min(slot, BUMP_APPROACH.length - 1)], () => bumperPose(slot), 'נכנס למכונית'),
    spin: (root) => {
      for (let slot = 0; slot < 2; slot++) {
        const car = root.getObjectByName(`rig-bump-${slot}`);
        const at = bumperWorld(slot);
        if (!car) continue;
        car.position.set(at.x, 0.42 + at.bump * 0.08, at.z);
        car.rotation.order = 'YXZ';
        car.rotation.set(at.bump * 0.12, at.yaw, at.roll);
      }
    },
  },
];

const chainAxis = new THREE.Vector3(0, 1, 0);
const chainDir = new THREE.Vector3();
const chainQuat = new THREE.Quaternion();

function hang(mesh: THREE.Object3D, ax: number, ay: number, az: number, bx: number, by: number, bz: number): void {
  chainDir.set(bx - ax, by - ay, bz - az);
  const len = chainDir.length() || 0.001;
  chainDir.multiplyScalar(1 / len);
  mesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  chainQuat.setFromUnitVectors(chainAxis, chainDir);
  mesh.quaternion.copy(chainQuat);
  mesh.scale.set(1, len, 1);
}

export function lunaRideById(id: string): Ride | undefined {
  return rides.find((ride) => ride.id === id);
}

export function allLunaRides(): readonly Ride[] {
  return rides;
}

export function sampleLuna(id: string, slot: number, t: number): RidePose {
  const ride = lunaRideById(id);
  if (!ride) return grounded({ x: 0, z: 0 }, 0);
  return ride.sample(Math.max(0, Math.min(slot, ride.slots - 1)), t);
}

export function approachLuna(id: string, slot: number): { x: number; z: number } {
  const ride = lunaRideById(id);
  if (!ride) return { x: 0, z: 0 };
  return ride.approach(Math.max(0, Math.min(slot, ride.slots - 1)));
}

export function lunaSpots(): Array<{ id: string; slot: number; label: string; x: number; z: number }> {
  const spots: Array<{ id: string; slot: number; label: string; x: number; z: number }> = [];
  for (const ride of rides) {
    for (let slot = 0; slot < ride.slots; slot++) {
      const at = ride.approach(slot);
      spots.push({ id: ride.id, slot, label: ride.slotLabel(slot), x: at.x, z: at.z });
    }
  }
  return spots;
}

export function lunaLine(id: string): Array<{ x: number; z: number; yaw: number }> {
  const spec = LINES[id];
  if (!spec) return [];
  const spots: Array<{ x: number; z: number; yaw: number }> = [];
  for (let i = 0; i < spec.count; i++) spots.push({ x: spec.x + spec.dx * i, z: spec.z + spec.dz * i, yaw: spec.yaw });
  return spots;
}

export function lunaQueues(): Array<{ id: string; label: string; x: number; z: number }> {
  return rides
    .filter((ride) => LINES[ride.id])
    .map((ride) => {
      const spots = lunaLine(ride.id);
      const tail = spots[spots.length - 1];
      return { id: ride.id, label: `לעמוד בתור ל${ride.name}`, x: tail.x, z: tail.z };
    });
}

/** Waypoints along the paved paths, from a person to a goal. The goal itself is not included. */
export function lunaRoute(x: number, z: number, gx: number, gz: number): Array<{ x: number; z: number }> {
  const nearest = (px: number, pz: number) => {
    let best = PATH_NODES[0];
    let bestD = Infinity;
    for (const node of PATH_NODES) {
      const d = Math.hypot(node.x - px, node.z - pz);
      if (d < bestD) {
        best = node;
        bestD = d;
      }
    }
    return best;
  };
  const start = nearest(x, z);
  const end = nearest(gx, gz);
  const adj = new Map<string, string[]>();
  for (const node of PATH_NODES) adj.set(node.id, []);
  for (const [a, b] of PATH_LINKS) {
    adj.get(a)?.push(b);
    adj.get(b)?.push(a);
  }
  const prev = new Map<string, string | null>();
  const pending = [start.id];
  prev.set(start.id, null);
  while (pending.length) {
    const id = pending.shift();
    if (!id || id === end.id) break;
    for (const next of adj.get(id) ?? []) {
      if (prev.has(next)) continue;
      prev.set(next, id);
      pending.push(next);
    }
  }
  if (!prev.has(end.id)) return [];
  const chain: string[] = [];
  let cursor: string | null = end.id;
  while (cursor) {
    chain.push(cursor);
    cursor = prev.get(cursor) ?? null;
  }
  chain.reverse();
  const byId = new Map(PATH_NODES.map((node) => [node.id, node]));
  const points: Array<{ x: number; z: number }> = [];
  for (const id of chain) {
    const node = byId.get(id);
    if (!node || Math.hypot(node.x - x, node.z - z) < 1.15) continue;
    points.push({ x: node.x, z: node.z });
  }
  const last = points[points.length - 1];
  if (last && Math.hypot(last.x - gx, last.z - gz) < 1.25) points.pop();
  return points;
}

export function animateLuna(root: THREE.Object3D): void {
  for (const ride of rides) ride.spin?.(root);
}

function fairLabel(text: string, x: number, y: number, z: number, w = 2.6): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#7a1f4a';
    ctx.fillRect(20, 28, 472, 104);
    ctx.strokeStyle = '#f0d060';
    ctx.lineWidth = 10;
    ctx.strokeRect(26, 34, 460, 92);
    ctx.fillStyle = '#fff4c8';
    ctx.font = '700 62px Arial, Rubik, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 82);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.position.set(x, y, z);
  sprite.scale.set(w, w * 0.31, 1);
  return sprite;
}

function bulb(parent: THREE.Object3D, x: number, y: number, z: number, color: number): void {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 8, 8),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.4 }),
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);
}

function buildWheel(parent: THREE.Group): void {
  parent.add(box(7.2, 0.06, 7.2, paint.purple, WHEEL.x, 0.04, WHEEL.z));
  for (const side of [-1, 1]) {
    parent.add(box(0.22, WHEEL.y, 0.22, paint.red, WHEEL.x, WHEEL.y / 2, WHEEL.z + side * 0.95));
  }
  parent.add(cyl(0.12, 2.1, paint.dark, WHEEL.x, WHEEL.y, WHEEL.z).rotateX(Math.PI / 2));
  const wheel = rig('rig-ferris', WHEEL.x, WHEEL.y, WHEEL.z);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(WHEEL.radius, 0.08, 8, 48), paint.yellow);
  rim.castShadow = true;
  wheel.add(rim);
  for (let i = 0; i < 6; i++) {
    const spoke = box(0.07, WHEEL.radius * 2 - 0.2, 0.07, paint.red, 0, 0, 0);
    spoke.rotation.z = (i * Math.PI) / 6;
    wheel.add(spoke);
  }
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    bulb(wheel, Math.cos(angle) * WHEEL.radius, Math.sin(angle) * WHEEL.radius, 0, i % 2 ? 0xf2c14e : 0xe38bb0);
  }
  parent.add(wheel);
  for (let slot = 0; slot < 2; slot++) {
    const car = rig(`rig-gondola-${slot}`, WHEEL.x, WHEEL.y - WHEEL.radius, WHEEL.z);
    const color = slot === 0 ? paint.blue : paint.orange;
    car.add(box(1.8, 0.08, 0.95, color, 0, 0, 0));
    car.add(box(1.8, 1.25, 0.06, color, 0, 0.66, -0.44));
    car.add(box(0.06, 1.25, 0.95, color, -0.87, 0.66, 0));
    car.add(box(0.06, 1.25, 0.95, color, 0.87, 0.66, 0));
    car.add(box(1.85, 0.08, 1.02, paint.white, 0, 1.32, 0));
    parent.add(car);
  }
  parent.add(fairLabel('גלגל ענק', WHEEL.x, WHEEL.y + WHEEL.radius + 0.85, WHEEL.z, 2.8));
}

function buildDrop(parent: THREE.Group): void {
  parent.add(box(5.6, 0.06, 5, paint.teal, DROP.x, 0.04, DROP.z));
  parent.add(cyl(0.16, 7.6, paint.dark, DROP.x, 3.8, DROP.z));
  for (let y = 1.4; y <= 7.2; y += 1.15) bulb(parent, DROP.x + 0.28, y, DROP.z, 0xf2c14e);
  const car = rig('rig-drop', DROP.x, DROP.low, DROP.z);
  car.add(box(2.7, 0.14, 2.35, paint.yellow, 0, 0, 0));
  car.add(box(2.7, 0.5, 0.08, paint.red, 0, 0.3, -1.12));
  car.add(box(2.7, 0.5, 0.08, paint.red, 0, 0.3, 1.12));
  car.add(box(0.08, 0.5, 2.2, paint.red, -1.3, 0.3, 0));
  car.add(box(0.08, 0.5, 2.2, paint.red, 1.3, 0.3, 0));
  parent.add(car);
  parent.add(fairLabel('מגדל הנפילה', DROP.x, 8.15, DROP.z, 2.8));
}

function buildShip(parent: THREE.Group): void {
  parent.add(box(8.4, 0.06, 6.2, paint.teal, SHIP.x, 0.04, SHIP.z));
  for (const side of [-1, 1]) {
    parent.add(box(0.18, SHIP.y, 0.18, paint.red, side * 3.15, SHIP.y / 2, SHIP.z));
  }
  parent.add(box(6.5, 0.16, 0.18, paint.yellow, 0, SHIP.y, SHIP.z));
  const ship = rig('rig-ship', SHIP.x, SHIP.y, SHIP.z);
  const hang = Math.abs(SHIP.deck);
  ship.add(box(0.08, hang, 0.08, paint.dark, -0.85, SHIP.deck / 2, 0));
  ship.add(box(0.08, hang, 0.08, paint.dark, 0.85, SHIP.deck / 2, 0));
  ship.add(box(3.05, 0.46, 1.2, paint.brown, 0, SHIP.deck - 0.2, 0));
  ship.add(box(3.2, 0.1, 1.35, paint.red, 0, SHIP.deck + 0.04, 0));
  ship.add(box(0.5, 0.26, 0.62, paint.yellow, 1.65, SHIP.deck - 0.02, 0));
  ship.add(box(0.08, 1.5, 0.08, paint.dark, 0.1, SHIP.deck + 0.95, 0));
  ship.add(box(1.2, 1.15, 0.05, paint.white, 0.1, SHIP.deck + 1.0, 0.03));
  ship.add(box(1.2, 0.16, 0.06, paint.red, 0.1, SHIP.deck + 1.0, 0.06));
  for (const x of SHIP_X) {
    ship.add(box(0.55, 0.08, 0.48, x < 0 ? paint.blue : paint.orange, x, SHIP.deck + 0.12, 0));
  }
  parent.add(ship);
  parent.add(fairLabel('ספינת פיראטים', 0, 5.35, 2.2, 3));
}

function buildChains(parent: THREE.Group): void {
  parent.add(box(7.4, 0.06, 7.4, paint.pink, CHAIN.x, 0.04, CHAIN.z));
  parent.add(cyl(0.18, CHAIN.hub, paint.purple, CHAIN.x, CHAIN.hub / 2, CHAIN.z));
  const hub = rig('rig-chain-hub', CHAIN.x, CHAIN.hub, CHAIN.z);
  hub.add(cyl(0.55, 0.18, paint.yellow, 0, 0, 0));
  parent.add(hub);
  for (let index = 0; index < 4; index++) {
    const link = cyl(0.035, 1, paint.dark, 0, 0, 0);
    link.name = `chain-link-${index}`;
    link.userData.noCollide = true;
    parent.add(link);
    const chair = rig(`rig-chain-seat-${index}`, CHAIN.x, 1.4, CHAIN.z);
    const color = index % 2 ? paint.orange : paint.blue;
    chair.add(box(0.55, 0.08, 0.5, color, 0, 0, 0));
    chair.add(box(0.5, 0.28, 0.06, color, 0, 0.18, -0.22));
    parent.add(chair);
  }
  parent.add(fairLabel('שרשראות', CHAIN.x, CHAIN.hub + 0.7, CHAIN.z, 2.4));
}

function buildBumpers(parent: THREE.Group): void {
  parent.add(box(12.4, 0.06, 7.4, paint.dark, 13.8, 0.04, -10));
  parent.add(box(12.2, 0.18, 0.12, paint.yellow, 13.8, 0.16, -6.45));
  parent.add(box(12.2, 0.18, 0.12, paint.yellow, 13.8, 0.16, -13.55));
  parent.add(box(0.12, 0.18, 7.1, paint.yellow, 7.7, 0.16, -10));
  parent.add(box(0.12, 0.18, 7.1, paint.yellow, 19.9, 0.16, -10));
  for (let slot = 0; slot < 2; slot++) {
    const car = rig(`rig-bump-${slot}`, BUMP[slot].x, 0.42, BUMP[slot].z);
    const color = slot === 0 ? paint.red : paint.blue;
    car.add(box(1.05, 0.28, 1.65, color, 0, 0.16, 0));
    car.add(box(0.72, 0.22, 0.62, paint.white, 0, 0.32, -0.12));
    car.add(box(0.16, 0.1, 0.16, paint.dark, -0.38, 0.08, 0.5));
    car.add(box(0.16, 0.1, 0.16, paint.dark, 0.38, 0.08, 0.5));
    car.add(box(0.16, 0.1, 0.16, paint.dark, -0.38, 0.08, -0.5));
    car.add(box(0.16, 0.1, 0.16, paint.dark, 0.38, 0.08, -0.5));
    parent.add(car);
  }
  parent.add(fairLabel('מכוניות מתנגשות', 13.8, 1.7, -5.2, 3.2));
}

const curbMat = new THREE.MeshStandardMaterial({ color: 0x6d7580, roughness: 0.92 });

function layPath(parent: THREE.Object3D, x: number, z: number, w: number, d: number): void {
  parent.add(box(w, 0.07, d, mats.sidewalk, x, 0.045, z));
  if (d >= w) {
    parent.add(box(0.14, 0.09, d, curbMat, x - w / 2, 0.05, z));
    parent.add(box(0.14, 0.09, d, curbMat, x + w / 2, 0.05, z));
  } else {
    parent.add(box(w, 0.09, 0.14, curbMat, x, 0.05, z - d / 2));
    parent.add(box(w, 0.09, 0.14, curbMat, x, 0.05, z + d / 2));
  }
}

function buildPaths(parent: THREE.Group): void {
  layPath(parent, 0, 18, 2.6, 9.2);
  layPath(parent, 0, 12.2, 44, 2.5);
  layPath(parent, 0, 8.3, 2.4, 7.6);
  layPath(parent, -10.5, 3.8, 2.1, 16.8);
  layPath(parent, 10.5, 3.8, 2.1, 16.8);
  layPath(parent, -1, -4.6, 36, 2.2);
  layPath(parent, 0, -10.2, 2.4, 11.2);
  layPath(parent, 18.2, 10.55, 4.8, 2.2);
  layPath(parent, -16, -6.15, 4.8, 2.2);
  layPath(parent, 13.8, -5.5, 6.6, 1.7);
  for (const rideId of Object.keys(LINES)) {
    const spec = LINES[rideId];
    const spots = lunaLine(rideId);
    for (const spot of spots) {
      const mark = box(spec.along === 'x' ? 0.7 : 0.46, 0.035, spec.along === 'x' ? 0.46 : 0.7, paint.yellow, spot.x, 0.1, spot.z);
      parent.add(mark);
      const px = spot.x + (spec.along === 'z' ? -0.42 : 0);
      const pz = spot.z + (spec.along === 'x' ? 0.42 : 0);
      parent.add(cyl(0.055, 0.48, paint.gold, px, 0.28, pz));
    }
    const tail = spots[spots.length - 1];
    if (tail) parent.add(fairLabel('תור', tail.x, 1.45, tail.z, 1.2));
  }
}

function buildFair(parent: THREE.Group): void {
  buildPaths(parent);
  for (const side of [-1, 1]) {
    const post = box(0.22, 3.5, 0.22, paint.red, side * 2.3, 1.75, 18.4);
    parent.add(post);
    for (let y = 0.6; y <= 3.2; y += 0.45) bulb(parent, side * 2.3, y, 18.55, y % 0.9 < 0.5 ? 0xf2c14e : 0x3d7ec9);
  }
  parent.add(box(5, 0.22, 0.22, paint.yellow, 0, 3.45, 18.4));
  parent.add(fairLabel('לונה פארק', 0, 4.15, 18.4, 3.4));
  const booth = new THREE.Group();
  booth.add(box(2.2, 1.5, 1.4, paint.white, -4.4, 0.75, 16.2));
  booth.add(box(2.5, 0.16, 1.7, paint.red, -4.4, 1.55, 16.2));
  booth.add(box(1.3, 0.7, 0.06, paint.gold, -4.4, 1.05, 16.92));
  parent.add(booth);
  parent.add(fairLabel('קופה', -4.4, 2.15, 16.2, 1.6));
  for (const [x, z, color] of [
    [-8, 18, 0xd64545],
    [-8.4, 18.35, 0xf2c14e],
    [-7.6, 18.4, 0x3d7ec9],
    [22, 16, 0xe38bb0],
    [22.4, 16.4, 0x7d5cbf],
    [-24, -4, 0x2a9d8f],
  ] as Array<[number, number, number]>) {
    parent.add(cyl(0.03, 2.2, paint.dark, x, 1.1, z));
    const balloon = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshStandardMaterial({ color, roughness: 0.4 }),
    );
    balloon.position.set(x, 2.35, z);
    parent.add(balloon);
  }
}

export function buildLunaPark(parent: THREE.Group): void {
  const root = new THREE.Group();
  root.name = 'luna-rides';
  root.userData.noCollide = true;
  buildFair(root);
  buildWheel(root);
  buildDrop(root);
  buildShip(root);
  buildChains(root);
  buildBumpers(root);
  parent.add(root);
}
