import * as THREE from 'three';
import type { GameSettings } from '../core/types';
import { takeCharacterModel } from '../world/AssetLoader';
import { pickClip } from './emotes';

export class PlayerController {
  readonly mesh: THREE.Group;
  readonly position: THREE.Vector3;
  velocity = new THREE.Vector3();
  speed = 6;
  runMultiplier = 1.7;
  hasBike = false;
  hasScooter = false;
  private keys = new Set<string>();
  private interactLatch = false;
  private yaw = 0;
  cameraDistance = 10;
  cameraHeight = 6;
  topDown = false;
  private sensitivity = 1;
  private mixer?: THREE.AnimationMixer;
  private clips: THREE.AnimationClip[] = [];
  private walkAction?: THREE.AnimationAction;
  private idleAction?: THREE.AnimationAction;
  private emoteAction?: THREE.AnimationAction;
  private moving = false;
  /** While set, the player stays on a chosen chore instead of walking. */
  taskHold = false;
  private heldKey = '';
  private fallbackColor = 0x3d9b8f;
  private pose: {
    origin: THREE.Vector3;
    target: THREE.Vector3 | null;
    yaw: number;
    pitch: number;
    bob: number;
    bobSpeed: number;
    climb: boolean;
    lock: boolean;
    standAt: THREE.Vector3 | null;
    t: number;
    duration: number;
  } | null = null;

