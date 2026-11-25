import * as THREE from 'three';
import type { NpcManager } from './NpcManager';

/**
 * How a household task is allowed to look. The pose stays on the spot;
 * the prop carries the meaning.
 *
 * sweep: a broom in the right hand, bristles on the floor, swinging side
 *   to side, with dust puffing off the bristles.
 * wipe: a cloth scrubbing a small board in front of the body.
 * eat: a plate at chest height and a bite that rises to the mouth.
 * cook: a pot, a spoon circling inside it, and steam rising.
 * draw: a white sheet. Strokes accumulate and stay. A house, a sun and a
 *   tree get drawn in, and stars gather around the page the longer it goes.
 * playBlocks: a tower of blocks. A new block is added the longer they play,
 *   and it stays stacked.
 * playBall: balls bounce in front of a jumping body. Another ball joins
 *   the longer they play.
 * playCastle: a fort in front of the body. Floor, walls, towers, a roof
 *   and a flag appear one after another and stay.
 * playRoad: a toy road that gains another tile and another car the longer
 *   they play.
 * read: an open book held up, body sitting.
 * water: a can tipped forward, blue drops falling in front.
 * laundry: a basket and a shirt that folds flatter, then opens again.
 * music: the body sways and notes float up.
 * phone: a handset held to the ear.
 * rest: sitting, with a pillow in the lap.
 */

export type TaskKind =
  | 'sweep'
  | 'wipe'
  | 'eat'
  | 'cook'
  | 'draw'
  | 'playBlocks'
  | 'playBall'
  | 'playCastle'
  | 'playRoad'
  | 'read'
  | 'water'
  | 'laundry'
  | 'music'
  | 'phone'
  | 'rest';

interface Chore {
  kind: TaskKind;
  station: string;
  label: string;
  line: string;
}

interface Station {
  x: number;
  z: number;
  yaw: number;
}

interface ChoreProp {
  object: THREE.Group;
  tick(elapsed: number): void;
  dispose(): void;
}

interface Job {
  chore: Chore;
  phase: 'walk' | 'act' | 'gap';
  time: number;
  duration: number;
  x: number;
  z: number;
  prop?: ChoreProp;
}

const STATIONS: Record<string, Station> = {
  rug: { x: -1.5, z: 1.65, yaw: 0.3 },
  hall: { x: 0.35, z: 5.05, yaw: 0 },
  table: { x: 2.05, z: -3.45, yaw: 0.4 },
  kitchen: { x: 6.15, z: -5.05, yaw: Math.PI },
  draw: { x: -6.35, z: 1.2, yaw: 0 },
  toys: { x: -6.05, z: 3.85, yaw: 0.4 },
  ball: { x: -4.85, z: 5.05, yaw: -0.2 },
  castle: { x: -7.25, z: 2.35, yaw: 0.3 },
  road: { x: -4.7, z: 3.15, yaw: -0.4 },
  sofa: { x: -1.55, z: 2.4, yaw: 0 },
  plant: { x: 2.45, z: 1.15, yaw: 0.8 },
  laundry: { x: 6.55, z: 3.45, yaw: 0.6 },
  radio: { x: 1.15, z: 4.7, yaw: 0.5 },
  bed: { x: -4.15, z: -2.75, yaw: Math.PI },
};

const CLIP: Record<TaskKind, { kind: string; loop: boolean }> = {
  sweep: { kind: 'idle', loop: true },
  wipe: { kind: 'idle', loop: true },
  eat: { kind: 'idle', loop: true },
  cook: { kind: 'idle', loop: true },
  draw: { kind: 'idle', loop: true },
  playBlocks: { kind: 'idle', loop: true },
  playBall: { kind: 'jump', loop: true },
  playCastle: { kind: 'idle', loop: true },
  playRoad: { kind: 'idle', loop: true },
  read: { kind: 'sit', loop: false },
  water: { kind: 'idle', loop: true },
  laundry: { kind: 'idle', loop: true },
  music: { kind: 'idle', loop: true },
  phone: { kind: 'idle', loop: true },
  rest: { kind: 'sit', loop: false },
};

