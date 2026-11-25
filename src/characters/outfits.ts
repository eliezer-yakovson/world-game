import * as THREE from 'three';

/**
 * The character files reuse a handful of shirt and pants meshes. Recoloring
 * those shared shapes still leaves Yael looking like Maya. This builds a
 * separate garment set per person and parents it to the shared skeleton, so
 * the clothes follow Idle, Walk, and the other clips.
 *
 * Pieces are placed in the mesh's bind space (the same space as the skin
 * vertices) and converted with the bone's inverse bind matrix. That is the
 * same attachment the eyes use, so a sleeve stays on the arm when it bends.
 */

type Pattern = 'solid' | 'stripes' | 'dots' | 'plaid' | 'band' | 'checks' | 'floral' | 'buttons';

interface Piece {
  bone: string;
  kind: 'box' | 'cyl' | 'sphere';
  /** box: width, height, depth. cyl: radiusTop, radiusBottom, height. sphere: radius. */
  size: [number, number, number];
  /** Center in bind / mesh space. */
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  color: number;
  accent?: number;
  pattern?: Pattern;
  offset?: boolean;
}

type Sleeves = 'none' | 'short' | 'long' | 'puff';
type Bottom = 'shorts' | 'pants' | 'skirt' | 'longskirt' | 'pencil';

interface Outfit {
  top: number;
  topAccent?: number;
  topPattern?: Pattern;
  sleeves: Sleeves;
  sleeve?: number;
  bottom: Bottom;
  bottomColor: number;
  bottomAccent?: number;
  bottomPattern?: Pattern;
  collar?: number;
  hood?: number;
  apron?: number;
  vest?: 'open' | 'front';
  vestColor?: number;
  suspenders?: number;
  bib?: number;
  pockets?: boolean;
  tunic?: boolean;
  head?: 'kippah' | 'scarf' | 'hat';
  kippah?: number;
  scarf?: number;
  peyot?: boolean;
  jacket?: number;
  tie?: number;
}

const OUTFITS: Record<string, Outfit> = {
  yael: { top: 0x3d6ea8, topAccent: 0xe7eef8, topPattern: 'stripes', sleeves: 'short', bottom: 'shorts', bottomColor: 0x3a342c },
  maya: { top: 0xe56b93, topAccent: 0xfff0f5, topPattern: 'dots', sleeves: 'puff', sleeve: 0xf2a0c0, bottom: 'skirt', bottomColor: 0xe56b93, bottomAccent: 0xfff0f5, bottomPattern: 'dots' },
  ori: { top: 0x3d7a9a, sleeves: 'long', sleeve: 0x2f6278, bottom: 'pants', bottomColor: 0x3a3f4a, head: 'kippah', peyot: true },
  tala: { top: 0xe2b143, sleeves: 'short', sleeve: 0xf0d48a, bottom: 'skirt', bottomColor: 0x6e4b32, collar: 0xfff6e4 },
  roni: { top: 0x2f8a4a, topAccent: 0xf4f7f2, topPattern: 'band', sleeves: 'short', sleeve: 0xf4f7f2, bottom: 'shorts', bottomColor: 0x24324a, head: 'kippah', kippah: 0x24324a, peyot: true },
  brother: { top: 0x3a4e86, sleeves: 'short', sleeve: 0x3a4e86, bottom: 'pants', bottomColor: 0xe07a32, bib: 0xe07a32, head: 'kippah', kippah: 0x1d4e89, peyot: true },
  sister: { top: 0x5c8a7a, sleeves: 'long', sleeve: 0x4a7366, bottom: 'pants', bottomColor: 0x39425c, tunic: true },
  mom: { top: 0xc4537a, sleeves: 'short', sleeve: 0xd67a9a, bottom: 'longskirt', bottomColor: 0x3e4c6a, collar: 0xf8e4ec, head: 'scarf', scarf: 0xc4537a },
  dad: { top: 0xf7f4ef, sleeves: 'long', sleeve: 0xf7f4ef, bottom: 'pants', bottomColor: 0x1c2433, collar: 0xf7f4ef, head: 'hat', peyot: true, jacket: 0x1a2744, tie: 0x7a1f2b },
  teacher: { top: 0x2c4460, sleeves: 'long', sleeve: 0x2c4460, bottom: 'pencil', bottomColor: 0x4a3b32, collar: 0xf7f4ef },
  shopkeeper: { top: 0xc4473a, sleeves: 'short', sleeve: 0xa33a30, bottom: 'pants', bottomColor: 0x3a342e, apron: 0xe4d2ae, head: 'kippah', peyot: true },
  noam: { top: 0x4c6b8a, topAccent: 0xe4ebf4, topPattern: 'band', sleeves: 'none', bottom: 'pants', bottomColor: 0xc2b48a, bottomAccent: 0x4c6b8a, bottomPattern: 'band', head: 'kippah', kippah: 0x1a1a1a, peyot: true },
  dani: { top: 0xe6d39a, sleeves: 'short', sleeve: 0xe6d39a, bottom: 'shorts', bottomColor: 0x3d5a86, vest: 'open', vestColor: 0x6b4228, head: 'kippah', kippah: 0x2a2a2a, peyot: true },
  neighbor: { top: 0x6e9a5e, topAccent: 0xf3d36a, topPattern: 'floral', sleeves: 'long', sleeve: 0x5e8a52, bottom: 'longskirt', bottomColor: 0xf6f1e6, bottomAccent: 0xc45b7a, bottomPattern: 'floral' },
  zookeeper: { top: 0xc2b48a, sleeves: 'short', sleeve: 0xc2b48a, bottom: 'pants', bottomColor: 0x6a5a3a, vest: 'front', vestColor: 0x3e4a3a, pockets: true },
};

