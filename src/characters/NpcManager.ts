import * as THREE from 'three';
import * as YUKA from 'yuka';
import type { NpcProfile } from '../core/types';
import type { GameClock } from '../core/GameClock';
import type { MemoryStore } from '../core/MemoryStore';
import { bus } from '../core/EventBus';
import { takeCharacterModel } from '../world/AssetLoader';
import { pickClip } from './emotes';

export interface NpcActor {
  id: string;
  profile: NpcProfile;
  mesh: THREE.Group;
  vehicle: YUKA.Vehicle;
  path: YUKA.Path;
  diaryQueue: string[];
  mixer?: THREE.AnimationMixer;
  clips: THREE.AnimationClip[];
  walkAction?: THREE.AnimationAction;
  idleAction?: THREE.AnimationAction;
  emoteAction?: THREE.AnimationAction;
  /** Home chores own this actor: steering must not drag them off a task. */
  busy?: boolean;
  /** Standing on a task spot. Collision should leave them there. */
  anchored?: boolean;
  /** What they say if the player talks to them mid-task. */
  statusLine?: string;
  clipKey?: string;
}

export class NpcManager {
  actors: NpcActor[] = [];
  isHeld = false;
  private entityManager = new YUKA.EntityManager();
  private time = new YUKA.Time();
  private profiles: Record<string, NpcProfile> = {};

  setProfiles(list: NpcProfile[]): void {
    this.profiles = Object.fromEntries(list.map((p) => [p.id, p]));
  }

  clear(sceneGroup: THREE.Group): void {
    for (const actor of this.actors) {
      sceneGroup.remove(actor.mesh);
      this.entityManager.remove(actor.vehicle);
    }
    this.actors = [];
  }

  spawn(
    sceneGroup: THREE.Group,
    spawns: Array<{ id: string; position: THREE.Vector3 }>,
    memory: MemoryStore,
  ): void {
    this.clear(sceneGroup);
    for (const spawn of spawns) {
      const profile = this.profiles[spawn.id];
      if (!profile) continue;
      memory.ensureNpc(spawn.id, {
        trust: profile.trustTowardPlayer,
        friendship: profile.friendship,
        mood: profile.mood,
      });

      const { mesh, mixer, walkAction, idleAction, clips } = this.createMesh(spawn.id, profile.color);
      mesh.position.copy(spawn.position);
      mesh.userData.npcId = spawn.id;
      mesh.traverse((child) => {
        child.userData.npcId = spawn.id;
      });
      sceneGroup.add(mesh);

      const vehicle = new YUKA.Vehicle();
      vehicle.maxSpeed = 1.8 + Math.random();
      vehicle.position.set(spawn.position.x, 0, spawn.position.z);

      const path = new YUKA.Path();
      path.loop = true;
      const cx = spawn.position.x;
      const cz = spawn.position.z;
      path.add(new YUKA.Vector3(cx, 0, cz));
      path.add(new YUKA.Vector3(cx + 1.5, 0, cz + 1));
      path.add(new YUKA.Vector3(cx - 0.6, 0, cz + 1.4));
      path.add(new YUKA.Vector3(cx - 1.4, 0, cz));

      const followPath = new YUKA.FollowPathBehavior(path, 0.5);
      vehicle.steering.add(followPath);

      this.entityManager.add(vehicle);
      this.actors.push({
        id: spawn.id,
        profile: {
          ...profile,
          diary: memory.diaries[spawn.id] ?? [],
          mood: memory.moods[spawn.id] ?? profile.mood,
          trustTowardPlayer: memory.trust[spawn.id] ?? profile.trustTowardPlayer,
        },
        mesh,
        vehicle,
        path,
        diaryQueue: [],
        mixer,
        clips,
        walkAction,
        idleAction,
      });
    }
  }

  setHeld(held: boolean): void {
    this.isHeld = held;
  }