const POOLS: Record<string, Chore[]> = {
  mom: [
    chore('sweep', 'rug', 'מטאטאת', 'אמא מטאטאת את השטיח'),
    chore('sweep', 'hall', 'מטאטאת', 'אמא מטאטאת את הרצפה'),
    chore('wipe', 'table', 'מנגבת', 'אמא מנגבת את השולחן'),
    chore('cook', 'kitchen', 'מבשלת', 'אמא מבשלת'),
    chore('eat', 'table', 'אוכלת', 'אמא אוכלת'),
    chore('water', 'plant', 'משקה', 'אמא משקה את העציץ'),
    chore('read', 'sofa', 'קוראת', 'אמא קוראת על הספה'),
    chore('laundry', 'laundry', 'מקפלת', 'אמא מקפלת כביסה'),
    chore('music', 'radio', 'שומעת', 'אמא שומעת מוזיקה'),
  ],
  dad: [
    chore('sweep', 'hall', 'מטאטא', 'אבא מטאטא את הרצפה'),
    chore('wipe', 'table', 'מנגב', 'אבא מנגב את השולחן'),
    chore('cook', 'kitchen', 'מבשל', 'אבא מבשל'),
    chore('eat', 'table', 'אוכל', 'אבא אוכל'),
    chore('read', 'sofa', 'קורא', 'אבא קורא'),
    chore('water', 'plant', 'משקה', 'אבא משקה את העציץ'),
    chore('playBall', 'ball', 'משחק', 'אבא משחק בכדור'),
    chore('music', 'radio', 'שומע', 'אבא שומע מוזיקה'),
    chore('phone', 'bed', 'בטלפון', 'אבא מדבר בטלפון'),
    chore('rest', 'bed', 'נח', 'אבא נח'),
  ],
  brother: [
    chore('draw', 'draw', 'מצייר', 'האח מצייר'),
    chore('playBlocks', 'toys', 'בונה', 'האח בונה מגדל מקוביות'),
    chore('playBall', 'ball', 'משחק', 'האח משחק בכדור'),
    chore('eat', 'table', 'אוכל', 'האח אוכל'),
    chore('sweep', 'rug', 'מטאטא', 'האח עוזר לטאטא'),
    chore('read', 'sofa', 'מסתכל', 'האח מסתכל בספר'),
    chore('water', 'plant', 'משקה', 'האח משקה את העציץ'),
    chore('music', 'radio', 'רוקד', 'האח רוקד למוזיקה'),
  ],
  sister: [
    chore('draw', 'draw', 'מציירת', 'האחות מציירת'),
    chore('read', 'sofa', 'קוראת', 'האחות קוראת'),
    chore('eat', 'table', 'אוכלת', 'האחות אוכלת'),
    chore('phone', 'bed', 'בטלפון', 'האחות מדברת בטלפון'),
    chore('music', 'radio', 'שומעת', 'האחות שומעת מוזיקה'),
    chore('laundry', 'laundry', 'מקפלת', 'האחות מקפלת כביסה'),
    chore('wipe', 'table', 'מנגבת', 'האחות מנגבת את השולחן'),
  ],
  noam: [
    chore('playBall', 'ball', 'משחק', 'נועם משחק בכדור'),
    chore('playBlocks', 'toys', 'בונה', 'נועם בונה מקוביות'),
    chore('draw', 'draw', 'מצייר', 'נועם מצייר'),
    chore('eat', 'table', 'אוכל', 'נועם אוכל'),
    chore('read', 'sofa', 'קורא', 'נועם קורא'),
    chore('music', 'radio', 'רוקד', 'נועם רוקד'),
  ],
  maya: [
    chore('draw', 'draw', 'מציירת', 'מאיה מציירת'),
    chore('playBlocks', 'toys', 'בונה', 'מאיה בונה מקוביות'),
    chore('eat', 'table', 'אוכלת', 'מאיה אוכלת'),
    chore('read', 'sofa', 'קוראת', 'מאיה קוראת'),
    chore('water', 'plant', 'משקה', 'מאיה משקה את העציץ'),
    chore('music', 'radio', 'רוקדת', 'מאיה רוקדת'),
  ],
  neighbor: [
    chore('sweep', 'rug', 'מטאטאת', 'דודה רחל מטאטאת'),
    chore('water', 'plant', 'משקה', 'דודה רחל משקה את העציץ'),
    chore('read', 'sofa', 'קוראת', 'דודה רחל קוראת'),
    chore('cook', 'kitchen', 'מבשלת', 'דודה רחל מבשלת'),
    chore('eat', 'table', 'אוכלת', 'דודה רחל אוכלת'),
    chore('laundry', 'laundry', 'מקפלת', 'דודה רחל מקפלת כביסה'),
    chore('rest', 'bed', 'נחה', 'דודה רחל נחה'),
  ],
  guest: [
    chore('eat', 'table', 'אוכל', 'האורח אוכל'),
    chore('draw', 'draw', 'מצייר', 'האורח מצייר'),
    chore('playBlocks', 'toys', 'משחק', 'האורח משחק'),
    chore('read', 'sofa', 'קורא', 'האורח קורא'),
    chore('music', 'radio', 'שומע', 'האורח שומע מוזיקה'),
  ],
};

function chore(kind: TaskKind, station: string, label: string, line: string): Chore {
  return { kind, station, label, line };
}

const GROW_EVERY: Partial<Record<TaskKind, { every: number; max: number; start: number }>> = {
  draw: { every: 0.55, max: 48, start: 0 },
  playBlocks: { every: 1.8, max: 16, start: 1 },
  playBall: { every: 2.6, max: 6, start: 1 },
  playCastle: { every: 2.2, max: 12, start: 1 },
  playRoad: { every: 1.9, max: 10, start: 1 },
};

function grownCount(kind: TaskKind, seconds: number): number | null {
  const rule = GROW_EVERY[kind];
  if (!rule) return null;
  return Math.min(rule.max, rule.start + Math.floor(Math.max(0, seconds) / rule.every));
}

export class HomeTaskDirector {
  private active = false;
  private suspended = false;
  private jobs = new Map<string, Job>();

  constructor(
    private npcs: NpcManager,
    private onSweepDone?: () => void,
  ) {}

  begin(): void {
    this.end();
    this.active = true;
  }

  end(): void {
    for (const [id, job] of this.jobs) this.clearProp(id, job);
    for (const id of this.jobs.keys()) this.npcs.releaseActor(id);
    this.jobs.clear();
    this.active = false;
    this.suspended = false;
  }

  update(dt: number): void {
    if (!this.active) return;
    if (this.npcs.isHeld) {
      if (!this.suspended) {
        this.suspended = true;
        for (const [id, job] of this.jobs) this.clearProp(id, job);
        for (const id of this.jobs.keys()) this.npcs.releaseActor(id);
        this.jobs.clear();
      }
      return;
    }
    this.suspended = false;

    const present = new Set(this.npcs.actors.map((actor) => actor.id));
    for (const id of [...this.jobs.keys()]) {
      if (!present.has(id)) {
        const job = this.jobs.get(id);
        if (job) this.clearProp(id, job);
        this.jobs.delete(id);
      }
    }
    for (const actor of this.npcs.actors) {
      if (!this.jobs.has(actor.id)) this.assign(actor.id, actor.mesh.position.x, actor.mesh.position.z);
    }

    for (const [id, job] of this.jobs) {
      const station = STATIONS[job.chore.station];
      if (!station) continue;
      job.time += dt;
      if (job.phase === 'walk') this.stepWalk(id, job, station, dt);
      else if (job.phase === 'act') this.stepAct(id, job, station);
      else if (job.time > 1.1) this.assign(id, job.x, job.z, job.chore.kind);
    }
  }

