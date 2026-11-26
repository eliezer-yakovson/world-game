import * as THREE from 'three';

interface Pose {
  x: number;
  z: number;
  y: number;
  yaw: number;
  pitch: number;
}

interface ZooPetSpec {
  kind: string;
  phase: number;
}

interface Pet {
  anchor: THREE.Object3D;
  kind: string;
  phase: number;
  homeX: number;
  homeZ: number;
  time: number;
  /** Feet correction while the body stays upright. Recomputed when it pitches. */
  flatLift?: number;
}

const KINDS = ['wolf', 'horse', 'fox', 'deer', 'cow', 'husky', 'cat', 'bunny', 'chick', 'dog'] as const;

/**
 * Each zoo animal stays inside its own pen and loops a behavior of its own:
 * patrol, trot, sneak, graze, chew, run, groom, hop, peck, or fetch.
 * Pens do not overlap, and a second pass pulls any pair that gets too close
 * back toward the middle of its pen.
 */
export class ZooLifeSystem {
  private pets: Pet[] = [];

  clear(): void {
    this.pets = [];
  }

  bind(root: THREE.Object3D): void {
    this.pets = [];
    root.updateWorldMatrix(true, true);
    root.traverse((obj) => {
      const spec = obj.userData.zooPet as ZooPetSpec | undefined;
      if (!spec || !KINDS.includes(spec.kind as (typeof KINDS)[number])) return;
      this.pets.push({
        anchor: obj,
        kind: spec.kind,
        phase: spec.phase,
        homeX: obj.position.x,
        homeZ: obj.position.z,
        time: spec.phase,
      });
    });
  }

  update(dt: number): void {
    for (const pet of this.pets) {
      pet.time += dt;
      const pose = behave(pet.kind, pet.time);
      const x = THREE.MathUtils.clamp(pose.x, -1.55, 1.55);
      const z = THREE.MathUtils.clamp(pose.z, -1.25, 1.25);
      pet.anchor.rotation.order = 'YXZ';
      pet.anchor.rotation.y = pose.yaw;
      pet.anchor.rotation.x = pose.pitch;
      if (Math.abs(pose.pitch) < 0.02) {
        if (pet.flatLift === undefined) {
          pet.anchor.position.set(pet.homeX + x, pose.y, pet.homeZ + z);
          this.plantFeet(pet.anchor);
          pet.flatLift = pet.anchor.position.y - pose.y;
        }
        pet.anchor.position.set(pet.homeX + x, pose.y + pet.flatLift, pet.homeZ + z);
      } else {
        pet.flatLift = undefined;
        pet.anchor.position.set(pet.homeX + x, pose.y, pet.homeZ + z);
        this.plantFeet(pet.anchor);
      }
    }
    this.keepApart();
  }

  /** A nod pitches the whole body, so lift it until the lowest point is back on the ground. */
  private plantFeet(anchor: THREE.Object3D): void {
    anchor.updateWorldMatrix(true, true);
    let minY = Infinity;
    anchor.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible || !mesh.geometry) return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox;
      if (!box) return;
      const e = mesh.matrixWorld.elements;
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
            if (wy < minY) minY = wy;
          }
        }
      }
    });
    if (minY < -0.02) anchor.position.y -= minY;
  }

  private keepApart(): void {
    for (let i = 0; i < this.pets.length; i++) {
      for (let j = i + 1; j < this.pets.length; j++) {
        const a = this.pets[i];
        const b = this.pets[j];
        const dx = b.anchor.position.x - a.anchor.position.x;
        const dz = b.anchor.position.z - a.anchor.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist >= 1.8) continue;
        a.anchor.position.x += (a.homeX - a.anchor.position.x) * 0.65;
        a.anchor.position.z += (a.homeZ - a.anchor.position.z) * 0.65;
        b.anchor.position.x += (b.homeX - b.anchor.position.x) * 0.65;
        b.anchor.position.z += (b.homeZ - b.anchor.position.z) * 0.65;
      }
    }
  }
}

