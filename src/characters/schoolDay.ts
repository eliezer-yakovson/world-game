import * as THREE from 'three';
import type { GameClock } from '../core/GameClock';

/**
 * One school day, shared by every child and both teachers.
 * 08:00–14:00 is school. Recess is 10:00–10:20 and 12:00–12:30.
 * Each student has one chair. Recess spots are fixed too, so nobody stacks.
 */

export type SchoolPhase = 'before' | 'lesson' | 'recess' | 'after';
export type RecessGame = 'rope' | 'ball' | 'board';

export interface SchoolSeat {
  id: string;
  room: 'aleph' | 'bet';
  x: number;
  deskZ: number;
  sitX: number;
  sitZ: number;
  yaw: number;
  /** Left empty so the player can sit here without taking a child's chair. */
  forPlayer: boolean;
}

export interface SchoolStudent {
  id: string;
  seat: string;
  recess: RecessGame;
  female: boolean;
}

export interface SchoolTeacher {
  id: string;
  x: number;
  z: number;
  recessX: number;
  recessZ: number;
  female: boolean;
}

const ROOMS = {
  aleph: -12.2,
  bet: -3.8,
} as const;

function buildSeats(): SchoolSeat[] {
  const seats: SchoolSeat[] = [];
  for (const room of ['aleph', 'bet'] as const) {
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const x = ROOMS[room] + (col - 1) * 2.5;
        const deskZ = -9.3 + row * 2.6;
        seats.push({
          id: `${room}-${col}-${row}`,
          room,
          x,
          deskZ,
          sitX: x,
          sitZ: deskZ + 1.15,
          yaw: Math.PI,
          forPlayer: col === 0 && row === 0,
        });
      }
    }
  }
  return seats;
}

export const SCHOOL_SEATS = buildSeats();

export const STUDENTS: SchoolStudent[] = [
  { id: 'noam', seat: 'aleph-1-0', recess: 'rope', female: false },
  { id: 'maya', seat: 'aleph-2-0', recess: 'ball', female: true },
  { id: 'lior', seat: 'aleph-0-1', recess: 'rope', female: false },
  { id: 'shira', seat: 'aleph-1-1', recess: 'ball', female: true },
  { id: 'aviv', seat: 'aleph-2-1', recess: 'rope', female: false },
  { id: 'dani', seat: 'bet-1-0', recess: 'ball', female: false },
  { id: 'eitan', seat: 'bet-2-0', recess: 'rope', female: false },
  { id: 'hila', seat: 'bet-0-1', recess: 'ball', female: true },
  { id: 'yosef', seat: 'bet-1-1', recess: 'board', female: false },
  { id: 'rut', seat: 'bet-2-1', recess: 'board', female: true },
];

export const TEACHERS: SchoolTeacher[] = [
  { id: 'teacher', x: -12.2, z: -11.22, recessX: 5.2, recessZ: 7.6, female: true },
  { id: 'teacher_david', x: -3.8, z: -11.22, recessX: 17.4, recessZ: 7.6, female: false },
];

const FEMALE = new Set<string>([
  ...STUDENTS.filter((student) => student.female).map((student) => student.id),
  ...TEACHERS.filter((teacher) => teacher.female).map((teacher) => teacher.id),
]);

export function schoolPhase(hour: number, minute: number): SchoolPhase {
  const m = hour * 60 + minute;
  if (m < 8 * 60) return 'before';
  if (m >= 14 * 60) return 'after';
  if ((m >= 10 * 60 && m < 10 * 60 + 20) || (m >= 12 * 60 && m < 12 * 60 + 30)) return 'recess';
  return 'lesson';
}

