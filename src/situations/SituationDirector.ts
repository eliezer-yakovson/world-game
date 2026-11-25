import * as THREE from 'three';
import type { SituationChoice, SituationDef } from '../core/types';
import type { PlayerController } from '../characters/PlayerController';
import type { NpcManager } from '../characters/NpcManager';
import type { UIManager } from '../ui/UIManager';
import { reactionKind } from '../characters/emotes';
import { cloneCached } from '../world/AssetLoader';
import { fitClone } from '../world/PropLibrary';

interface SceneProp {
  id: string;
  kind: 'model' | 'puddle' | 'ball';
  model?: string;
  folder?: string;
  height?: number;
  offset: [number, number];
  y?: number;
}

interface SceneActor {
  id: string;
  offset: [number, number];
  clip?: string;
}

interface SceneBeat {
  text: string;
  ms: number;
  player?: string;
  npcs?: SceneActor[];
  spawn?: SceneProp[];
  remove?: string[];
}

const CAST: Record<string, SceneActor[]> = {
  spilled_drink: [
    { id: 'mom', offset: [1.25, 1.15] },
    { id: 'brother', offset: [-1.2, 1.25] },
  ],
  class_question: [
    { id: 'teacher', offset: [0.2, 1.7] },
    { id: 'noam', offset: [-1.3, 1.1] },
  ],
  park_argument: [
    { id: 'dani', offset: [1.15, 1.2] },
    { id: 'noam', offset: [-1.15, 1.2] },
  ],
  tidy_request: [
    { id: 'dad', offset: [1.2, 1.3] },
    { id: 'brother', offset: [-1.15, 1.15] },
  ],
  rainy_day: [
    { id: 'mom', offset: [1.3, 1.2] },
    { id: 'brother', offset: [-1.1, 1.3] },
  ],
  guest_mess: [
    { id: 'noam', offset: [1.2, 1.15] },
    { id: 'brother', offset: [-1.2, 1.2] },
  ],
  crosswalk: [
    { id: 'noam', offset: [1.6, 2.2] },
    { id: 'maya', offset: [-1.4, 2.3] },
  ],
  lost_cat: [{ id: 'neighbor', offset: [1.3, 1.4] }],
  bike_theft: [{ id: 'dani', offset: [1.1, 1.15] }],
};

const PROPS: Record<string, SceneProp[]> = {
  spilled_drink: [
    { id: 'cup', kind: 'model', model: 'cup', folder: 'food', height: 0.16, offset: [0.35, 0.65] },
    { id: 'puddle', kind: 'puddle', offset: [0.5, 0.9] },
  ],
  class_question: [{ id: 'books', kind: 'model', model: 'books', folder: 'furniture', height: 0.16, offset: [0.4, 0.7] }],
  park_argument: [{ id: 'ball', kind: 'ball', offset: [0, 1.15] }],
  broken_item: [
    { id: 'bag', kind: 'model', model: 'carton', folder: 'food', height: 0.28, offset: [0.3, 0.8] },
    { id: 'piece', kind: 'model', model: 'apple-half', folder: 'food', height: 0.1, offset: [0.55, 1.05] },
  ],
  tidy_request: [
    { id: 'toy1', kind: 'model', model: 'bear', folder: 'furniture', height: 0.4, offset: [-0.7, 0.9] },
    { id: 'toy2', kind: 'model', model: 'present-a-cube', folder: 'holiday', height: 0.26, offset: [0.55, 0.85] },
    { id: 'toy3', kind: 'model', model: 'pillowBlue', folder: 'furniture', height: 0.16, offset: [0.1, 1.25] },
  ],
  guest_mess: [
    { id: 'toy1', kind: 'model', model: 'bear', folder: 'furniture', height: 0.4, offset: [-0.6, 1] },
    { id: 'toy2', kind: 'model', model: 'present-b-rectangle', folder: 'holiday', height: 0.24, offset: [0.7, 0.9] },
  ],
  lost_cat: [{ id: 'cat', kind: 'model', model: 'animal-cat', folder: 'pets', height: 0.4, offset: [-0.2, 1.5] }],
};