  place(id: string, x: number, z: number, lookAt?: THREE.Vector3): void {
    const actor = this.actors.find((item) => item.id === id);
    if (!actor) return;
    actor.mesh.position.set(x, 0, z);
    actor.vehicle.position.set(x, 0, z);
    if (lookAt) actor.mesh.rotation.y = Math.atan2(lookAt.x - x, lookAt.z - z);
  }

  playEmote(id: string, kind: string): void {
    this.playClip(id, kind, false);
  }

  /** Looping or one-shot clip. Repeating the same request does not restart it. */
  playClip(id: string, kind: string, loop: boolean): void {
    const actor = this.actors.find((item) => item.id === id);
    if (!actor?.mixer) return;
    const key = `${kind}:${loop ? 1 : 0}`;
    if (actor.clipKey === key) return;

    if (kind === 'walk' && actor.walkAction) {
      actor.emoteAction?.fadeOut(0.15);
      actor.idleAction?.fadeOut(0.15);
      actor.walkAction.reset().fadeIn(0.15).play();
      actor.clipKey = key;
      return;
    }
    if (kind === 'idle' && actor.idleAction) {
      actor.emoteAction?.fadeOut(0.15);
      actor.walkAction?.fadeOut(0.15);
      actor.idleAction.reset().fadeIn(0.15).play();
      actor.clipKey = key;
      return;
    }

    const clip = pickClip(actor.clips, kind);
    if (!clip) return;
    actor.emoteAction?.fadeOut(0.1);
    actor.walkAction?.fadeOut(0.1);
    actor.idleAction?.fadeOut(0.1);
    const action = actor.mixer.clipAction(clip);
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.fadeIn(0.12).play();
    actor.emoteAction = action;
    actor.clipKey = key;
  }

  /** Walk toward a chore. Collision may still nudge them. */
  moveBusy(id: string, x: number, z: number, yaw: number): void {
    const actor = this.actors.find((item) => item.id === id);
    if (!actor) return;
    actor.busy = true;
    actor.anchored = false;
    actor.mesh.position.set(x, 0, z);
    actor.mesh.rotation.y = yaw;
    actor.vehicle.position.set(x, 0, z);
    actor.vehicle.velocity.set(0, 0, 0);
  }

  /** Stand on the task spot and ignore steering. */
  holdAt(id: string, x: number, z: number, yaw: number): void {
    const actor = this.actors.find((item) => item.id === id);
    if (!actor) return;
    actor.busy = true;
    actor.anchored = true;
    actor.mesh.position.set(x, 0, z);
    actor.mesh.rotation.y = yaw;
    actor.vehicle.position.set(x, 0, z);
    actor.vehicle.velocity.set(0, 0, 0);
  }

  releaseActor(id: string): void {
    const actor = this.actors.find((item) => item.id === id);
    if (!actor) return;
    actor.busy = false;
    actor.anchored = false;
    actor.statusLine = undefined;
    actor.clipKey = undefined;
    actor.emoteAction?.fadeOut(0.15);
    actor.walkAction?.fadeOut(0.15);
    if (actor.idleAction && !actor.idleAction.isRunning()) actor.idleAction.reset().fadeIn(0.15).play();
  }

  setStatus(id: string, line: string | null): void {
    const actor = this.actors.find((item) => item.id === id);
    if (actor) actor.statusLine = line ?? undefined;
  }

  update(dt: number, clock: GameClock, memory: MemoryStore): void {
    this.time.update();
    if (!this.isHeld) this.entityManager.update(dt);

    for (const actor of this.actors) {
      if (!this.isHeld && !actor.busy) {
        actor.mesh.position.set(actor.vehicle.position.x, 0, actor.vehicle.position.z);
      }
      const moving = !this.isHeld && !actor.busy && actor.vehicle.getSpeed() > 0.15;
      if (moving) {
        actor.mesh.lookAt(
          actor.vehicle.position.x + actor.vehicle.velocity.x,
          0,
          actor.vehicle.position.z + actor.vehicle.velocity.z,
        );
      }
      if (actor.mixer) {
        if (!actor.busy) {
          if (moving && actor.walkAction && !actor.walkAction.isRunning()) {
            actor.idleAction?.fadeOut(0.2);
            actor.walkAction.reset().fadeIn(0.2).play();
          } else if (!this.isHeld && !moving && actor.idleAction && !actor.idleAction.isRunning()) {
            actor.walkAction?.fadeOut(0.2);
            actor.idleAction.reset().fadeIn(0.2).play();
          }
        }
        actor.mixer.update(dt);
      }

      if (clock.minuteOfHour === 0 && Math.random() < 0.15) {
        const text = this.routineText(actor.id, clock.hour);
        memory.addDiary(actor.id, clock.timeLabel, text);
      }
    }
  }