export function routineFor(id: string, hour: number, minute = 0): string {
  const phase = schoolPhase(hour, minute);
  if (STUDENTS.some((student) => student.id === id) || TEACHERS.some((teacher) => teacher.id === id)) {
    return schoolLine(id, phase);
  }
  if (id === 'mom') {
    if (hour < 8) return 'מכינה את הבוקר בבית';
    if (hour < 15) return 'עובדת מהבית';
    if (hour < 21) return 'בבית עם המשפחה';
    return 'נרגעת לפני השינה';
  }
  if (id === 'dad') {
    if (hour < 8) return 'אוכל ארוחת בוקר בבית';
    if (hour < 17) return 'בעבודה בעיר';
    if (hour < 21) return 'בבית, לפעמים במטבח';
    return 'נח לפני השינה';
  }
  if (id === 'brother') {
    if (hour < 8) return 'מתעורר בבית';
    if (hour < 13) return 'בגן';
    if (hour < 19) return 'משחק בבית';
    return 'הולך לישון מוקדם';
  }
  if (id === 'sister') {
    if (hour < 8) return 'מתארגנת לבית הספר';
    if (hour < 15) return 'בחטיבה';
    if (hour < 21) return 'שיעורי בית בבית';
    return 'קוראת לפני השינה';
  }
  if (id === 'shopkeeper') {
    if (hour < 8) return 'פותח את המכולת';
    if (hour < 19) return 'מוכר במכולת';
    return 'סוגר את החנות';
  }
  if (id === 'neighbor') {
    if (hour < 9) return 'שותה קפה בבית';
    if (hour < 17) return 'בגינה';
    return 'בבית הצהוב';
  }
  if (id === 'zookeeper') {
    if (hour < 8) return 'בדרך לגן החיות';
    if (hour < 16) return 'מטפלת בחיות';
    return 'בבית ליד הגן';
  }
  if (hour < 8) return 'מתעורר/ת בבוקר';
  if (hour < 14) return 'בפעילות של היום';
  if (hour < 18) return 'בשכונה או בפארק';
  if (hour < 21) return 'בבית לקראת ערב';
  return 'נרגע/ת לפני שינה';
}

export function schoolSpawns(): Array<{ id: string; position: THREE.Vector3 }> {
  return schoolCast().map((person, index) => {
    const spot = gateSpot(index, 6.2);
    return { id: person.id, position: new THREE.Vector3(spot.x, 0, spot.z) };
  });
}

interface CastMember {
  id: string;
  female: boolean;
}

interface Spot {
  x: number;
  z: number;
  yaw: number;
}

interface Goal extends Spot {
  points: Spot[];
  pose: 'sit' | 'stand' | 'jump' | 'watch';
}

interface SchoolActors {
  actors: Array<{ id: string; mesh: THREE.Object3D }>;
  guide(id: string, x: number, z: number, yaw: number): void;
  holdAt(id: string, x: number, z: number, yaw: number): void;
  playClip(id: string, kind: string, loop: boolean): void;
  setStatus(id: string, line: string | null): void;
  releaseActor(id: string): void;
}

interface SchoolHost {
  add(object: THREE.Object3D): void;
  remove(object: THREE.Object3D): void;
}

const PHASE_NOTE: Record<SchoolPhase, string> = {
  before: 'עוד לא צלצל. כולם מחכים בכניסה, כל אחד במקום שלו.',
  lesson: 'השיעור התחיל. הילדים נכנסים לכיתות ויושבים, והמורים ליד הלוח.',
  recess: 'הפסקה. בחצר: חבל, מסירות בכדור, ומשחק קופסה.',
  after: 'הלימודים נגמרו. כולם יוצאים לחצר.',
};

export class SchoolDayDirector {
  private active = false;
  private paused = false;
  private phase: SchoolPhase | '' = '';
  private time = 0;
  private readonly goals = new Map<string, Goal>();
  private props: THREE.Group | null = null;
  private rope: THREE.Mesh[] = [];
  private ball: THREE.Mesh | null = null;
  private tokens: THREE.Mesh[] = [];
  private boards: Array<{ mesh: THREE.Mesh; canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; texture: THREE.CanvasTexture; drawn: number }> = [];
  private pointers: THREE.Mesh[] = [];
  private chalk: THREE.Mesh[] = [];

