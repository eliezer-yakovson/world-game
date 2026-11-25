import * as THREE from 'three';
import { lookFor, type CharacterLook } from './characterLooks';
import { dressCharacter } from './outfits';

const TOP_HAT_MIN_Y = 2.95;

/**
 * The character GLBs were exported without textures. Skin is a near-black factor,
 * and the eyes, pupils, and brows share one white material. Repaint them so each
 * person reads as a distinct face instead of a black head with white streaks.
 */
export function presentCharacter(root: THREE.Object3D, id: string): void {
  const look = lookFor(id);
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let isFace = false;
    let isHat = false;
    for (const material of materials) {
      const standard = material as THREE.MeshStandardMaterial;
      if (!standard || !('color' in standard)) continue;
      const name = (standard.name || '').toLowerCase();
      const color = colorFor(name, look);
      if (color !== undefined) {
        standard.color.setHex(color);
        standard.metalness = 0;
        standard.roughness = name === 'skin' ? 0.72 : 0.8;
        standard.needsUpdate = true;
      }
      if (name === 'face') isFace = true;
      if (name === 'hat') isHat = true;
    }
    if (isHat && geometryMinY(mesh) > TOP_HAT_MIN_Y) mesh.visible = false;
    if (isFace) replaceFaceWithEyes(mesh);
  });
  dressCharacter(root, id);
}

function colorFor(name: string, look: CharacterLook): number | undefined {
  switch (name) {
    case 'skin':
      return look.skin;
    case 'shirt':
    case 'main':
      return look.shirt;
    case 'pants':
    case 'brown':
      return look.pants;
    case 'hair':
      return look.hair;
    case 'belt':
    case 'black':
      return look.belt;
    case 'detail':
    case 'details':
    case 'vest':
      return look.detail;
    case 'hat':
      return look.hat;
    default:
      return undefined;
  }
}

function geometryMinY(mesh: THREE.Mesh): number {
  const position = mesh.geometry.getAttribute('position');
  if (!position) return 0;
  let min = Infinity;
  for (let i = 0; i < position.count; i++) min = Math.min(min, position.getY(i));
  return min;
}

function replaceFaceWithEyes(mesh: THREE.Mesh): void {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  if (!position || !index) return;

  const parent = new Int32Array(position.count);
  for (let i = 0; i < parent.length; i++) parent[i] = i;
  const find = (a: number): number => {
    let root = a;
    while (parent[root] !== root) root = parent[root];
    while (parent[a] !== root) {
      const next = parent[a];
      parent[a] = root;
      a = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t);
    const b = index.getX(t + 1);
    const c = index.getX(t + 2);
    union(a, b);
    union(b, c);
  }

  const eyeCenters: THREE.Vector3[] = [];
  const groups = new Map<number, number[]>();
  for (let i = 0; i < position.count; i++) {
    const root = find(i);
    const group = groups.get(root);
    if (group) group.push(i);
    else groups.set(root, [i]);
  }

  for (const members of groups.values()) {
    const bounds = boundsOf(position, members);
    const sizeX = bounds.maxX - bounds.minX;
    const sizeY = bounds.maxY - bounds.minY;
    const eye = sizeX > 0.12 && sizeY < 0.11;
    if (!eye) continue;
    eyeCenters.push(new THREE.Vector3(
      (bounds.minX + bounds.maxX) / 2,
      (bounds.minY + bounds.maxY) / 2,
      bounds.maxZ,
    ));
  }

  mesh.visible = false;
  if (!eyeCenters.length) return;
  const left = averageCenters(eyeCenters.filter((center) => center.x < 0));
  const right = averageCenters(eyeCenters.filter((center) => center.x >= 0));
  const sockets = [left, right].filter((center): center is THREE.Vector3 => center !== null);
  attachEyes(mesh, sockets);
}

function averageCenters(centers: THREE.Vector3[]): THREE.Vector3 | null {
  if (!centers.length) return null;
  const sum = new THREE.Vector3();
  for (const center of centers) sum.add(center);
  return sum.multiplyScalar(1 / centers.length);
}

function attachEyes(mesh: THREE.Mesh, sockets: THREE.Vector3[]): void {
  const skinned = mesh as THREE.SkinnedMesh;
  const head = skinned.skeleton?.bones.find((bone) => bone.name === 'Head');
  const headIndex = head ? skinned.skeleton?.bones.indexOf(head) ?? -1 : -1;
  const inverseBind = headIndex >= 0 ? skinned.skeleton?.boneInverses[headIndex] : undefined;
  if (!head || !inverseBind) return;

  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf6f7f8, roughness: 0.4, metalness: 0 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x1c140f, roughness: 0.45, metalness: 0 });
  const whiteGeo = new THREE.SphereGeometry(0.055, 14, 10);
  const pupilGeo = new THREE.SphereGeometry(0.03, 12, 8);
  const forward = new THREE.Vector3(0, 0, 1);

  for (const socket of sockets) {
    const local = socket.clone().applyMatrix4(inverseBind);
    const ahead = socket.clone().add(forward).applyMatrix4(inverseBind);
    const outward = ahead.sub(local).normalize();
    const eye = new THREE.Group();
    eye.position.copy(local).addScaledVector(outward, 0.02);
    eye.add(new THREE.Mesh(whiteGeo, whiteMat));
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.copy(outward).multiplyScalar(0.038);
    eye.add(pupil);
    head.add(eye);
  }
}

function boundsOf(position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, members: number[]) {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const vertex of members) {
    const x = position.getX(vertex);
    const y = position.getY(vertex);
    const z = position.getZ(vertex);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  return { minX, minY, minZ, maxX, maxY, maxZ };
}
