import * as THREE from 'three';
import type { StrengthMap } from '../core/types';
import type { Beat, FollowUp, SceneScript } from './catalog';

export interface StageHost {
  caption(text: string, ms: number): void;
  choices(title: string, note: string, options: Array<{ id: string; label: string; shot?: string }>, cancel: string): void;
  clearChoices(): void;
  playerAt(): { x: number; z: number; yaw: number };
  placePlayer(x: number, z: number): void;
  emote(kind: string): void;
  hold(id: string, x: number, z: number, yaw: number, clip: string): void;
  release(ids: string[]): void;
  add(object: THREE.Object3D): void;
  remove(object: THREE.Object3D): void;
}

/**
 * Plays a scene as a row of visible beats: a caption, a pose, and props
 * that stay on the floor long enough to read. When the beats end, the
 * follow-up choices appear over the same shot.
 */
export class PerformanceDirector {
  active = false;
  private waiting = false;
  private movePlayer = false;
  private gather = false;
  private script: SceneScript | null = null;
  private beats: Beat[] = [];
  private index = -1;
  private elapsed = 0;
  private props: THREE.Object3D[] = [];
  private held: string[] = [];
  private anchor = new THREE.Vector3();
  private yaw = 0;
  private follow: FollowUp | null = null;
  onFinished?: (awards: Partial<StrengthMap> | undefined, title: string) => void;

  constructor(private host: StageHost) {}

  start(script: SceneScript, movePlayer: boolean, gather: boolean): void {
    this.stop(false);
    this.script = script;
    this.movePlayer = movePlayer;
    this.gather = gather;
    this.active = true;
    this.waiting = false;
    this.follow = null;
    const here = this.host.playerAt();
    this.anchor.set(here.x, 0, here.z);
    this.yaw = here.yaw;
    this.host.caption(script.intro, 3200);
    this.play(script.beats);
  }

  choose(id: string): void {
    if (!this.waiting || !this.script) return;
    this.host.clearChoices();
    this.waiting = false;
    if (id === 'cancel') {
      this.finish(undefined);
      return;
    }
    const next = this.script.follows.find((item) => item.id === id);
    if (!next) {
      this.finish(undefined);
      return;
    }
    this.follow = next;
    this.play(next.beats);
  }

  update(dt: number): void {
    if (!this.active || this.waiting) return;
    this.elapsed += dt;
    const beat = this.beats[this.index];
    if (!beat) return;
    for (const prop of this.props) {
      prop.position.y = 0.02 + Math.sin(this.elapsed * 3) * 0.04;
      prop.rotation.y += dt * 0.4;
    }
    if (this.elapsed < beat.t) return;
    if (this.index + 1 < this.beats.length) {
      this.show(this.index + 1);
      return;
    }
    this.enterChoices();
  }

  stop(notify = false): void {
    this.clearProps();
    if (this.held.length) this.host.release(this.held);
    this.held = [];
    this.host.clearChoices();
    const was = this.active;
    this.active = false;
    this.waiting = false;
    this.beats = [];
    this.script = null;
    if (notify && was) this.onFinished?.(undefined, '');
  }

  private play(beats: Beat[]): void {
    this.beats = beats;
    this.show(0);
  }

  private show(index: number): void {
    this.index = index;
    this.elapsed = 0;
    const beat = this.beats[index];
    if (!beat) {
      this.enterChoices();
      return;
    }
    const here = this.host.playerAt();
    if (!this.movePlayer) {
      this.anchor.set(here.x, 0, here.z);
      this.yaw = here.yaw;
    }
    const spot = this.world(beat.at?.[0] ?? 0, beat.at?.[1] ?? 0);
    if (this.movePlayer && beat.at) {
      this.host.placePlayer(spot.x, spot.z);
      this.anchor.set(spot.x, 0, spot.z);
    }
    if (beat.emote) this.host.emote(beat.emote);
    this.placeCast(beat);
    this.placeProps(beat.props ?? []);
    this.host.caption(beat.say, Math.round(beat.t * 1000) + 600);
  }

  private enterChoices(): void {
    this.clearProps();
    const script = this.script;
    if (!script) return;
    if (this.follow || script.follows.length === 0) {
      this.finish(this.follow?.awards);
      return;
    }
    this.waiting = true;
    this.host.choices(
      script.title,
      'הסצנה נשארת פתוחה. בחרו איך היא ממשיכה.',
      script.follows.map((item) => ({ id: item.id, label: item.label, shot: `${script.id}/${item.id}` })),
      'לסיים כאן',
    );
  }

  private finish(awards: Partial<StrengthMap> | undefined): void {
    const title = this.script?.title ?? '';
    this.clearProps();
    if (this.held.length) this.host.release(this.held);
    this.held = [];
    this.active = false;
    this.waiting = false;
    this.script = null;
    this.follow = null;
    this.onFinished?.(awards, title);
  }

  private placeCast(beat: Beat): void {
    if (!this.gather || !beat.cast) return;
    const next: string[] = [];
    for (const [id, right, forward] of beat.cast) {
      const at = this.world(right, forward);
      const yaw = Math.atan2(this.anchor.x - at.x, this.anchor.z - at.z);
      this.host.hold(id, at.x, at.z, yaw, beat.emote ?? 'talk');
      next.push(id);
    }
    for (const id of this.held) {
      if (!next.includes(id)) this.host.release([id]);
    }
    this.held = next;
  }