  constructor(color = 0x3d9b8f) {
    this.fallbackColor = color;
    this.mesh = new THREE.Group();
    this.buildFallback(color);
    this.position = this.mesh.position;
    this.position.set(0, 0, 0);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private buildFallback(color: number): void {
    while (this.mesh.children.length) this.mesh.remove(this.mesh.children[0]);
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
      new THREE.MeshStandardMaterial({ color }),
    );
    body.position.y = 0.9;
    body.castShadow = true;
    this.mesh.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xf0c8a0 }),
    );
    head.position.y = 1.7;
    this.mesh.add(head);
  }

  setColor(color: number): void {
    this.fallbackColor = color;
    const body = this.mesh.children[0] as THREE.Mesh | undefined;
    if (body?.isMesh && body.geometry.type === 'CapsuleGeometry') {
      (body.material as THREE.MeshStandardMaterial).color.setHex(color);
    }
  }

  /** Swap capsule for Quaternius GLB when available. */
  setCharacterModel(id: string): void {
    const loaded = takeCharacterModel(id);
    if (!loaded) {
      this.buildFallback(this.fallbackColor);
      this.mixer = undefined;
      this.clips = [];
      return;
    }
    while (this.mesh.children.length) this.mesh.remove(this.mesh.children[0]);
    this.mesh.add(loaded.mesh);
    this.clips = loaded.clips;
    this.mixer = new THREE.AnimationMixer(loaded.mesh);
    const walkClip =
      loaded.clips.find((c) => /walk/i.test(c.name)) ?? loaded.clips.find((c) => /run/i.test(c.name));
    const idleClip =
      loaded.clips.find((c) => /idle/i.test(c.name)) ??
      loaded.clips.find((c) => /stand/i.test(c.name)) ??
      loaded.clips[0];
    this.walkAction = walkClip ? this.mixer.clipAction(walkClip) : undefined;
    this.idleAction = idleClip ? this.mixer.clipAction(idleClip) : undefined;
    this.idleAction?.play();
  }

  applySettings(settings: GameSettings): void {
    this.sensitivity = settings.cameraSensitivity;
  }

  face(x: number, z: number): void {
    this.mesh.rotation.y = Math.atan2(x - this.position.x, z - this.position.z);
  }

  playEmote(kind: string, loop = false): void {
    if (!this.mixer) return;
    const clip = pickClip(this.clips, kind);
    if (!clip) return;
    this.emoteAction?.fadeOut(0.1);
    const action = this.mixer.clipAction(clip);
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.fadeIn(0.12).play();
    this.emoteAction = action;
    this.walkAction?.fadeOut(0.1);
    this.idleAction?.fadeOut(0.1);
  }

  playIdle(): void {
    this.emoteAction?.fadeOut(0.15);
    this.walkAction?.stop();
    this.idleAction?.reset().fadeIn(0.15).play();
  }

  /** Plays a chore clip and keeps it playing. The same clip is not restarted. */
  playHeldClip(kind: string, loop: boolean): void {
    const key = `${kind}:${loop}`;
    if (this.heldKey === key) return;
    this.heldKey = key;
    if (kind === 'walk' && this.walkAction) {
      this.emoteAction?.fadeOut(0.15);
      this.idleAction?.fadeOut(0.15);
      this.walkAction.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.15).play();
      return;
    }
    if (kind === 'idle' && loop && this.idleAction) {
      this.emoteAction?.fadeOut(0.15);
      this.walkAction?.fadeOut(0.15);
      this.idleAction.reset().fadeIn(0.15).play();
      return;
    }
    this.playEmote(kind, loop);
  }

  releaseHold(): void {
    this.taskHold = false;
    this.heldKey = '';
    if (this.mixer) this.playIdle();
  }

  toggleTopDown(): boolean {
    this.topDown = !this.topDown;
    return this.topDown;
  }

  get cameraYaw(): number {
    return this.yaw;
  }

  get posing(): boolean {
    return this.pose !== null;
  }

  startPose(options: {
    x: number;
    y?: number;
    z: number;
    yaw: number;
    pitch?: number;
    emote?: string;
    bob?: number;
    bobSpeed?: number;
    slideTo?: THREE.Vector3;
    duration?: number;
    climb?: boolean;
    lock?: boolean;
    standX?: number;
    standZ?: number;
  }): void {
    this.pose = {
      origin: new THREE.Vector3(options.x, options.y ?? 0, options.z),
      target: options.slideTo?.clone() ?? null,
      yaw: options.yaw,
      pitch: options.pitch ?? 0,
      bob: options.bob ?? 0,
      bobSpeed: options.bobSpeed ?? 2.6,
      climb: options.climb ?? false,
      lock: options.lock ?? false,
      standAt:
        options.standX !== undefined && options.standZ !== undefined
          ? new THREE.Vector3(options.standX, 0, options.standZ)
          : null,
      t: 0,
      duration: options.duration ?? (options.climb ? 1.5 : 1.15),
    };
    this.position.copy(this.pose.origin);
    this.mesh.rotation.order = 'YXZ';
    this.mesh.rotation.set(this.pose.pitch, this.pose.yaw, 0);
    this.playEmote(options.emote ?? 'sit');
  }

  endPose(): void {
    if (!this.pose) return;
    const standAt = this.pose.standAt;
    this.pose = null;
    if (standAt) this.position.set(standAt.x, 0, standAt.z);
    else this.position.y = 0;
    this.mesh.rotation.x = 0;
    this.mesh.rotation.z = 0;
    this.playIdle();
  }

  private moveKeysHeld(): boolean {
    return ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some((key) =>
      this.keys.has(key),
    );
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (isTypingTarget(e)) return;
    // Physical key, so a Hebrew layout still moves with the WASD keys.
    this.keys.add(e.code);
    if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'NumpadEnter') this.interactLatch = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  get interactPressed(): boolean {
    return this.keys.has('KeyE') || this.keys.has('Enter') || this.keys.has('NumpadEnter');
  }

  consumeInteract(): boolean {
    const held = this.interactPressed;
    if (!held && !this.interactLatch) return false;
    this.interactLatch = false;
    this.keys.delete('KeyE');
    this.keys.delete('Enter');
    this.keys.delete('NumpadEnter');
    return true;
  }

  update(
    dt: number,
    camera: THREE.PerspectiveCamera,
    blocked = false,
    resolve?: (next: THREE.Vector3, radius: number) => THREE.Vector3,
  ): void {
    if (this.pose) {
      const pose = this.pose;
      pose.t += dt;
      if (!pose.lock && this.moveKeysHeld() && pose.t > 0.35) {
        this.endPose();
      } else {
        const done = this.applyPose();
        this.mixer?.update(dt);
        this.frameCamera(dt, camera);
        if (done) this.endPose();
        return;
      }
    }

    if (this.taskHold) {
      if (!blocked) {
        if (this.keys.has('KeyQ')) this.yaw += dt * 1.5 * this.sensitivity;
        if (this.keys.has('KeyR')) this.yaw -= dt * 1.5 * this.sensitivity;
        this.frameCamera(dt, camera);
      }
      this.mixer?.update(dt);
      return;
    }

    if (blocked) {
      this.mixer?.update(dt);
      return;
    }

    let inputX = 0;
    let inputZ = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) inputZ -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) inputZ += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowRight')) inputX += 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowLeft')) inputX -= 1;
    if (this.keys.has('KeyQ')) this.yaw += dt * 1.5 * this.sensitivity;
    if (this.keys.has('KeyR')) this.yaw -= dt * 1.5 * this.sensitivity;

    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    let moveSpeed = this.speed * (running ? this.runMultiplier : 1);
    if (this.hasBike) moveSpeed *= 1.8;
    else if (this.hasScooter) moveSpeed *= 1.5;

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const move = new THREE.Vector3();
    move.addScaledVector(forward, -inputZ);
    move.addScaledVector(right, inputX);
    this.moving = move.lengthSq() > 0;
    if (this.moving) {
      move.normalize();
      const radius = 0.46;
      const travel = moveSpeed * dt;
      const slices = Math.max(1, Math.ceil(travel / 0.04));
      const slice = travel / slices;
      const pos = this.position.clone();
      for (let i = 0; i < slices; i++) {
        const next = pos.clone().addScaledVector(move, slice);
        pos.copy(resolve ? resolve(next, radius) : next);
      }
      this.position.copy(pos);
      this.mesh.rotation.y = Math.atan2(move.x, move.z);
    }

    if (this.mixer) {
      if (this.moving && this.walkAction && !this.walkAction.isRunning()) {
        this.idleAction?.fadeOut(0.15);
        this.walkAction.reset().fadeIn(0.15).play();
      } else if (!this.moving && this.idleAction && !this.idleAction.isRunning()) {
        this.walkAction?.fadeOut(0.15);
        this.idleAction.reset().fadeIn(0.15).play();
      }
      this.mixer.update(dt);
    }

    // Soft world bounds per zone feel
    this.position.x = THREE.MathUtils.clamp(this.position.x, -40, 40);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -40, 40);

    this.frameCamera(dt, camera);
  }

  /** Moves the seated, lying, or sliding body. Returns true when a one-shot pose is finished. */
  private applyPose(): boolean {
    const pose = this.pose;
    if (!pose) return false;
    let x = pose.origin.x;
    let y = pose.origin.y;
    let z = pose.origin.z;
    if (pose.target) {
      const u = Math.min(1, pose.t / Math.max(0.2, pose.duration));
      const ease = u * u * (3 - 2 * u);
      x = THREE.MathUtils.lerp(pose.origin.x, pose.target.x, ease);
      y = THREE.MathUtils.lerp(pose.origin.y, pose.target.y, ease);
      z = THREE.MathUtils.lerp(pose.origin.z, pose.target.z, ease);
      this.position.set(x, y, z);
      this.mesh.rotation.set(pose.pitch, pose.yaw, 0);
      return u >= 1;
    }
    if (pose.climb) {
      const u = Math.min(1, pose.t / pose.duration);
      y = Math.sin(u * Math.PI) * 1.25;
      this.position.set(x, y, z);
      this.mesh.rotation.set(0, pose.yaw, 0);
      return u >= 1;
    }
    if (pose.bob) y += Math.sin(pose.t * pose.bobSpeed) * pose.bob;
    this.position.set(x, y, z);
    this.mesh.rotation.order = 'YXZ';
    this.mesh.rotation.set(pose.pitch, pose.yaw, 0);
    return false;
  }

  private frameCamera(dt: number, camera: THREE.PerspectiveCamera): void {
    const distance = this.topDown ? 1.4 : this.cameraDistance;
    const height = this.topDown ? 18 : this.cameraHeight;
    const camOffset = new THREE.Vector3(
      Math.sin(this.yaw) * distance,
      height,
      Math.cos(this.yaw) * distance,
    );
    const desired = this.position.clone().add(camOffset);
    camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
    camera.lookAt(this.position.x, this.position.y + 1.2, this.position.z);
  }
}

function isTypingTarget(event: KeyboardEvent): boolean {
  const target = event.target;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}