  private assign(id: string, x: number, z: number, previous?: TaskKind): void {
    const previousJob = this.jobs.get(id);
    if (previousJob) this.clearProp(id, previousJob);
    const next = this.pick(id, previous);
    const station = STATIONS[next.station];
    const dist = Math.hypot(station.x - x, station.z - z);
    this.jobs.set(id, {
      chore: next,
      phase: dist < 0.25 ? 'act' : 'walk',
      time: 0,
      duration: 9 + Math.random() * 7,
      x,
      z,
    });
    if (dist < 0.25) this.startActing(id, this.jobs.get(id)!, station);
  }

  private pick(id: string, previous?: TaskKind): Chore {
    const pool = POOLS[id] ?? POOLS.guest;
    const taken = new Set<string>();
    for (const [otherId, job] of this.jobs) {
      if (otherId !== id && job.phase !== 'gap') taken.add(job.chore.station);
    }
    let options = pool.filter((item) => !taken.has(item.station) && item.kind !== previous);
    if (!options.length) options = pool.filter((item) => !taken.has(item.station));
    if (!options.length) options = pool.filter((item) => item.kind !== previous);
    if (!options.length) options = pool;
    return options[Math.floor(Math.random() * options.length)];
  }

  private stepWalk(id: string, job: Job, station: Station, dt: number): void {
    const dx = station.x - job.x;
    const dz = station.z - job.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.22) {
      job.x = station.x;
      job.z = station.z;
      job.phase = 'act';
      job.time = 0;
      this.startActing(id, job, station);
      return;
    }
    const step = Math.min(dist, 2.6 * dt);
    job.x += (dx / dist) * step;
    job.z += (dz / dist) * step;
    this.npcs.moveBusy(id, job.x, job.z, Math.atan2(dx, dz));
    this.npcs.playClip(id, 'walk', true);
  }

  private startActing(id: string, job: Job, station: Station): void {
    const actor = this.npcs.actors.find((item) => item.id === id);
    if (!actor) return;
    this.npcs.holdAt(id, station.x, station.z, station.yaw);
    const clip = CLIP[job.chore.kind];
    this.npcs.playClip(id, clip.kind, clip.loop);
    job.prop = createProp(job.chore.kind, job.chore.label);
    actor.mesh.add(job.prop.object);
    this.npcs.setStatus(id, job.chore.line);
  }

  private stepAct(id: string, job: Job, station: Station): void {
    let yaw = station.yaw;
    if (job.chore.kind === 'music') yaw += Math.sin(job.time * 2.4) * 0.2;
    this.npcs.holdAt(id, station.x, station.z, yaw);
    job.prop?.tick(job.time);
    if (job.time < job.duration) return;
    if (job.chore.kind === 'sweep') this.onSweepDone?.();
    this.clearProp(id, job);
    this.npcs.setStatus(id, null);
    this.npcs.playClip(id, 'idle', true);
    this.npcs.holdAt(id, station.x, station.z, station.yaw);
    job.phase = 'gap';
    job.time = 0;
  }

  private clearProp(id: string, job: Job): void {
    const actor = this.npcs.actors.find((item) => item.id === id);
    if (job.prop) {
      actor?.mesh.remove(job.prop.object);
      job.prop.dispose();
      job.prop = undefined;
    }
  }
}

function createProp(kind: TaskKind, label: string): ChoreProp {
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const root = new THREE.Group();
  root.frustumCulled = false;
  const mat = (color: number, opacity = 1) => {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.68,
      metalness: 0,
      transparent: opacity < 1,
      opacity,
    });
    mats.push(material);
    return material;
  };
  const use = (geometry: THREE.BufferGeometry) => {
    geos.push(geometry);
    return geometry;
  };
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = root) => {
    const item = new THREE.Mesh(geometry, material);
    item.frustumCulled = false;
    item.castShadow = false;
    parent.add(item);
    return item;
  };

  if (kind === 'sweep') buildSweep(root, mat, use, mesh);
  else if (kind === 'wipe') buildWipe(root, mat, use, mesh);
  else if (kind === 'eat') buildEat(root, mat, use, mesh);
  else if (kind === 'cook') buildCook(root, mat, use, mesh);
  else if (kind === 'draw') buildDraw(root, mat, use, mesh);
  else if (kind === 'playBlocks') buildBlocks(root, mat, use, mesh);
  else if (kind === 'playBall') buildBall(root, mat, use, mesh);
  else if (kind === 'playCastle') buildCastle(root, mat, use, mesh);
  else if (kind === 'playRoad') buildRoad(root, mat, use, mesh);
  else if (kind === 'read') buildBook(root, mat, use, mesh);
  else if (kind === 'water') buildWater(root, mat, use, mesh);
  else if (kind === 'laundry') buildLaundry(root, mat, use, mesh);
  else if (kind === 'music') buildNotes(root, mat, use, mesh);
  else if (kind === 'phone') buildPhone(root, mat, use, mesh);
  else buildRest(root, mat, use, mesh);

  root.add(makeLabel(label));

  let tick = (_elapsed: number) => {};
  root.traverse((obj) => {
    const marked = obj as THREE.Object3D & { tick?: (elapsed: number) => void };
    if (marked.tick) tick = marked.tick;
  });

  return {
    object: root,
    tick,
    dispose() {
      const seenGeo = new Set<THREE.BufferGeometry>();
      const seenMat = new Set<THREE.Material>();
      root.traverse((obj) => {
        const drawable = obj as THREE.Mesh;
        if (drawable.geometry && !seenGeo.has(drawable.geometry)) {
          seenGeo.add(drawable.geometry);
          drawable.geometry.dispose();
        }
        const material = drawable.material;
        const list = Array.isArray(material) ? material : material ? [material] : [];
        for (const item of list) {
          if (seenMat.has(item)) continue;
          seenMat.add(item);
          const textured = item as THREE.MeshStandardMaterial;
          textured.map?.dispose();
          item.dispose();
        }
      });
      for (const geometry of geos) {
        if (!seenGeo.has(geometry)) geometry.dispose();
      }
    },
  };
}