const CLOTHES = new Set(['shirt', 'pants', 'belt', 'vest', 'detail', 'details', 'main', 'brown', 'black']);

const materialCache = new Map<string, THREE.MeshStandardMaterial>();
const geometryCache = new Map<string, THREE.BufferGeometry>();

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _euler = new THREE.Euler();
const _geo = new THREE.Matrix4();
const _local = new THREE.Matrix4();

export function dressCharacter(root: THREE.Object3D, id: string): void {
  const dressed = root as THREE.Object3D & { userData: { dressed?: boolean } };
  if (dressed.userData.dressed) return;
  dressed.userData.dressed = true;

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const clothing = materials.some((material) => CLOTHES.has((material.name || '').toLowerCase()));
    if (clothing) mesh.visible = false;
  });

  let skeleton: THREE.Skeleton | undefined;
  root.traverse((obj) => {
    const skinned = obj as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh && !skeleton) skeleton = skinned.skeleton;
  });
  if (!skeleton) return;

  const outfit = OUTFITS[id] ?? OUTFITS.yael;
  for (const piece of piecesFor(outfit)) attach(skeleton, piece);
}

function piecesFor(outfit: Outfit): Piece[] {
  const pieces: Piece[] = [];
  const shirtHeight = outfit.tunic ? 1.08 : 0.9;
  const shirtY = outfit.tunic ? 1.5 : 1.62;
  pieces.push(cyl('Torso', 0.3, 0.33, shirtHeight, [0, shirtY, -0.04], outfit.top, outfit.topPattern, outfit.topAccent, [1.42, 1, 1.08]));

  if (outfit.collar !== undefined) {
    pieces.push(cyl('Torso', 0.17, 0.19, 0.08, [0, shirtY + shirtHeight * 0.46, 0.02], outfit.collar, 'solid', outfit.collar, [1.3, 1, 1.1]));
  }

  const sleeve = outfit.sleeve ?? outfit.top;
  if (outfit.sleeves === 'short') {
    pieces.push(...armPair('UpperArm', 0.2, 0.16, 0.5, 0.3, sleeve));
  } else if (outfit.sleeves === 'puff') {
    pieces.push(...armPair('UpperArm', 0.26, 0.16, 0.42, 0.28, sleeve));
  } else if (outfit.sleeves === 'long') {
    pieces.push(...armPair('UpperArm', 0.19, 0.155, 0.52, 0.3, sleeve));
    pieces.push(...armPair('LowerArm', 0.16, 0.13, 0.42, 0.84, sleeve));
  }

  if (outfit.bottom === 'shorts') {
    pieces.push(cyl('Hips', 0.33, 0.31, 0.52, [0, 0.94, -0.04], outfit.bottomColor, 'solid', outfit.bottomColor, [1.15, 1, 1.1]));
  } else if (outfit.bottom === 'pants') {
    pieces.push(cyl('Hips', 0.36, 0.34, 0.58, [0, 1.02, -0.03], outfit.bottomColor, outfit.bottomPattern ?? 'solid', outfit.bottomAccent, [1.28, 1, 1.22]));
    pieces.push(...legPair('UpperLeg', 0.22, 0.18, 0.58, 0.78, outfit.bottomColor, outfit.bottomPattern, outfit.bottomAccent));
    pieces.push(...legPair('LowerLeg', 0.18, 0.145, 0.56, 0.32, outfit.bottomColor, outfit.bottomPattern, outfit.bottomAccent));
  } else if (outfit.bottom === 'skirt') {
    pieces.push(cyl('Hips', 0.34, 0.5, 0.82, [0, 0.82, -0.04], outfit.bottomColor, outfit.bottomPattern, outfit.bottomAccent, [1.1, 1, 1.12]));
  } else if (outfit.bottom === 'longskirt') {
    pieces.push(cyl('Hips', 0.33, 0.48, 1.05, [0, 0.7, -0.04], outfit.bottomColor, outfit.bottomPattern, outfit.bottomAccent, [1.08, 1, 1.1]));
  } else {
    pieces.push(cyl('Hips', 0.3, 0.33, 0.92, [0, 0.74, -0.04], outfit.bottomColor, 'solid', outfit.bottomColor, [1.02, 1, 1.04]));
  }

  if (outfit.hood !== undefined) {
    pieces.push({
      bone: 'Head',
      kind: 'sphere',
      size: [0.5, 18, 14],
      position: [0, 2.48, -0.1],
      scale: [1.45, 1.2, 1.05],
      color: outfit.hood,
    });
  }

  if (outfit.apron !== undefined) {
    pieces.push(box('Torso', [0.48, 0.64, 0.05], [0, 1.42, 0.32], outfit.apron, true));
    pieces.push(box('Torso', [0.08, 0.36, 0.04], [0, 1.9, 0.26], outfit.apron, true));
    pieces.push(box('Torso', [0.12, 0.1, 0.06], [0.12, 1.32, 0.36], 0xc45b4a, true));
  }

  if (outfit.vest && outfit.vestColor !== undefined) {
    const color = outfit.vestColor;
    pieces.push(box('Torso', [0.82, 0.64, 0.05], [0, 1.62, -0.4], color, true));
    pieces.push(box('Torso', [0.08, 0.64, 0.42], [-0.4, 1.62, -0.04], color, true));
    pieces.push(box('Torso', [0.08, 0.64, 0.42], [0.4, 1.62, -0.04], color, true));
    if (outfit.vest === 'front') pieces.push(box('Torso', [0.52, 0.6, 0.05], [0, 1.6, 0.34], color, true));
  }

  if (outfit.suspenders !== undefined) {
    pieces.push(box('Torso', [0.06, 0.74, 0.05], [-0.14, 1.62, 0.32], outfit.suspenders, true));
    pieces.push(box('Torso', [0.06, 0.74, 0.05], [0.14, 1.62, 0.32], outfit.suspenders, true));
  }

  if (outfit.bib !== undefined) {
    pieces.push(box('Torso', [0.5, 0.52, 0.06], [0, 1.48, 0.34], outfit.bib, true));
    pieces.push(box('Torso', [0.07, 0.44, 0.05], [-0.16, 1.82, 0.28], outfit.bib, true));
    pieces.push(box('Torso', [0.07, 0.44, 0.05], [0.16, 1.82, 0.28], outfit.bib, true));
  }

  if (outfit.pockets) {
    pieces.push(box('UpperLegL', [0.12, 0.12, 0.08], [0.4, 0.72, 0.06], 0x4a3e2c, true));
    pieces.push(box('UpperLegR', [0.12, 0.12, 0.08], [-0.4, 0.72, 0.06], 0x4a3e2c, true));
  }

  if (outfit.jacket !== undefined) {
    const color = outfit.jacket;
    pieces.push(box('Torso', [0.86, 0.82, 0.07], [0, 1.55, 0.38], color, true));
    pieces.push(box('Torso', [0.86, 0.82, 0.07], [0, 1.55, -0.4], color, true));
    pieces.push(box('Torso', [0.08, 0.78, 0.55], [-0.42, 1.52, -0.02], color, true));
    pieces.push(box('Torso', [0.08, 0.78, 0.55], [0.42, 1.52, -0.02], color, true));
  }
  if (outfit.tie !== undefined) {
    pieces.push(box('Torso', [0.07, 0.46, 0.04], [0, 1.5, 0.44], outfit.tie, true));
  }
  if (outfit.head === 'kippah') {
    pieces.push({
      bone: 'Head',
      kind: 'sphere',
      size: [0.26, 14, 10],
      position: [0, 3.08, 0.02],
      scale: [1.25, 0.48, 1.25],
      color: outfit.kippah ?? 0x161616,
    });
  }
  if (outfit.head === 'scarf') {
    const color = outfit.scarf ?? outfit.top;
    pieces.push({
      bone: 'Head',
      kind: 'sphere',
      size: [0.42, 16, 12],
      position: [0, 3.05, -0.08],
      scale: [1.4, 0.55, 1.35],
      color,
    });
    pieces.push(box('Head', [0.62, 0.14, 0.36], [0, 2.78, 0.16], color, true));
    pieces.push(box('Head', [0.34, 1.1, 0.08], [0.1, 1.82, -0.42], color, true));
  }
  if (outfit.head === 'hat') {
    pieces.push(cyl('Head', 0.2, 0.22, 0.42, [0, 3.22, 0.02], 0x141414));
    pieces.push(cyl('Head', 0.46, 0.46, 0.06, [0, 3.0, 0.02], 0x141414));
  }
  if (outfit.peyot) {
    const hair = 0x2a1a12;
    pieces.push(box('Head', [0.08, 0.78, 0.08], [0.32, 2.12, 0.2], hair, true));
    pieces.push(box('Head', [0.08, 0.78, 0.08], [-0.32, 2.12, 0.2], hair, true));
  }

  return pieces;
}

