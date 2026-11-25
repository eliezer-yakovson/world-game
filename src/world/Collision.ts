import * as THREE from 'three';

export interface CircleObstacle {
  x: number;
  z: number;
  radius: number;
}

/** Solid boxes for walls and props, plus moving circles for people and cars. */
export class CollisionWorld {
  private boxes: THREE.Box3[] = [];
  private readonly size = new THREE.Vector3();

  rebuild(root: THREE.Object3D): void {
    this.boxes = [];
    root.updateWorldMatrix(true, true);
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      if (this.ignored(mesh)) return;
      const box = new THREE.Box3().setFromObject(mesh);
      if (box.isEmpty()) return;
      box.getSize(this.size);
      if (this.isGround(this.size)) return;
      this.boxes.push(box);
    });
  }

  resolve(position: THREE.Vector3, radius: number, circles: CircleObstacle[]): THREE.Vector3 {
    const next = position.clone();
    for (let pass = 0; pass < 2; pass++) {
      for (const box of this.boxes) this.pushOutOfBox(next, radius, box);
      for (const circle of circles) this.pushOutOfCircle(next, radius, circle);
    }
    return next;
  }

  /** Short steps so a fast move cannot skip a thin wall. */
  slide(from: THREE.Vector3, to: THREE.Vector3, radius: number, circles: CircleObstacle[]): THREE.Vector3 {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const dist = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(dist / 0.04));
    const pos = from.clone();
    for (let i = 0; i < steps; i++) {
      pos.x += dx / steps;
      pos.z += dz / steps;
      pos.copy(this.resolve(pos, radius, circles));
    }
    return pos;
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
    let dx = pos.x - closestX;
    let dz = pos.z - closestZ;
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
