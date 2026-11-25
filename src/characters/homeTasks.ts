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
 * draw: a white sheet. Every moment a new colored scribble appears and
 *   the crayon sits at the end of that stroke.
 * playBlocks: bright blocks on the floor that stack, then tumble.
 * playBall: a ball bouncing in front of a jumping body.
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
  rug: { x: -2.2, z: 1.5, yaw: 0.2 },
  hall: { x: 0.6, z: -1.8, yaw: -0.4 },
  table: { x: 2.3, z: -2.5, yaw: 0.7 },
  kitchen: { x: 5.5, z: -3.6, yaw: Math.PI },
  draw: { x: -0.8, z: -2.7, yaw: 0.15 },
  toys: { x: -5.6, z: 2.5, yaw: 0.4 },
  ball: { x: 1.7, z: 2.7, yaw: -0.2 },
  sofa: { x: -4.5, z: 0.85, yaw: 0 },
  plant: { x: 2.1, z: 1.9, yaw: 0 },
  laundry: { x: 6.2, z: 0.3, yaw: 1.1 },
  radio: { x: -2.7, z: -0.5, yaw: 0.2 },
  bed: { x: -5.3, z: -3.1, yaw: Math.PI },
};

const CLIP: Record<TaskKind, { kind: string; loop: boolean }> = {
  sweep: { kind: 'idle', loop: true },
  wipe: { kind: 'idle', loop: true },
  eat: { kind: 'idle', loop: true },
  cook: { kind: 'idle', loop: true },
  draw: { kind: 'idle', loop: true },
  playBlocks: { kind: 'idle', loop: true },
  playBall: { kind: 'jump', loop: true },
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
  let nextStroke = 0.2;
  let tipX = 80;
  let tipY = 60;
  (root as THREE.Group & { tick?: (elapsed: number) => void }).tick = (elapsed) => {
    if (ctx && elapsed > nextStroke) {
      nextStroke = elapsed + 0.55;
      const color = colors[Math.floor(elapsed) % colors.length];
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      for (let i = 0; i < 4; i++) {
        tipX = Math.min(148, Math.max(12, tipX + (Math.random() - 0.5) * 48));
        tipY = Math.min(108, Math.max(12, tipY + (Math.random() - 0.5) * 36));
        ctx.lineTo(tipX, tipY);
      }
      ctx.stroke();
      texture.needsUpdate = true;
      (crayon.material as THREE.MeshStandardMaterial).color.set(color);
    }
    crayon.position.set((tipX / 160 - 0.5) * 0.85, 1.62 + (0.5 - tipY / 120) * 0.64 + 0.1, 1.05);
    crayon.rotation.z = Math.sin(elapsed * 4) * 0.4;
  };
  root.userData.drawMap = texture;
}

function buildBlocks(root: THREE.Group, mat: MatFn, use: UseFn, mesh: MeshFn): void {
  const colors = [0xe23b4a, 0x2f6fed, 0xf2c14e, 0x3aaa5a];
  const blocks = colors.map((color) => mesh(use(new THREE.BoxGeometry(0.22, 0.22, 0.22)), mat(color)));
  (root as THREE.Group & { tick?: (elapsed: number) => void }).tick = (elapsed) => {
    const stack = (Math.sin(elapsed * 0.7) + 1) / 2;
    blocks.forEach((block, index) => {
      const spread = (1 - stack) * (index - 1.5) * 0.28;
      block.position.set(spread, 0.14 + stack * index * 0.22, 0.85);
      block.rotation.y = (1 - stack) * index;
    });
  };
}

function buildBall(root: THREE.Group, mat: MatFn, use: UseFn, mesh: MeshFn): void {
  const ball = mesh(use(new THREE.SphereGeometry(0.2, 14, 12)), mat(0xde3b4a));
  (root as THREE.Group & { tick?: (elapsed: number) => void }).tick = (elapsed) => {
    const bounce = Math.abs(Math.sin(elapsed * 3.2));
    ball.position.set(Math.sin(elapsed * 1.4) * 0.25, 0.2 + bounce * 0.85, 0.9);
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