function cyl(
  bone: string,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  position: [number, number, number],
  color: number,
  pattern: Pattern = 'solid',
  accent?: number,
  scale?: [number, number, number],
): Piece {
  return { bone, kind: 'cyl', size: [radiusTop, radiusBottom, height], position, scale, color, pattern, accent };
}

function box(
  bone: string,
  size: [number, number, number],
  position: [number, number, number],
  color: number,
  offset = false,
): Piece {
  return { bone, kind: 'box', size, position, color, offset };
}

/** `start` is the distance from the body center along X to the inner end of the sleeve. */
function armPair(
  bone: 'UpperArm' | 'LowerArm',
  radiusTop: number,
  radiusBottom: number,
  length: number,
  start: number,
  color: number,
  pattern?: Pattern,
  accent?: number,
): Piece[] {
  const center = start + length / 2;
  const y = 1.87;
  const z = -0.02;
  return [
    {
      bone: `${bone}L`,
      kind: 'cyl',
      size: [radiusTop, radiusBottom, length],
      position: [center, y, z],
      rotation: [0, 0, -Math.PI / 2],
      color,
      pattern,
      accent,
    },
    {
      bone: `${bone}R`,
      kind: 'cyl',
      size: [radiusTop, radiusBottom, length],
      position: [-center, y, z],
      rotation: [0, 0, Math.PI / 2],
      color,
      pattern,
      accent,
    },
  ];
}

