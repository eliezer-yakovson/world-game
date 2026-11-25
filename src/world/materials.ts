import * as THREE from 'three';

export const mats = {
  grass: new THREE.MeshStandardMaterial({ color: 0x4f8f4a, roughness: 0.9, metalness: 0 }),
  road: new THREE.MeshStandardMaterial({ color: 0x3a3f48, roughness: 0.95, metalness: 0 }),
  sidewalk: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.85, metalness: 0 }),
  wall: new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.85, metalness: 0 }),
  wallBlue: new THREE.MeshStandardMaterial({ color: 0xa8c4dc, roughness: 0.85, metalness: 0 }),
  wallGreen: new THREE.MeshStandardMaterial({ color: 0xb5d0b0, roughness: 0.85, metalness: 0 }),
  wallYellow: new THREE.MeshStandardMaterial({ color: 0xe8d48a, roughness: 0.85, metalness: 0 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x8b4a3a, roughness: 0.8, metalness: 0.05 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.8, metalness: 0 }),
  door: new THREE.MeshStandardMaterial({ color: 0x6a3412, roughness: 0.75, metalness: 0 }),
  floor: new THREE.MeshStandardMaterial({ color: 0xc4a574, roughness: 0.7, metalness: 0 }),
  water: new THREE.MeshStandardMaterial({ color: 0x4a90c8, roughness: 0.2, metalness: 0.1 }),
  fence: new THREE.MeshStandardMaterial({ color: 0x6b5a45, roughness: 0.9, metalness: 0 }),
  asphaltDark: new THREE.MeshStandardMaterial({ color: 0x2c3038, roughness: 0.95, metalness: 0 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9fd3ff, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.55 }),
  sand: new THREE.MeshStandardMaterial({ color: 0xd6c08a, roughness: 1, metalness: 0 }),
  play: new THREE.MeshStandardMaterial({ color: 0xe07a5f, roughness: 0.6, metalness: 0.1 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x7a8490, roughness: 0.4, metalness: 0.6 }),
};

export function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function cyl(r: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