type MatFn = (color: number, opacity?: number) => THREE.Material;
type UseFn = (geometry: THREE.BufferGeometry) => THREE.BufferGeometry;
type MeshFn = (geometry: THREE.BufferGeometry, material: THREE.Material, parent?: THREE.Object3D) => THREE.Mesh;

function buildSweep(root: THREE.Group, mat: MatFn, use: UseFn, mesh: MeshFn): void {
  const pivot = new THREE.Group();
  pivot.position.set(0.72, 1.7, 0.35);
  root.add(pivot);
  const handleEnd = new THREE.Vector3(0.05, -1.55, 0.85);
  stick(pivot, new THREE.Vector3(0, 0, 0), handleEnd, 0.07, mat(0xc47a3a), use);
  const bristles = mesh(use(new THREE.ConeGeometry(0.32, 0.42, 10)), mat(0xf0d9a0), pivot);
  bristles.position.copy(handleEnd);
  bristles.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), handleEnd.clone().normalize());
  const dust: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    dust.push(mesh(use(new THREE.SphereGeometry(0.05, 6, 6)), mat(0xd2c2a2), root));
  }
  (root as THREE.Group & { tick?: (elapsed: number) => void }).tick = (elapsed) => {
    const sweep = Math.sin(elapsed * 3.6);
    pivot.rotation.y = sweep * 0.85;
    dust.forEach((mote, index) => {
      const life = (elapsed * 1.3 + index * 0.19) % 1;
      mote.position.set(0.55 + sweep * 0.45, 0.1 + life * 0.35, 1.15 + life * 0.2);
      mote.scale.setScalar(0.8 + (1 - life));
    });
  };
}

function buildWipe(root: THREE.Group, mat: MatFn, use: UseFn, mesh: MeshFn): void {
  const board = mesh(use(new THREE.BoxGeometry(0.9, 0.1, 0.6)), mat(0xe7d7b8));
  board.position.set(0, 1.25, 0.95);
  const cloth = mesh(use(new THREE.BoxGeometry(0.36, 0.08, 0.28)), mat(0xf7fbff));
  (root as THREE.Group & { tick?: (elapsed: number) => void }).tick = (elapsed) => {
    cloth.position.set(Math.sin(elapsed * 3) * 0.28, 1.34, 0.95);
  };
}

function buildEat(root: THREE.Group, mat: MatFn, use: UseFn, mesh: MeshFn): void {
  const plate = mesh(use(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 16)), mat(0xf7f4ee));
  plate.position.set(0, 1.25, 0.9);
  const food = mesh(use(new THREE.SphereGeometry(0.1, 10, 8)), mat(0xe07a32));
  const bite = mesh(use(new THREE.BoxGeometry(0.12, 0.08, 0.16)), mat(0xe6c27a));
  (root as THREE.Group & { tick?: (elapsed: number) => void }).tick = (elapsed) => {
    const lift = Math.abs(Math.sin(elapsed * 2.6));
    food.position.set(0.05, 1.38, 0.85);
    food.scale.setScalar(0.85 + 0.15 * (1 - (elapsed % 4) / 4));
    bite.position.set(0.16, 1.4 + lift * 0.6, 0.7 - lift * 0.15);
  };
}

function buildCook(root: THREE.Group, mat: MatFn, use: UseFn, mesh: MeshFn): void {
  const pot = mesh(use(new THREE.CylinderGeometry(0.22, 0.18, 0.28, 12)), mat(0x3e4450));
  pot.position.set(0.05, 1.18, 0.58);
  const spoon = stick(root, new THREE.Vector3(0.05, 1.45, 0.58), new THREE.Vector3(0.28, 1.7, 0.35), 0.03, mat(0xd8d2c8), use);
  const steam: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) steam.push(mesh(use(new THREE.SphereGeometry(0.06, 6, 6)), mat(0xf3f6f8, 0.85)));
  (root as THREE.Group & { tick?: (elapsed: number) => void }).tick = (elapsed) => {
    const angle = elapsed * 2.4;
    spoon.position.set(0.05 + Math.cos(angle) * 0.08, 1.55, 0.58 + Math.sin(angle) * 0.08);
    steam.forEach((puff, index) => {
      const life = (elapsed * 0.45 + index * 0.33) % 1;
      puff.position.set(0.05 + Math.sin(index) * 0.06, 1.35 + life * 0.55, 0.58);
      puff.scale.setScalar(0.6 + life);
    });
  };
}