function behave(kind: string, t: number): Pose {
  switch (kind) {
    case 'wolf':
      return wolf(t);
    case 'horse':
      return horse(t);
    case 'fox':
      return fox(t);
    case 'deer':
      return deer(t);
    case 'cow':
      return cow(t);
    case 'husky':
      return husky(t);
    case 'cat':
      return cat(t);
    case 'bunny':
      return bunny(t);
    case 'chick':
      return chick(t);
    default:
      return dog(t);
  }
}

function wolf(t: number): Pose {
  const lap = 12;
  const u = (t % lap) / lap;
  const rect: Array<[number, number]> = [
    [-1.45, -1.1],
    [1.45, -1.1],
    [1.45, 1.1],
    [-1.45, 1.1],
  ];
  const side = Math.min(3, Math.floor(u * 4));
  const f = u * 4 - side;
  const a = rect[side];
  const b = rect[(side + 1) % 4];
  const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]);
  if (f < 0.7) {
    const k = f / 0.7;
    return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, y: 0, yaw, pitch: 0 };
  }
  return { x: b[0], z: b[1], y: 0, yaw, pitch: -0.5 };
}

function horse(t: number): Pose {
  const a = t * 0.9;
  const x = Math.cos(a) * 1.5;
  const z = Math.sin(a) * 1.05;
  return {
    x,
    z,
    y: Math.abs(Math.sin(t * 8)) * 0.06,
    yaw: Math.atan2(-Math.sin(a) * 1.5, Math.cos(a) * 1.05),
    pitch: 0,
  };
}

function fox(t: number): Pose {
  const cycle = 9;
  const u = t % cycle;
  const leg = (k: number, from: [number, number], to: [number, number], pitch: number): Pose => ({
    x: from[0] + (to[0] - from[0]) * k,
    z: from[1] + (to[1] - from[1]) * k,
    y: 0,
    yaw: Math.atan2(to[0] - from[0], to[1] - from[1]),
    pitch,
  });
  if (u < 3.4) return leg(u / 3.4, [-1.4, -0.85], [1.4, -0.85], 0.28);
  if (u < 4.3) return leg((u - 3.4) / 0.9, [1.4, -0.85], [1.4, 1.1], 0);
  if (u < 7.7) return leg((u - 4.3) / 3.4, [1.4, 1.1], [-1.4, 1.1], 0.28);
  return leg((u - 7.7) / 1.3, [-1.4, 1.1], [-1.4, -0.85], 0);
}

function deer(t: number): Pose {
  const u = t % 9;
  if (u < 2.4) {
    const k = u / 2.4;
    return { x: -1.25 + 2.5 * k, z: -0.15, y: 0, yaw: Math.PI / 2, pitch: 0 };
  }
  if (u < 5.2) return { x: 1.25, z: -0.15, y: 0, yaw: Math.PI / 2, pitch: 0.55 + Math.sin(u * 5) * 0.07 };
  if (u < 7.2) {
    const k = (u - 5.2) / 2;
    return { x: 1.25 - 2.3 * k, z: -0.15 + 0.85 * k, y: 0, yaw: Math.atan2(-2.3, 0.85), pitch: 0 };
  }
  return { x: -1.05, z: 0.7, y: 0, yaw: -Math.PI / 2, pitch: 0.5 + Math.sin(u * 5) * 0.06 };
}

function cow(t: number): Pose {
  const u = t % 12;
  if (u < 4) {
    const k = u / 4;
    return { x: -1.35 + 2.7 * k, z: 0.25, y: 0, yaw: Math.PI / 2, pitch: 0 };
  }
  if (u < 7.2) return { x: 1.35, z: 0.25, y: 0, yaw: Math.PI / 2, pitch: 0.4 + Math.sin(u * 3.5) * 0.1 };
  if (u < 11) {
    const k = (u - 7.2) / 3.8;
    return { x: 1.35 - 2.7 * k, z: 0.25 - 0.45 * k, y: 0, yaw: -Math.PI / 2, pitch: 0 };
  }
  return { x: -1.35, z: -0.2, y: 0, yaw: -Math.PI / 2, pitch: 0.35 + Math.sin(u * 3.5) * 0.1 };
}