  constructor(
    private readonly npcs: SchoolActors,
    private readonly host: SchoolHost,
  ) {}

  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    if (this.props) this.props.visible = !paused;
    if (!paused) this.phase = '';
  }

  stop(): void {
    if (!this.active && !this.props) return;
    this.active = false;
    this.phase = '';
    this.goals.clear();
    for (const person of schoolCast()) this.npcs.releaseActor(person.id);
    this.clearProps();
  }

  /** Returns a caption when the bell changes, otherwise null. */
  update(dt: number, clock: GameClock): string | null {
    if (this.paused) return null;
    this.active = true;
    this.time += dt;
    const phase = schoolPhase(clock.hour, clock.minuteOfHour);
    let note: string | null = null;
    if (phase !== this.phase) {
      this.phase = phase;
      this.assign(phase);
      this.buildProps(phase);
      note = PHASE_NOTE[phase];
    }
    const beat = Math.floor(this.time / 3.5) % 2;
    for (const person of schoolCast()) this.step(person.id, dt, phase, beat);
    if (phase === 'lesson') this.animateLesson(beat);
    if (phase === 'recess') this.animateRecess();
    return note;
  }

  private step(id: string, dt: number, phase: SchoolPhase, beat: number): void {
    const goal = this.goals.get(id);
    if (!goal) return;
    const actor = this.npcs.actors.find((item) => item.id === id);
    if (!actor) return;
    this.npcs.setStatus(id, schoolLine(id, phase));
    const next = goal.points[0];
    if (next) {
      const dx = next.x - actor.mesh.position.x;
      const dz = next.z - actor.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      const last = goal.points.length === 1;
      if (dist < (last ? 0.55 : 0.18)) {
        goal.points.shift();
        return;
      }
      const step = Math.min(dist, 4.2 * dt);
      const yaw = Math.atan2(dx, dz);
      this.npcs.guide(id, actor.mesh.position.x + (dx / dist) * step, actor.mesh.position.z + (dz / dist) * step, yaw);
      this.npcs.playClip(id, 'walk', true);
      return;
    }
    let yaw = goal.yaw;
    if (phase === 'lesson' && TEACHERS.some((teacher) => teacher.id === id) && beat === 1) {
      yaw = Math.sin(this.time * 1.7) * 0.45;
    }
    if (phase === 'recess') {
      const student = STUDENTS.find((item) => item.id === id);
      if (student?.recess === 'ball') {
        const ball = ballPoint(this.time);
        yaw = Math.atan2(ball.x - goal.x, ball.z - goal.z);
      } else if (student?.recess === 'rope' && recessIndex(student) !== 2) {
        yaw = goal.yaw + Math.sin(this.time * 2.5) * 0.18;
      }
    }
    this.npcs.holdAt(id, goal.x, goal.z, yaw);
    if (phase === 'recess' && goal.pose === 'jump') {
      actor.mesh.position.y = Math.max(0, Math.cos(this.time * 2.5)) * 0.62;
    }
    if (phase === 'lesson' && TEACHERS.some((teacher) => teacher.id === id)) {
      this.npcs.playClip(id, beat === 0 ? 'clean' : 'talk', true);
      return;
    }
    if (goal.pose === 'sit') this.npcs.playClip(id, 'sit', false);
    else if (goal.pose === 'jump') this.jumpRope(id);
    else if (goal.pose === 'watch') this.npcs.playClip(id, 'talk', true);
    else this.npcs.playClip(id, 'idle', true);
  }

  private jumpRope(id: string): void {
    const down = Math.cos(this.time * 2.5) > 0.55;
    this.npcs.playClip(id, down ? 'jump' : 'idle', !down);
  }

  private assign(phase: SchoolPhase): void {
    positions.clear();
    for (const actor of this.npcs.actors) {
      positions.set(actor.id, { x: actor.mesh.position.x, z: actor.mesh.position.z });
    }
    this.goals.clear();
    if (phase === 'lesson') {
      for (const student of STUDENTS) {
        const seat = seatById(student.seat);
        this.goals.set(student.id, {
          ...seatPoint(seat),
          points: routeTo(student.id, seat.sitX, seat.sitZ),
          pose: 'sit',
        });
      }
      for (const teacher of TEACHERS) {
        this.goals.set(teacher.id, {
          x: teacher.x,
          z: teacher.z,
          yaw: Math.PI,
          points: routeTo(teacher.id, teacher.x, teacher.z),
          pose: 'stand',
        });
      }
      return;
    }
    if (phase === 'recess') {
      const counts: Record<RecessGame, number> = { rope: 0, ball: 0, board: 0 };
      for (const student of STUDENTS) {
        const index = counts[student.recess];
        counts[student.recess] += 1;
        const spot = recessSpot(student.recess, index);
        this.goals.set(student.id, {
          ...spot,
          points: routeTo(student.id, spot.x, spot.z),
          pose: student.recess === 'board' ? 'sit' : student.recess === 'rope' && index === 2 ? 'jump' : 'watch',
        });
      }
      for (const teacher of TEACHERS) {
        this.goals.set(teacher.id, {
          x: teacher.recessX,
          z: teacher.recessZ,
          yaw: Math.atan2(11 - teacher.recessX, 4.2 - teacher.recessZ),
          points: routeTo(teacher.id, teacher.recessX, teacher.recessZ),
          pose: 'watch',
        });
      }
      return;
    }
    const z = phase === 'before' ? 6.2 : 9.2;
    schoolCast().forEach((person, index) => {
      const spot = gateSpot(index, z);
      this.goals.set(person.id, {
        ...spot,
        points: routeTo(person.id, spot.x, spot.z),
        pose: 'stand',
      });
    });
  }

  private buildProps(phase: SchoolPhase): void {
    this.clearProps();
    this.props = new THREE.Group();
    this.props.name = 'school-day';
    this.props.userData.noCollide = true;
    if (phase === 'lesson') this.buildBoards();
    if (phase === 'recess') this.buildRecess();
    this.host.add(this.props);
  }

  private buildBoards(): void {
    for (const teacher of TEACHERS) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 160;
      const context = canvas.getContext('2d');
      if (!context) continue;
      context.fillStyle = '#f7f4ea';
      context.fillRect(0, 0, 256, 160);
      const texture = new THREE.CanvasTexture(canvas);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2.05, 1.4),
        new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }),
      );
      mesh.position.set(teacher.x, 1.9, -11.72);
      mesh.userData.noCollide = true;
      this.props?.add(mesh);
      this.boards.push({ mesh, canvas, context, texture, drawn: 0 });
      const pointer = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.55, 0.06),
        new THREE.MeshStandardMaterial({ color: 0xc4553a }),
      );
      pointer.userData.noCollide = true;
      pointer.visible = false;
      this.props?.add(pointer);
      this.pointers.push(pointer);
      const chalk = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.08, 0.22),
        new THREE.MeshStandardMaterial({ color: 0xf7f4ea }),
      );
      chalk.userData.noCollide = true;
      chalk.visible = false;
      this.props?.add(chalk);
      this.chalk.push(chalk);
    }
  }

  private buildRecess(): void {
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xf0c43a });
    for (let i = 0; i < 18; i++) {
      const bit = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), ropeMat);
      bit.userData.noCollide = true;
      this.rope.push(bit);
      this.props?.add(bit);
    }
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xe04b3a }),
    );
    this.ball.userData.noCollide = true;
    this.props?.add(this.ball);
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.5, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x8a5a32 }),
    );
    table.position.set(11.25, 0.28, 8.8);
    table.userData.noCollide = true;
    this.props?.add(table);
    for (let i = 0; i < 4; i++) {
      const token = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.04, 12),
        new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0x2a6fdb : 0xf0c43a }),
      );
      token.userData.noCollide = true;
      this.tokens.push(token);
      this.props?.add(token);
    }
  }

  private animateLesson(beat: number): void {
    const stroke = Math.floor(this.time / 3.5);
    for (const board of this.boards) {
      if (board.drawn === stroke || beat !== 0) continue;
      board.drawn = stroke;
      const ctx = board.context;
      ctx.strokeStyle = stroke % 2 === 0 ? '#163d28' : '#1a2748';
      ctx.lineWidth = 14;
      ctx.beginPath();
      const y = 28 + (stroke % 5) * 24;
      ctx.moveTo(28, y);
      ctx.lineTo(70 + (stroke % 3) * 40, y + 8);
      ctx.lineTo(210, y - 4);
      ctx.stroke();
      board.texture.needsUpdate = true;
    }
    this.chalk.forEach((stick, index) => {
      const teacher = TEACHERS[index];
      if (!teacher) return;
      stick.visible = beat === 0;
      const u = (this.time % 3.5) / 3.5;
      stick.position.set(teacher.x - 0.55 + u * 1.1, 1.42 + Math.sin(u * Math.PI) * 0.28, -11.55);
      stick.rotation.z = -0.35;
    });
    this.pointers.forEach((pointer, index) => {
      const teacher = TEACHERS[index];
      if (!teacher) return;
      pointer.visible = beat === 1;
      const sway = Math.sin(this.time * 1.7);
      pointer.position.set(teacher.x + 0.35, 1.25 + Math.abs(sway) * 0.35, teacher.z + 0.45);
      pointer.rotation.z = -0.7 + sway * 0.5;
    });
  }

  private animateRecess(): void {
    const spin = this.time * 2.5;
    this.rope.forEach((bit, index) => {
      const t = (index + 1) / (this.rope.length + 1);
      const arc = Math.sin(t * Math.PI);
      bit.position.set(5.8 + t * 3.8, 0.35 + (1 - Math.cos(spin)) * 1.05 * arc, 2.5 + Math.sin(spin) * 0.95 * arc);
    });
    if (this.ball) {
      const ball = ballPoint(this.time);
      this.ball.position.set(ball.x, ball.y, ball.z);
    }
    this.tokens.forEach((token, index) => {
      const shift = Math.floor(this.time / 1.4) % 2;
      const col = (index + shift) % 2;
      const row = Math.floor(index / 2);
      token.position.set(11.05 + col * 0.38, 0.56, 8.62 + row * 0.32);
    });
  }

  private clearProps(): void {
    if (!this.props) return;
    this.host.remove(this.props);
    this.props = null;
    this.rope = [];
    this.ball = null;
    this.tokens = [];
    this.boards = [];
    this.pointers = [];
    this.chalk = [];
  }
}