function buildDraw(root: THREE.Group, mat: MatFn, use: UseFn, mesh: MeshFn): void {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(0, 0, 160, 120);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const paperMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85, metalness: 0 });
  const paper = mesh(use(new THREE.PlaneGeometry(0.85, 0.64)), paperMat);
  paper.position.set(0, 1.62, 0.95);
  paper.rotation.x = -0.2;
  const crayon = mesh(use(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 8)), mat(0xe23b4a));
  const colors = ['#e23b4a', '#2f6fed', '#f2c14e', '#3aaa5a', '#9b59d0'];
  const starColors = [0xe23b4a, 0xf2c14e, 0x2f6fed, 0x3aaa5a];
  const starSpots: Array<[number, number, number]> = [
    [-0.58, 1.95, 0.9],
    [0.58, 1.98, 0.88],
    [-0.52, 1.28, 0.98],
    [0.54, 1.26, 0.96],
    [0.02, 2.12, 0.84],
    [-0.22, 1.12, 1.02],
    [0.28, 2.08, 0.9],
    [0.08, 1.18, 1.05],
  ];
  let tipX = 80;
  let tipY = 60;
  let strokes = 0;
  let starsBuilt = 0;
  const stars: THREE.Mesh[] = [];
  const stamp = (count: number) => {
    if (!ctx) return;
    if (count === 8 || count === 32) {
      ctx.fillStyle = '#e7b15a';
      ctx.fillRect(16, 64, 34, 26);
      ctx.fillStyle = '#c4473a';
      ctx.beginPath();
      ctx.moveTo(12, 64);
      ctx.lineTo(33, 44);
      ctx.lineTo(54, 64);
      ctx.fill();
    } else if (count === 16) {
      ctx.fillStyle = '#f2c14e';
      ctx.beginPath();
      ctx.arc(128, 28, 12, 0, Math.PI * 2);
      ctx.fill();
    } else if (count === 24 || count === 40) {
      ctx.fillStyle = '#3aaa5a';
      ctx.fillRect(112, 70, 6, 22);
      ctx.beginPath();
      ctx.arc(115, 64, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  (root as THREE.Group & { tick?: (elapsed: number) => void }).tick = (elapsed) => {
    const want = grownCount('draw', elapsed) ?? 0;
    let guard = 0;
    while (ctx && strokes < want && guard < 60) {
      guard += 1;
      const color = colors[strokes % colors.length];
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      for (let i = 0; i < 4; i++) {
        tipX = Math.min(148, Math.max(12, tipX + (Math.random() - 0.5) * 42));
        tipY = Math.min(108, Math.max(12, tipY + (Math.random() - 0.5) * 32));
        ctx.lineTo(tipX, tipY);
      }
      ctx.stroke();
      strokes += 1;
      stamp(strokes);
      texture.needsUpdate = true;
      (crayon.material as THREE.MeshStandardMaterial).color.set(color);
    }
    const wantStars = Math.min(starSpots.length, Math.floor(elapsed / 3.2));
    while (starsBuilt < wantStars) {
      const spot = starSpots[starsBuilt];
      const star = mesh(use(new THREE.OctahedronGeometry(0.07, 0)), mat(starColors[starsBuilt % starColors.length]));
      star.position.set(spot[0], spot[1], spot[2]);
      stars.push(star);
      starsBuilt += 1;
    }
    stars.forEach((star, index) => {
      star.rotation.y = elapsed + index;
      star.rotation.z = elapsed * 0.6;
    });
    crayon.position.set((tipX / 160 - 0.5) * 0.85, 1.62 + (0.5 - tipY / 120) * 0.64 + 0.1, 1.05);
    crayon.rotation.z = Math.sin(elapsed * 4) * 0.4;
  };
  root.userData.drawMap = texture;
}

function buildBlocks(root: THREE.Group, mat: MatFn, use: UseFn, mesh: MeshFn): void {
  const colors = [0xe23b4a, 0x2f6fed, 0xf2c14e, 0x3aaa5a, 0x9b59d0, 0xe07a32];
  const blocks: THREE.Mesh[] = [];
  let built = 0;
  (root as THREE.Group & { tick?: (elapsed: number) => void }).tick = (elapsed) => {
    const want = grownCount('playBlocks', elapsed) ?? 1;
    while (built < want) {
      const block = mesh(use(new THREE.BoxGeometry(0.26, 0.24, 0.26)), mat(colors[built % colors.length]));
      blocks.push(block);
      built += 1;
    }
    blocks.forEach((block, index) => {
      const column = index < 8 ? 0 : 1;
      const row = index % 8;
      block.position.set(0.5 + column * 0.32, 0.14 + row * 0.24, 1);
      block.rotation.z = 0;
    });
    const top = blocks[blocks.length - 1];
    if (top) top.rotation.z = Math.sin(elapsed * 2.2) * 0.06;
  };
}

function buildBall(root: THREE.Group, mat: MatFn, use: UseFn, mesh: MeshFn): void {
  const colors = [0xde3b4a, 0x2f6fed, 0xf2c14e, 0x3aaa5a, 0x9b59d0, 0xe07a32];
  const balls: THREE.Mesh[] = [];
  let built = 0;
  (root as THREE.Group & { tick?: (elapsed: number) => void }).tick = (elapsed) => {
    const want = grownCount('playBall', elapsed) ?? 1;
    while (built < want) {
      balls.push(mesh(use(new THREE.SphereGeometry(0.16, 14, 12)), mat(colors[built % colors.length])));
      built += 1;
    }
    balls.forEach((ball, index) => {
      const bounce = Math.abs(Math.sin(elapsed * 3.1 + index * 0.7));
      const spread = (index - (balls.length - 1) / 2) * 0.28;
      ball.position.set(spread, 0.18 + bounce * (0.55 + index * 0.12), 0.95);
    });
  };
}

function buildCastle(root: THREE.Group, mat: MatFn, use: UseFn, mesh: MeshFn): void {
  const pieces: Array<[number, number, number, number, number, number, number]> = [
    [0, 0.05, 1.2, 1.3, 0.08, 1.2, 0xd7c4a3],
    [0, 0.42, 1.76, 1.3, 0.66, 0.08, 0xcbb892],
    [-0.61, 0.42, 1.2, 0.08, 0.66, 1.05, 0xcbb892],
    [0.61, 0.42, 1.2, 0.08, 0.66, 1.05, 0xcbb892],
    [0, 0.55, 0.64, 0.7, 0.4, 0.08, 0xcbb892],
    [0, 0.24, 0.64, 0.26, 0.4, 0.06, 0x8d5a32],
    [-0.72, 0.78, 1.76, 0.24, 1.2, 0.24, 0xb7a078],
    [0.72, 0.78, 1.76, 0.24, 1.2, 0.24, 0xb7a078],
    [0, 0.84, 1.2, 1.45, 0.08, 1.35, 0xb5523a],
    [0.72, 1.5, 1.76, 0.04, 0.45, 0.04, 0xf4f1ea],
    [0.88, 1.64, 1.76, 0.24, 0.14, 0.03, 0x2f6fed],
    [0, 0.48, 1.8, 0.2, 0.16, 0.04, 0x7ec8e3],
  ];
  let built = 0;
  (root as THREE.Group & { tick?: (elapsed: number) => void }).tick = (elapsed) => {
    const want = Math.min(pieces.length, grownCount('playCastle', elapsed) ?? 1);
    while (built < want) {
      const [x, y, z, w, h, d, color] = pieces[built];
      const piece = mesh(use(new THREE.BoxGeometry(w, h, d)), mat(color));
      piece.position.set(x, y, z);
      built += 1;
    }
  };
}

function buildRoad(root: THREE.Group, mat: MatFn, use: UseFn, mesh: MeshFn): void {
  const colors = [0xe23b4a, 0x2f6fed, 0xf2c14e, 0x3aaa5a, 0x9b59d0, 0xe07a32];
  const cars: THREE.Mesh[] = [];
  let built = 0;
  (root as THREE.Group & { tick?: (elapsed: number) => void }).tick = (elapsed) => {
    const want = grownCount('playRoad', elapsed) ?? 1;
    while (built < want) {
      const x = -0.15 + built * 0.4;
      const tile = mesh(use(new THREE.BoxGeometry(0.36, 0.05, 0.32)), mat(0x3c4148));
      tile.position.set(x, 0.04, 1.05);
      const line = mesh(use(new THREE.BoxGeometry(0.16, 0.02, 0.06)), mat(0xf2c14e));
      line.position.set(x, 0.075, 1.05);
      const car = mesh(use(new THREE.BoxGeometry(0.22, 0.1, 0.14)), mat(colors[built % colors.length]));
      car.position.set(x, 0.14, 1.05);
      cars.push(car);
      built += 1;
    }
    cars.forEach((car, index) => {
      car.position.y = 0.14 + Math.abs(Math.sin(elapsed * 3 + index)) * 0.06;
    });
  };
}

function buildBook(root: THREE.Group, mat: MatFn, use: UseFn, mesh: MeshFn): void {
  const left = mesh(use(new THREE.BoxGeometry(0.28, 0.36, 0.04)), mat(0xfffaf2));
  const right = mesh(use(new THREE.BoxGeometry(0.28, 0.36, 0.04)), mat(0xfffaf2));
  const cover = mesh(use(new THREE.BoxGeometry(0.62, 0.4, 0.05)), mat(0x3d6ea8));
  cover.position.set(0, 1.45, 0.42);
  left.position.set(-0.15, 1.5, 0.46);
  right.position.set(0.15, 1.5, 0.46);
  (root as THREE.Group & { tick?: (elapsed: number) => void }).tick = (elapsed) => {
    const turn = Math.sin(elapsed * 1.2) * 0.15;
    left.rotation.y = 0.25 + turn;
    right.rotation.y = -0.25 - turn;
  };
}

function buildWater(root: THREE.Group, mat: MatFn, use: UseFn, mesh: MeshFn): void {
  const can = mesh(use(new THREE.BoxGeometry(0.26, 0.22, 0.18)), mat(0x3a7ca5));
  can.position.set(0.32, 1.45, 0.4);
  stick(root, new THREE.Vector3(0.44, 1.48, 0.4), new THREE.Vector3(0.62, 1.28, 0.7), 0.04, mat(0x2f6a90), use);
  const drops: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) drops.push(mesh(use(new THREE.SphereGeometry(0.035, 6, 6)), mat(0x7ec8e3)));
  (root as THREE.Group & { tick?: (elapsed: number) => void }).tick = (elapsed) => {
    can.rotation.z = -0.5;
    drops.forEach((drop, index) => {
      const life = (elapsed * 1.6 + index * 0.25) % 1;
      drop.position.set(0.62, 1.25 - life * 1.05, 0.72 + life * 0.15);
    });
  };
}

function buildLaundry(root: THREE.Group, mat: MatFn, use: UseFn, mesh: MeshFn): void {
  const basket = mesh(use(new THREE.CylinderGeometry(0.28, 0.24, 0.22, 10, 1, true)), mat(0x8d5a32));
  basket.position.set(0.15, 0.2, 0.7);
  const shirt = mesh(use(new THREE.BoxGeometry(0.36, 0.28, 0.06)), mat(0x6e8caf));
  (root as THREE.Group & { tick?: (elapsed: number) => void }).tick = (elapsed) => {
    const fold = (Math.sin(elapsed * 1.6) + 1) / 2;
    shirt.position.set(0, 1.15 - fold * 0.7, 0.62);
    shirt.scale.y = 0.4 + fold;
  };
}

function buildNotes(root: THREE.Group, mat: MatFn, use: UseFn, mesh: MeshFn): void {
  const colors = [0xf2c14e, 0xe23b4a, 0x3aaa5a];
  const notes = colors.map((color) => mesh(use(new THREE.SphereGeometry(0.07, 8, 8)), mat(color)));
  (root as THREE.Group & { tick?: (elapsed: number) => void }).tick = (elapsed) => {
    notes.forEach((note, index) => {
      const life = (elapsed * 0.55 + index * 0.33) % 1;
      note.position.set(-0.2 + index * 0.2, 1.8 + life * 1.1, 0.3);
      note.scale.setScalar(1 - life * 0.5);
    });
  };
}

function buildPhone(root: THREE.Group, mat: MatFn, use: UseFn, mesh: MeshFn): void {
  const phone = mesh(use(new THREE.BoxGeometry(0.1, 0.2, 0.04)), mat(0x24282e));
  phone.position.set(0.22, 2.15, 0.28);
  (root as THREE.Group & { tick?: (elapsed: number) => void }).tick = (elapsed) => {
    phone.rotation.z = 0.4 + Math.sin(elapsed * 2) * 0.05;
  };
}

function buildRest(root: THREE.Group, mat: MatFn, use: UseFn, mesh: MeshFn): void {
  const pillow = mesh(use(new THREE.BoxGeometry(0.42, 0.16, 0.28)), mat(0xf2d2cf));
  pillow.position.set(0, 1.05, 0.35);
  (root as THREE.Group & { tick?: (elapsed: number) => void }).tick = (elapsed) => {
    pillow.position.y = 1.02 + Math.sin(elapsed * 1.5) * 0.03;
  };
}

function stick(
  parent: THREE.Object3D,
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  use: UseFn,
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(to, from);
  const length = Math.max(0.04, dir.length());
  const item = new THREE.Mesh(use(new THREE.CylinderGeometry(radius, radius, length, 8)), material);
  item.position.copy(from).add(to).multiplyScalar(0.5);
  item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  item.frustumCulled = false;
  parent.add(item);
  return item;
}

function makeLabel(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(18, 22, 28, 0.8)';
    ctx.fillRect(48, 24, 416, 80);
    ctx.fillStyle = '#ffffff';
    ctx.font = '64px Arial, Rubik, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.position.set(0, 3.25, 0);
  sprite.scale.set(1.5, 0.38, 1);
  sprite.renderOrder = 20;
  return sprite;
}

export interface TaskBody {
  mesh: THREE.Object3D;
  position: THREE.Vector3;
  /** Yaw that points the body toward the camera, so the activity sits in view. */
  cameraYaw: number;
  taskHold: boolean;
  playHeldClip(kind: string, loop: boolean): void;
  releaseHold(): void;
}

export interface TaskChoice {
  kind: TaskKind;
  title: string;
  station: string;
  label: string;
}

const PLAYER_TASKS: TaskChoice[] = [
  { kind: 'sweep', title: 'לטאטא', station: 'rug', label: 'מטאטא' },
  { kind: 'wipe', title: 'לנגב', station: 'table', label: 'ניגוב' },
  { kind: 'eat', title: 'לאכול', station: 'table', label: 'אכילה' },
  { kind: 'cook', title: 'לבשל', station: 'kitchen', label: 'בישול' },
  { kind: 'draw', title: 'לצייר', station: 'draw', label: 'ציור' },
  { kind: 'playBlocks', title: 'מגדל קוביות', station: 'toys', label: 'קוביות' },
  { kind: 'playBall', title: 'משחק כדורים', station: 'ball', label: 'כדורים' },
  { kind: 'playCastle', title: 'לבנות מבצר', station: 'castle', label: 'מבצר' },
  { kind: 'playRoad', title: 'מסלול מכוניות', station: 'road', label: 'מסלול' },
  { kind: 'read', title: 'לקרוא', station: 'sofa', label: 'קריאה' },
  { kind: 'water', title: 'להשקות', station: 'plant', label: 'השקיה' },
  { kind: 'laundry', title: 'לקפל כביסה', station: 'laundry', label: 'כביסה' },
  { kind: 'music', title: 'לרקוד', station: 'radio', label: 'ריקוד' },
  { kind: 'phone', title: 'לדבר בטלפון', station: 'bed', label: 'טלפון' },
  { kind: 'rest', title: 'לנוח', station: 'bed', label: 'מנוחה' },
];

const TASK_VERB: Record<TaskKind, [string, string]> = {
  sweep: ['מטאטאת', 'מטאטא'],
  wipe: ['מנגבת', 'מנגב'],
  eat: ['אוכלת', 'אוכל'],
  cook: ['מבשלת', 'מבשל'],
  draw: ['מציירת', 'מצייר'],
  playBlocks: ['בונה מגדל קוביות', 'בונה מגדל קוביות'],
  playBall: ['משחקת בכדורים', 'משחק בכדורים'],
  playCastle: ['בונה מבצר', 'בונה מבצר'],
  playRoad: ['בונה מסלול מכוניות', 'בונה מסלול מכוניות'],
  read: ['קוראת', 'קורא'],
  water: ['משקה את העציץ', 'משקה את העציץ'],
  laundry: ['מקפלת כביסה', 'מקפל כביסה'],
  music: ['רוקדת', 'רוקד'],
  phone: ['מדברת בטלפון', 'מדבר בטלפון'],
  rest: ['נחה', 'נח'],
};

export function tasksForPlayer(): TaskChoice[] {
  return PLAYER_TASKS.map((task) => ({ ...task }));
}

export function taskLine(playerId: string, name: string, kind: TaskKind): string {
  const female = playerId === 'yael' || playerId === 'tala';
  const verb = TASK_VERB[kind][female ? 0 : 1];
  const tail = GROW_EVERY[kind]
    ? 'זה ממשיך להיבנות כל עוד המשחק נמשך.'
    : 'זה יימשך עד שתבחרו משימה אחרת.';
  return `${name} ${verb}. ${tail}`;
}

export function progressText(kind: TaskKind, seconds: number): string | null {
  if (!GROW_EVERY[kind]) return null;
  if (seconds <= 0) return 'נבנה עוד ועוד';
  const count = grownCount(kind, seconds) ?? 0;
  if (kind === 'draw') {
    if (count <= 0) return 'הדף ריק';
    if (count === 1) return 'קו אחד';
    return `${count} קווים`;
  }
  if (kind === 'playBlocks') return count === 1 ? 'קובייה אחת' : `${count} קוביות`;
  if (kind === 'playBall') return count === 1 ? 'כדור אחד' : `${count} כדורים`;
  if (kind === 'playCastle') return count === 1 ? 'חלק אחד' : `${count} חלקים`;
  if (kind === 'playRoad') return count === 1 ? 'קטע אחד' : `${count} קטעים`;
  return null;
}

function growthCaption(kind: TaskKind, seconds: number): string | null {
  const count = grownCount(kind, seconds);
  if (count === null) return null;
  if (kind === 'draw') {
    if (count < 4 || count % 4 !== 0) return null;
    return `הציור מתמלא — ${count} קווים`;
  }
  if (kind === 'playBlocks') return `המגדל גדל — ${count === 1 ? 'קובייה אחת' : `${count} קוביות`}`;
  if (kind === 'playBall') return `נוסף כדור — ${count === 1 ? 'כדור אחד' : `${count} כדורים`}`;
  if (kind === 'playCastle') return `המבצר גדל — ${count === 1 ? 'חלק אחד' : `${count} חלקים`}`;
  if (kind === 'playRoad') return `המסלול מתארך — ${count === 1 ? 'קטע אחד' : `${count} קטעים`}`;
  return null;
}

/** The player's own chore. It keeps going until they pick another one. */
export class PlayerTaskDirector {
  private current: TaskChoice | null = null;
  private phase: 'walk' | 'act' = 'act';
  private session = 0;
  private spent: Partial<Record<TaskKind, number>> = {};
  private prop?: ChoreProp;
  private dest: Station = { x: 0, z: 0, yaw: 0 };
  private noted = -1;

  constructor(private hooks?: { onSweep?: () => void; onEat?: () => void }) {}

  get kind(): TaskKind | null {
    return this.current?.kind ?? null;
  }

  get active(): boolean {
    return this.current !== null;
  }

  seconds(kind: TaskKind): number {
    const banked = this.spent[kind] ?? 0;
    return banked + (this.current?.kind === kind && this.phase === 'act' ? this.session : 0);
  }

  start(choice: TaskChoice, body: TaskBody): void {
    this.bank();
    this.drop(body);
    this.current = choice;
    this.session = 0;
    body.taskHold = true;
    // Stay where the player already is. Walking to a corner puts the camera
    // outside the house wall, and the activity disappears behind it.
    this.beginAct(body, { x: body.position.x, z: body.position.z, yaw: body.cameraYaw });
  }

  /** Stops the performance and keeps whatever a game already built. */
  yield(body: TaskBody): boolean {
    if (!this.current) return false;
    this.bank();
    this.drop(body);
    this.current = null;
    this.phase = 'act';
    body.releaseHold();
    return true;
  }

  update(dt: number, body: TaskBody): string | null {
    if (!this.current) return null;
    body.taskHold = true;
    this.session += dt;
    const kind = this.current.kind;
    let yaw = this.dest.yaw;
    if (kind === 'music') yaw += Math.sin(this.seconds(kind) * 2.4) * 0.2;
    body.position.x = this.dest.x;
    body.position.y = 0;
    body.position.z = this.dest.z;
    body.mesh.rotation.y = yaw;
    const clip = CLIP[kind];
    body.playHeldClip(clip.kind, clip.loop);
    this.prop?.tick(this.seconds(kind));
    if (kind === 'sweep' && Math.floor(this.session / 5) > Math.floor((this.session - dt) / 5)) this.hooks?.onSweep?.();
    if (kind === 'eat' && this.session >= 0.4 && this.session - dt < 0.4) this.hooks?.onEat?.();
    else if (kind === 'eat' && Math.floor(this.session / 8) > Math.floor((this.session - dt) / 8)) this.hooks?.onEat?.();
    const count = grownCount(kind, this.seconds(kind));
    if (count === null || count <= this.noted) return null;
    this.noted = count;
    return growthCaption(kind, this.seconds(kind));
  }

  private beginAct(body: TaskBody, spot: Station): void {
    if (!this.current) return;
    this.drop(body);
    this.phase = 'act';
    this.dest = spot;
    this.session = 0;
    body.position.x = spot.x;
    body.position.y = 0;
    body.position.z = spot.z;
    body.mesh.rotation.y = spot.yaw;
    const clip = CLIP[this.current.kind];
    body.playHeldClip(clip.kind, clip.loop);
    this.prop = createProp(this.current.kind, this.current.label);
    body.mesh.add(this.prop.object);
    const soFar = this.seconds(this.current.kind);
    if (soFar > 0) this.prop.tick(soFar);
    this.noted = grownCount(this.current.kind, soFar) ?? -1;
  }

  private bank(): void {
    if (!this.current || this.phase !== 'act') return;
    const kind = this.current.kind;
    this.spent[kind] = (this.spent[kind] ?? 0) + this.session;
    this.session = 0;
  }

  private drop(body: TaskBody): void {
    if (!this.prop) return;
    body.mesh.remove(this.prop.object);
    this.prop.dispose();
    this.prop = undefined;
  }

}