function legPair(
  bone: 'UpperLeg' | 'LowerLeg',
  radiusTop: number,
  radiusBottom: number,
  height: number,
  y: number,
  color: number,
  pattern?: Pattern,
  accent?: number,
): Piece[] {
  const x = 0.26;
  const z = y > 0.5 ? -0.02 : -0.02;
  return [x, -x].map((side) => ({
    bone: side > 0 ? `${bone}L` : `${bone}R`,
    kind: 'cyl' as const,
    size: [radiusTop, radiusBottom, height] as [number, number, number],
    position: [side, y, z] as [number, number, number],
    color,
    pattern,
    accent,
  }));
}

function attach(skeleton: THREE.Skeleton, piece: Piece): void {
  const index = skeleton.bones.findIndex((bone) => bone.name === piece.bone);
  const bone = skeleton.bones[index];
  const inverse = skeleton.boneInverses[index];
  if (!bone || !inverse) return;

  const mesh = makeMesh(piece);
  _pos.set(piece.position[0], piece.position[1], piece.position[2]);
  _euler.set(piece.rotation?.[0] ?? 0, piece.rotation?.[1] ?? 0, piece.rotation?.[2] ?? 0);
  _quat.setFromEuler(_euler);
  _scl.set(piece.scale?.[0] ?? 1, piece.scale?.[1] ?? 1, piece.scale?.[2] ?? 1);
  _geo.compose(_pos, _quat, _scl);
  _local.copy(inverse).multiply(_geo);
  _local.decompose(mesh.position, mesh.quaternion, mesh.scale);
  bone.add(mesh);
}