function schoolCast(): CastMember[] {
  return [
    ...STUDENTS.map((student) => ({ id: student.id, female: student.female })),
    ...TEACHERS.map((teacher) => ({ id: teacher.id, female: teacher.female })),
  ];
}

function schoolLine(id: string, phase: SchoolPhase): string {
  const female = FEMALE.has(id);
  const teacher = TEACHERS.find((item) => item.id === id);
  if (teacher) {
    if (phase === 'lesson') return female ? 'כותבת על הלוח ומסבירה לכיתה' : 'כותב על הלוח ומסביר לכיתה';
    if (phase === 'recess') return female ? 'משגיחה על המשחקים בחצר' : 'משגיח על המשחקים בחצר';
    if (phase === 'before') return female ? 'מכינה את הכיתה' : 'מכין את הכיתה';
    return female ? 'מסיימת את היום בבית הספר' : 'מסיים את היום בבית הספר';
  }
  const student = STUDENTS.find((item) => item.id === id);
  if (!student) return 'בבית הספר';
  if (phase === 'lesson') return female ? 'יושבת בשיעור על הכיסא השמור' : 'יושב בשיעור על הכיסא השמור';
  if (phase === 'recess') {
    if (student.recess === 'rope') {
      const index = recessIndex(student);
      if (index === 2) return female ? 'קופצת בחבל' : 'קופץ בחבל';
      if (index === 3) return female ? 'סופרת את הקפיצות' : 'סופר את הקפיצות';
      return female ? 'מסובבת את החבל' : 'מסובב את החבל';
    }
    if (student.recess === 'ball') return female ? 'מוסרת כדור לחברים' : 'מוסר כדור לחברים';
    return female ? 'משחקת משחק קופסה' : 'משחק משחק קופסה';
  }
  if (phase === 'before') return female ? 'מחכה לצלצול בכניסה' : 'מחכה לצלצול בכניסה';
  return female ? 'סיימה את הלימודים' : 'סיים את הלימודים';
}

