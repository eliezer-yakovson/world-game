import * as THREE from 'three';

export interface CircleObstacle {
  x: number;
  z: number;
  radius: number;
}

interface Solid {
  box: THREE.Box3;
  stamp: number;
}

const CELL = 4;

/** Solid boxes for walls and props, plus moving circles for people and cars. */
export class CollisionWorld {
  private readonly size = new THREE.Vector3();
  private readonly grid = new Map<number, Solid[]>();
  private readonly nearby: Solid[] = [];
  private readonly resolved = new THREE.Vector3();
  private readonly stepped = new THREE.Vector3();
  private queryStamp = 1;

  rebuild(root: THREE.Object3D): void {
    this.grid.clear();
    root.updateWorldMatrix(true, true);
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      if (this.ignored(mesh)) return;
      const box = new THREE.Box3().setFromObject(mesh);
      if (box.isEmpty()) return;
      box.getSize(this.size);
      if (this.isGround(this.size)) return;
      this.insert({ box, stamp: 0 });
    });
  }

  /**
   * Pushes `position` out of nearby walls and circles.
   * The returned vector is reused on the next call, so copy it before resolving again.
   */
  resolve(position: THREE.Vector3, radius: number, circles: CircleObstacle[]): THREE.Vector3 {
    this.resolved.copy(position);
    this.pushAll(this.resolved, radius, circles);
    return this.resolved;
  }

  /** Short steps so a fast move cannot skip a thin wall. Same reuse rule as `resolve`. */
  slide(from: THREE.Vector3, to: THREE.Vector3, radius: number, circles: CircleObstacle[]): THREE.Vector3 {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const dist = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(dist / 0.04));
    this.stepped.copy(from);
    const sx = dx / steps;
    const sz = dz / steps;
    for (let i = 0; i < steps; i++) {
      this.stepped.x += sx;
      this.stepped.z += sz;
      this.pushAll(this.stepped, radius, circles);
    }
    this.resolved.copy(this.stepped);
    return this.resolved;
  }

  private insert(solid: Solid): void {
    const box = solid.box;
    const minX = Math.floor(box.min.x / CELL);
    const maxX = Math.floor(box.max.x / CELL);
    const minZ = Math.floor(box.min.z / CELL);
    const maxZ = Math.floor(box.max.z / CELL);
    for (let ix = minX; ix <= maxX; ix++) {
      for (let iz = minZ; iz <= maxZ; iz++) {
        const key = cellKey(ix, iz);
        let bucket = this.grid.get(key);
        if (!bucket) {
          bucket = [];
          this.grid.set(key, bucket);
        }
        bucket.push(solid);
      }
    }
  }

  private collect(x: number, z: number, reach: number): Solid[] {
    this.queryStamp++;
    const list = this.nearby;
    list.length = 0;
    const minX = Math.floor((x - reach) / CELL);
    const maxX = Math.floor((x + reach) / CELL);
    const minZ = Math.floor((z - reach) / CELL);
    const maxZ = Math.floor((z + reach) / CELL);
    for (let ix = minX; ix <= maxX; ix++) {
      for (let iz = minZ; iz <= maxZ; iz++) {
        const bucket = this.grid.get(cellKey(ix, iz));
        if (!bucket) continue;
        for (const solid of bucket) {
          if (solid.stamp === this.queryStamp) continue;
          solid.stamp = this.queryStamp;
          list.push(solid);
        }
      }
    }
    return list;
  }

  private pushAll(pos: THREE.Vector3, radius: number, circles: CircleObstacle[]): void {
    const solids = this.collect(pos.x, pos.z, radius + 2);
    for (let pass = 0; pass < 2; pass++) {
      for (const solid of solids) this.pushOutOfBox(pos, radius, solid.box);
      for (const circle of circles) this.pushOutOfCircle(pos, radius, circle);
    }
  }

  private ignored(obj: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = obj;
    while (current) {
      if (current.name === 'traffic' || current.userData.noCollide || current.userData.npcId) return true;
      current = current.parent;
    }
    return false;
  }

  private isGround(size: THREE.Vector3): boolean {
    if (size.y < 0.45) return true;
    if (size.x > 24 && size.z > 24) return true;
    return size.y < 0.95 && (size.x > 5 || size.z > 5);
  }

  private pushOutOfBox(pos: THREE.Vector3, radius: number, box: THREE.Box3): void {
    const closestX = THREE.MathUtils.clamp(pos.x, box.min.x, box.max.x);
    const closestZ = THREE.MathUtils.clamp(pos.z, box.min.z, box.max.z);
    const dx = pos.x - closestX;
    const dz = pos.z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq >= radius * radius) return;
    if (distSq > 1e-6) {
      const dist = Math.sqrt(distSq);
      const push = radius - dist;
      pos.x += (dx / dist) * push;
      pos.z += (dz / dist) * push;
      return;
    }
    const left = pos.x - box.min.x;
    const right = box.max.x - pos.x;
    const back = pos.z - box.min.z;
    const front = box.max.z - pos.z;
    const min = Math.min(left, right, back, front);
    if (min === left) pos.x = box.min.x - radius;
    else if (min === right) pos.x = box.max.x + radius;
    else if (min === back) pos.z = box.min.z - radius;
    else pos.z = box.max.z + radius;
  }

  private pushOutOfCircle(pos: THREE.Vector3, radius: number, circle: CircleObstacle): void {
    const dx = pos.x - circle.x;
    const dz = pos.z - circle.z;
    const min = radius + circle.radius;
    const distSq = dx * dx + dz * dz;
    if (distSq >= min * min) return;
    if (distSq < 1e-6) {
      pos.x += min;
      return;
    }
    const dist = Math.sqrt(distSq);
    const push = min - dist;
    pos.x += (dx / dist) * push;
    pos.z += (dz / dist) * push;
  }
}

function cellKey(ix: number, iz: number): number {
  return (ix + 1024) * 4096 + (iz + 1024);
}