  getNearest(position: THREE.Vector3, radius = 2.2): NpcActor | null {
    let best: NpcActor | null = null;
    let bestDist = radius;
    for (const actor of this.actors) {
      const d = actor.mesh.position.distanceTo(position);
      if (d < bestDist) {
        bestDist = d;
        best = actor;
      }
    }
    return best;
  }

  talkTo(actor: NpcActor, memory: MemoryStore, clock: GameClock): string {
    const trust = memory.trust[actor.id] ?? 50;
    const mood = memory.moods[actor.id] ?? 'neutral';
    let line = actor.statusLine ?? `שלום! אני ${actor.profile.name}.`;
    if (!actor.statusLine) {
      if (mood === 'happy') line = `${actor.profile.name}: היי! כיף לראות אותך.`;
      if (mood === 'angry') line = `${actor.profile.name}: עכשיו קצת קשה לי…`;
      if (mood === 'sad') line = `${actor.profile.name}: היי… יום לא פשוט.`;
      if (trust > 70) line += ' תמיד כיף לדבר איתך.';
      if (trust < 30) line += ' בוא נדבר אחר כך, בסדר?';
    }

    memory.addDiary(actor.id, clock.timeLabel, `דיבר עם השחקן`);
    memory.adjustFriendship(actor.id, 1);
    bus.emit('npc-talk', { id: actor.id, line });
    return line;
  }

  private routineText(id: string, hour: number): string {
    if (hour < 8) return 'מתעורר/ת בבוקר';
    if (hour < 14) return id === 'teacher' ? 'מלמדת בכיתה' : 'בפעילות יומית';
    if (hour < 18) return 'מסתובב/ת בשכונה או בפארק';
    if (hour < 21) return 'בבית לקראת ערב';
    return 'נרגע/ת לפני שינה';
  }

  private createMesh(
    id: string,
    color: number,
  ): {
    mesh: THREE.Group;
    clips: THREE.AnimationClip[];
    mixer?: THREE.AnimationMixer;
    walkAction?: THREE.AnimationAction;
    idleAction?: THREE.AnimationAction;
  } {
    const loaded = takeCharacterModel(id);
    if (loaded) {
      // Quaternius models are often ~1.7 units tall already
      loaded.mesh.scale.setScalar(1);
      const mixer = new THREE.AnimationMixer(loaded.mesh);
      const walkClip =
        loaded.clips.find((c) => /walk/i.test(c.name)) ??
        loaded.clips.find((c) => /run/i.test(c.name));
      const idleClip =
        loaded.clips.find((c) => /idle/i.test(c.name)) ??
        loaded.clips.find((c) => /stand/i.test(c.name)) ??
        loaded.clips[0];
      const walkAction = walkClip ? mixer.clipAction(walkClip) : undefined;
      const idleAction = idleClip ? mixer.clipAction(idleClip) : undefined;
      idleAction?.play();
      return { mesh: loaded.mesh, clips: loaded.clips, mixer, walkAction, idleAction };
    }

    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, 0.8, 4, 8),
      new THREE.MeshStandardMaterial({ color }),
    );
    body.position.y = 0.85;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xf0c8a0 }),
    );
    head.position.y = 1.55;
    g.add(head);
    return { mesh: g, clips: [] };
  }
}