function makeMesh(piece: Piece): THREE.Mesh {
  const material = clothMaterial(piece.color, piece.accent ?? piece.color, piece.pattern ?? 'solid', Boolean(piece.offset));
  const mesh = new THREE.Mesh(geometryFor(piece), material);
  mesh.name = 'outfit';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  return mesh;
}

function geometryFor(piece: Piece): THREE.BufferGeometry {
  const key = `${piece.kind}:${piece.size.join(',')}`;
  const cached = geometryCache.get(key);
  if (cached) return cached;
  let geometry: THREE.BufferGeometry;
  if (piece.kind === 'box') {
    geometry = new THREE.BoxGeometry(piece.size[0], piece.size[1], piece.size[2]);
  } else if (piece.kind === 'sphere') {
    geometry = new THREE.SphereGeometry(piece.size[0], piece.size[1], piece.size[2]);
  } else {
    geometry = new THREE.CylinderGeometry(piece.size[0], piece.size[1], piece.size[2], 16, 1);
  }
  geometryCache.set(key, geometry);
  return geometry;
}

function clothMaterial(color: number, accent: number, pattern: Pattern, offset: boolean): THREE.MeshStandardMaterial {
  const key = `${color.toString(16)}-${accent.toString(16)}-${pattern}-${offset ? 1 : 0}`;
  const cached = materialCache.get(key);
  if (cached) return cached;

  const material = new THREE.MeshStandardMaterial({
    color: pattern === 'solid' ? color : 0xffffff,
    roughness: 0.78,
    metalness: 0,
  });
  if (pattern !== 'solid') material.map = patternTexture(color, accent, pattern);
  if (offset) {
    material.polygonOffset = true;
    material.polygonOffsetFactor = -2;
    material.polygonOffsetUnits = -2;
  }
  materialCache.set(key, material);
  return material;
}

function patternTexture(color: number, accent: number, pattern: Pattern): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.fillStyle = css(color);
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = css(accent);
  if (pattern === 'stripes') {
    for (let y = 0; y < 128; y += 16) ctx.fillRect(0, y, 128, 6);
  } else if (pattern === 'dots') {
    for (let y = 12; y < 128; y += 28) {
      for (let x = 12; x < 128; x += 28) {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (pattern === 'plaid' || pattern === 'checks') {
    for (let i = 0; i < 128; i += 20) {
      ctx.fillRect(i, 0, pattern === 'checks' ? 10 : 4, 128);
      ctx.fillRect(0, i, 128, pattern === 'checks' ? 10 : 4);
    }
  } else if (pattern === 'band') {
    ctx.fillRect(0, 48, 128, 22);
  } else if (pattern === 'floral') {
    for (let i = 0; i < 7; i++) {
      const x = 16 + (i * 37) % 112;
      const y = 18 + (i * 53) % 100;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (pattern === 'buttons') {
    ctx.fillRect(60, 8, 8, 112);
    ctx.fillStyle = css(color);
    for (let y = 22; y < 118; y += 24) {
      ctx.beginPath();
      ctx.arc(64, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