  private placeProps(kinds: string[]): void {
    this.clearProps();
    kinds.forEach((kind, index) => {
      const column = index - (kinds.length - 1) / 2;
      const at = this.world(column * 0.55, 1.15);
      const prop = makeProp(kind);
      prop.position.set(at.x, 0.02, at.z);
      prop.traverse((obj) => {
        obj.userData.noCollide = true;
      });
      this.host.add(prop);
      this.props.push(prop);
    });
  }

  private clearProps(): void {
    for (const prop of this.props) this.host.remove(prop);
    this.props = [];
  }

  private world(rightAmount: number, forwardAmount: number): THREE.Vector3 {
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    return new THREE.Vector3(
      this.anchor.x + rightX * rightAmount + forwardX * forwardAmount,
      0,
      this.anchor.z + rightZ * rightAmount + forwardZ * forwardAmount,
    );
  }
}

function mat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0 });
}

function makeProp(kind: string): THREE.Group {
  const group = new THREE.Group();
  group.name = `scene-${kind}`;
  const add = (mesh: THREE.Mesh) => {
    mesh.castShadow = true;
    group.add(mesh);
  };
  if (kind === 'ball') {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), mat(0xe24b3a)));
    group.children[0].position.y = 0.22;
  } else if (kind === 'rope') {
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.035, 8, 20), mat(0xd8a15a));
    rope.rotation.x = Math.PI / 2;
    rope.position.y = 0.05;
    add(rope);
  } else if (kind === 'cones') {
    for (const x of [-0.35, 0.35]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 10), mat(0xf08a24));
      cone.position.set(x, 0.21, 0);
      add(cone);
    }
  } else if (kind === 'crown') {
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.16, 6), mat(0xe2b143));
    crown.position.y = 0.16;
    add(crown);
  } else if (kind === 'flag') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 8), mat(0x6b4228));
    pole.position.y = 0.35;
    add(pole);
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.02), mat(0xc4473a));
    cloth.position.set(0.16, 0.58, 0);
    add(cloth);
  } else if (kind === 'dust') {
    for (let i = 0; i < 5; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(0xc8c2b4));
      puff.position.set((i - 2) * 0.12, 0.05, (i % 2) * 0.08);
      add(puff);
    }
  } else if (kind === 'marble') {
    const marble = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), mat(0x3d7a9a));
    marble.position.y = 0.07;
    add(marble);
  } else if (kind === 'plate') {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.04, 16), mat(0xf4f1ea));
    plate.position.y = 0.04;
    add(plate);
  } else if (kind === 'book' || kind === 'page') {
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.24), mat(kind === 'book' ? 0x2c4460 : 0xf7f4ef));
    book.position.y = 0.04;
    add(book);
  } else if (kind === 'bottle') {
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.28, 10), mat(0x7eb6d6));
    bottle.position.y = 0.16;
    add(bottle);
  } else if (kind === 'broom') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 8), mat(0x8a5a32));
    handle.position.y = 0.45;
    handle.rotation.z = 0.25;
    add(handle);
  } else if (kind === 'cloth') {
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.2), mat(0x5c8a7a));
    cloth.position.y = 0.03;
    add(cloth);
  } else if (kind === 'steam' || kind === 'pot') {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.16, 12), mat(0x3a3f4a));
    pot.position.y = 0.1;
    add(pot);
  } else if (kind === 'blocks') {
    const colors = [0xc4473a, 0xe2b143, 0x3d7a9a];
    colors.forEach((color, i) => {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.22), mat(color));
      block.position.y = 0.1 + i * 0.16;
      add(block);
    });
  } else if (kind === 'road' || kind === 'car') {
    const tile = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.28), mat(0x2a2a2a));
    tile.position.y = 0.02;
    add(tile);
    if (kind === 'car') {
      const car = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.12), mat(0x1d4e89));
      car.position.y = 0.08;
      add(car);
    }
  } else if (kind === 'plant' || kind === 'can') {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.14, 10), mat(0x6e4b32));
    pot.position.y = 0.08;
    add(pot);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(0x3e7a45));
    leaf.position.y = 0.24;
    add(leaf);
  } else if (kind === 'shirt') {
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.24), mat(0xd7e4f2));
    shirt.position.y = 0.05;
    add(shirt);
  } else if (kind === 'notes') {
    for (let i = 0; i < 3; i++) {
      const note = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(0xe2b143));
      note.position.set((i - 1) * 0.16, 0.35 + i * 0.08, 0);
      add(note);
    }
  } else if (kind === 'handset') {
    const phone = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.04), mat(0x222222));
    phone.position.y = 0.12;
    add(phone);
  } else if (kind === 'pillow') {
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.24), mat(0xf2d6de));
    pillow.position.y = 0.08;
    add(pillow);
  } else if (kind === 'hide') {
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), mat(0x2f6b3a));
    bush.position.y = 0.2;
    add(bush);
  } else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), mat(0xc2b48a));
    box.position.y = 0.1;
    add(box);
  }
  return group;
}