export class SituationDirector {
  private readonly group = new THREE.Group();
  private readonly spawned = new Map<string, THREE.Object3D>();
  private token = 0;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private player: PlayerController,
    private npcs: NpcManager,
    private ui: UIManager,
  ) {
    this.group.name = 'situation-scene';
    this.scene.add(this.group);
  }

  clear(): void {
    this.token += 1;
    for (const obj of this.spawned.values()) this.group.remove(obj);
    this.spawned.clear();
    this.player.playIdle();
  }

  async playOpening(def: SituationDef): Promise<void> {
    const cast = CAST[def.id] ?? [];
    const beats: SceneBeat[] = [
      {
        text: def.description,
        ms: 2800,
        player: 'idle',
        npcs: cast.map((actor) => ({ ...actor, clip: 'talk' })),
        spawn: PROPS[def.id] ?? [],
      },
      {
        text: def.emotion,
        ms: 2200,
        player: def.tense ? 'sad' : 'talk',
        npcs: cast.map((actor) => ({ ...actor, clip: 'idle' })),
      },
    ];
    await this.play(beats);
  }

  async playChoice(def: SituationDef, choice: SituationChoice): Promise<void> {
    const cast = CAST[def.id] ?? [];
    const reaction = reactionKind(choice.followUpText);
    const beats: SceneBeat[] = [
      {
        text: choice.label,
        ms: 2400,
        player: choice.animation ?? 'talk',
        npcs: cast.map((actor) => ({ ...actor, clip: 'idle' })),
        ...this.choiceProps(def.id, choice.id),
      },
      {
        text: choice.followUpText,
        ms: 2800,
        player: 'idle',
        npcs: cast.map((actor) => ({
          ...actor,
          clip: reaction,
          offset: [actor.offset[0] * 0.82, actor.offset[1] * 0.82] as [number, number],
        })),
      },
    ];
    await this.play(beats);
  }

  private choiceProps(situationId: string, choiceId: string): Pick<SceneBeat, 'remove' | 'spawn'> {
    if (situationId === 'spilled_drink' && (choiceId === 'clean' || choiceId === 'ask_help')) {
      return { remove: ['puddle', 'cup'] };
    }
    if (situationId === 'tidy_request' && (choiceId === 'tidy' || choiceId === 'game_tidy')) {
      return { remove: ['toy1', 'toy2', 'toy3'] };
    }
    if (situationId === 'guest_mess' && (choiceId === 'invite_tidy' || choiceId === 'zones')) {
      return { remove: ['toy1', 'toy2'] };
    }
    if (situationId === 'lost_cat' && choiceId === 'grab') {
      return {
        remove: ['cat'],
        spawn: [{ id: 'cat', kind: 'model', model: 'animal-cat', folder: 'pets', height: 0.4, offset: [-1.8, 2.4] }],
      };
    }
    if (situationId === 'lost_cat' && choiceId === 'calm') {
      return {
        remove: ['cat'],
        spawn: [{ id: 'cat', kind: 'model', model: 'animal-cat', folder: 'pets', height: 0.4, offset: [0.35, 0.85] }],
      };
    }
    if (situationId === 'broken_item' && choiceId === 'kick') {
      return {
        spawn: [{ id: 'piece2', kind: 'model', model: 'apple-half', folder: 'food', height: 0.1, offset: [1.1, 1.3] }],
      };
    }
    if (situationId === 'broken_item' && choiceId === 'breathe_return') {
      return { remove: ['bag', 'piece'] };
    }
    if (situationId === 'park_argument' && choiceId === 'walk_away') {
      return { remove: ['ball'] };
    }
    return {};
  }

  private async play(beats: SceneBeat[]): Promise<void> {
    const token = this.token;
    for (const beat of beats) {
      if (token !== this.token) return;
      this.frame();
      for (const id of beat.remove ?? []) this.removeProp(id);
      for (const prop of beat.spawn ?? []) this.spawnProp(prop);
      if (beat.player) this.player.playEmote(beat.player);
      const focus = beat.npcs?.[0];
      if (focus) {
        const point = this.offset(focus.offset);
        this.player.face(point.x, point.z);
      }
      for (const actor of beat.npcs ?? []) {
        const point = this.offset(actor.offset);
        this.npcs.place(actor.id, point.x, point.z, this.player.position);
        if (actor.clip) this.npcs.playEmote(actor.id, actor.clip);
      }
      this.ui.showCaption(beat.text, beat.ms + 600);
      await this.sleep(beat.ms, token);
    }
  }

  private offset(delta: [number, number]): THREE.Vector3 {
    return new THREE.Vector3(this.player.position.x + delta[0], 0, this.player.position.z + delta[1]);
  }

  private frame(): void {
    const p = this.player.position;
    this.camera.position.set(p.x + 2.4, 2.7, p.z + 4.1);
    this.camera.lookAt(p.x, 1.15, p.z);
  }

  private spawnProp(prop: SceneProp): void {
    this.removeProp(prop.id);
    const point = this.offset(prop.offset);
    let obj: THREE.Object3D | null = null;
    if (prop.kind === 'model' && prop.model && prop.folder) {
      const src = cloneCached(`/assets/models/props/${prop.folder}/${prop.model}.glb`);
      if (src) obj = fitClone(src, { fit: 'height', value: prop.height ?? 0.3 });
    }
    if (!obj && prop.kind === 'puddle') {
      const puddle = new THREE.Mesh(
        new THREE.CircleGeometry(0.42, 18),
        new THREE.MeshStandardMaterial({ color: 0x6d4c32, roughness: 0.4 }),
      );
      puddle.rotation.x = -Math.PI / 2;
      puddle.position.y = 0.03;
      obj = puddle;
    }
    if (!obj && (prop.kind === 'ball' || prop.kind === 'model')) {
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(prop.kind === 'ball' ? 0.18 : 0.12, 12, 10),
        new THREE.MeshStandardMaterial({ color: prop.kind === 'ball' ? 0xe24b4b : 0xd4a017 }),
      );
      ball.position.y = prop.kind === 'ball' ? 0.18 : 0.12;
      obj = ball;
    }
    if (!obj) return;
    obj.position.x += point.x;
    obj.position.z += point.z;
    if (prop.y) obj.position.y += prop.y;
    obj.traverse((child) => {
      child.userData.noCollide = true;
    });
    obj.userData.noCollide = true;
    this.group.add(obj);
    this.spawned.set(prop.id, obj);
  }

  private removeProp(id: string): void {
    const obj = this.spawned.get(id);
    if (!obj) return;
    this.group.remove(obj);
    this.spawned.delete(id);
  }

  private sleep(ms: number, token: number): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      const tick = () => {
        if (token !== this.token || performance.now() - start >= ms) resolve();
        else window.setTimeout(tick, 40);
      };
      tick();
    });
  }
}