function seatById(id: string): SchoolSeat {
  const seat = SCHOOL_SEATS.find((item) => item.id === id);
  if (!seat) throw new Error(`כיסא חסר: ${id}`);
  return seat;
}

function seatPoint(seat: SchoolSeat): Spot {
  return { x: seat.sitX, z: seat.sitZ, yaw: seat.yaw };
}

const positions = new Map<string, { x: number; z: number }>();

function routeTo(id: string, x: number, z: number): Spot[] {
  const from = positions.get(id) ?? gateSpot(indexOf(id), 6.2);
  const points: Spot[] = [];
  if (Math.hypot(from.x - x, from.z - z) < 0.35) return points;
  const entering = z < -4 && from.z > -1;
  const leaving = z > -1 && from.z < -1;
  if (entering || leaving) {
    const insideX = entering ? x : from.x;
    const wallX = insideX < -8 ? -16.35 : 0.35;
    const center = insideX < -8 ? -12.2 : -3.8;
    const aisle = (entering ? x : from.x) < center ? center - 1.25 : center + 1.25;
    if (entering) {
      points.push({ x: wallX, z: 0.3, yaw: Math.PI });
      points.push({ x: wallX, z: -4.2, yaw: Math.PI });
      points.push({ x: aisle, z: -4.2, yaw: Math.PI });
      points.push({ x: aisle, z, yaw: Math.PI });
    } else {
      points.push({ x: aisle, z: from.z, yaw: 0 });
      points.push({ x: aisle, z: -4.2, yaw: 0 });
      points.push({ x: wallX, z: -4.2, yaw: 0 });
      points.push({ x: wallX, z: 0.45, yaw: 0 });
    }
  }
  points.push({ x, z, yaw: Math.atan2(x - from.x, z - from.z) });
  return points;
}