function husky(t: number): Pose {
  const u = t % 7.5;
  if (u < 5.2) {
    const a = (u / 5.2) * Math.PI * 2;
    return {
      x: Math.cos(a) * 1.4,
      z: Math.sin(a) * 1,
      y: Math.abs(Math.sin(u * 12)) * 0.07,
      yaw: Math.atan2(-Math.sin(a), Math.cos(a)),
      pitch: 0,
    };
  }
  return { x: 1.4, z: 0, y: 0, yaw: Math.sin(u * 14) * 0.35, pitch: 0.04 };
}

function cat(t: number): Pose {
  const u = t % 10;
  const pts: Array<[number, number]> = [
    [-1.15, -0.75],
    [1.05, -0.45],
    [0.15, 1.05],
    [-1.15, -0.75],
  ];
  if (u < 6) {
    const f = (u / 6) * 3;
    const i = Math.min(2, Math.floor(f));
    const k = f - i;
    const a = pts[i];
    const b = pts[i + 1];
    return {
      x: a[0] + (b[0] - a[0]) * k,
      z: a[1] + (b[1] - a[1]) * k,
      y: 0,
      yaw: Math.atan2(b[0] - a[0], b[1] - a[1]),
      pitch: 0.06,
    };
  }
  return { x: -1.15, z: -0.75, y: 0, yaw: Math.sin(u * 2.4) * 0.45, pitch: 0.22 };
}

function bunny(t: number): Pose {
  const spots: Array<[number, number]> = [
    [-1.15, -0.7],
    [1.05, -0.55],
    [0.35, 1.05],
    [-0.85, 0.85],
  ];
  const hop = 0.9;
  const n = Math.floor(t / hop);
  const f = (t % hop) / hop;
  const a = spots[n % spots.length];
  const b = spots[(n + 1) % spots.length];
  const moving = f < 0.62;
  const k = moving ? f / 0.62 : 1;
  return {
    x: a[0] + (b[0] - a[0]) * k,
    z: a[1] + (b[1] - a[1]) * k,
    y: moving ? Math.sin(Math.PI * k) * 0.4 : 0,
    yaw: Math.atan2(b[0] - a[0], b[1] - a[1]),
    pitch: 0,
  };
}

function chick(t: number): Pose {
  const a = t * 0.65;
  const peck = t % 1.15 > 0.86;
  return {
    x: Math.cos(a) * 0.72,
    z: Math.sin(a) * 0.5,
    y: 0,
    yaw: Math.atan2(-Math.sin(a), Math.cos(a)),
    pitch: peck ? 0.75 : 0.04,
  };
}

function dog(t: number): Pose {
  const u = t % 6.2;
  const run = (k: number, from: [number, number], to: [number, number]): Pose => ({
    x: from[0] + (to[0] - from[0]) * k,
    z: from[1] + (to[1] - from[1]) * k,
    y: Math.abs(Math.sin(k * Math.PI * 4)) * 0.05,
    yaw: Math.atan2(to[0] - from[0], to[1] - from[1]),
    pitch: 0,
  });
  if (u < 1.5) return run(u / 1.5, [-1.25, -0.65], [1.25, 0.85]);
  if (u < 2.7) return { x: 1.25, z: 0.85, y: 0, yaw: Math.atan2(1, 1), pitch: 0.48 };
  if (u < 4.2) return run((u - 2.7) / 1.5, [1.25, 0.85], [-1.25, -0.65]);
  return { x: -1.25, z: -0.65, y: 0, yaw: Math.PI, pitch: 0.12 + Math.sin(u * 9) * 0.08 };
}