function indexOf(id: string): number {
  return schoolCast().findIndex((person) => person.id === id);
}

function gateSpot(index: number, z: number): Spot {
  return { x: 4.2 + index * 1.45, z, yaw: Math.PI };
}

function recessIndex(student: SchoolStudent): number {
  return STUDENTS.filter((item) => item.recess === student.recess).findIndex((item) => item.id === student.id);
}

function ballPoint(time: number): { x: number; y: number; z: number } {
  const pass = time / 1.6;
  const from = Math.floor(pass) % 4;
  const to = (from + 1) % 4;
  const u = pass - Math.floor(pass);
  const a = recessSpot('ball', from);
  const b = recessSpot('ball', to);
  return {
    x: a.x + (b.x - a.x) * u,
    y: 0.85 + Math.sin(u * Math.PI) * 1.15,
    z: a.z + (b.z - a.z) * u,
  };
}

function recessSpot(kind: RecessGame, index: number): Spot {
  if (kind === 'rope') {
    return [
      { x: 5.8, z: 2.5, yaw: Math.PI / 2 },
      { x: 9.6, z: 2.5, yaw: -Math.PI / 2 },
      { x: 7.7, z: 2.5, yaw: 0 },
      { x: 7.7, z: 4.15, yaw: Math.PI },
    ][index];
  }
  if (kind === 'ball') {
    return [
      { x: 13.0, z: 2.2, yaw: 0.4 },
      { x: 15.7, z: 2.2, yaw: 2.4 },
      { x: 15.7, z: 4.9, yaw: -2.4 },
      { x: 13.0, z: 4.9, yaw: -0.6 },
    ][index];
  }
  return [
    { x: 10.3, z: 8.8, yaw: Math.PI / 2 },
    { x: 12.2, z: 8.8, yaw: -Math.PI / 2 },
  ][index];
}

assertSchoolPlan();

function assertSchoolPlan(): void {
  const seen = new Set<string>();
  const occupied: Array<{ id: string; x: number; z: number }> = [];
  for (const student of STUDENTS) {
    if (seen.has(student.seat)) throw new Error(`שני ילדים על כיסא ${student.seat}`);
    seen.add(student.seat);
    const seat = seatById(student.seat);
    if (seat.forPlayer) throw new Error(`הכיסא ${student.seat} שמור לשחקן`);
    occupied.push({ id: student.id, x: seat.sitX, z: seat.sitZ });
  }
  const playerSeats = SCHOOL_SEATS.filter((seat) => seat.forPlayer);
  if (playerSeats.length !== 2) throw new Error('צריך שני כיסאות פנויים לשחקן');
  checkSpacing(occupied, 1.2);
  const recess: Array<{ id: string; x: number; z: number }> = [];
  const counts: Record<RecessGame, number> = { rope: 0, ball: 0, board: 0 };
  for (const student of STUDENTS) {
    const spot = recessSpot(student.recess, counts[student.recess]);
    counts[student.recess] += 1;
    recess.push({ id: student.id, x: spot.x, z: spot.z });
  }
  checkSpacing(recess, 1.2);
  checkSpacing(
    TEACHERS.map((teacher) => ({ id: teacher.id, x: teacher.x, z: teacher.z })),
    1.2,
  );
}

function checkSpacing(spots: Array<{ id: string; x: number; z: number }>, min: number): void {
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      const dist = Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z);
      if (dist < min) throw new Error(`${spots[i].id} ו${spots[j].id} קרובים מדי (${dist.toFixed(2)})`);
    }
  }
}
