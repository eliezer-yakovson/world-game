import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { cloneCached, loadGlb } from './AssetLoader';

export interface DressSpec {
  prop: string;
  fit: 'height' | 'width' | 'road';
  value: number;
  folder?: 'props' | 'animals';
}

const PROP_IDS = [
  'building-type-a',
  'building-type-b',
  'building-type-c',
  'building-type-e',
  'building-type-l',
  'tree-large',
  'tree-small',
  'fence',
  'road-straight',
  'light-curved',
  'road-sign-stop',
  'traffic-light',
  'sedan',
  'suv',
  'taxi',
  'van',
  'hatchback-sports',
  'tree_oak',
  'tree_default',
  'tree_pineDefaultA',
  'loungeSofa',
  'loungeChair',
  'tableCoffee',
  'bedSingle',
  'kitchenFridge',
  'radio',
  'pottedPlant',
  'bookcaseOpen',
  'rugRectangle',
  'table',
];

const ANIMAL_IDS = ['Wolf', 'Horse', 'Fox', 'Deer', 'ShibaInu', 'Husky', 'Cow'];

const PROP_FOLDER: Record<string, string> = {
  'building-type-a': 'suburban',
  'building-type-b': 'suburban',
  'building-type-c': 'suburban',
  'building-type-e': 'suburban',
  'building-type-l': 'suburban',
  'tree-large': 'suburban',
  'tree-small': 'suburban',
  fence: 'suburban',
  'road-straight': 'roads',
  'light-curved': 'roads',
  'road-sign-stop': 'roads',
  'traffic-light': 'roads',
  sedan: 'cars',
  suv: 'cars',
  taxi: 'cars',
  van: 'cars',
  'hatchback-sports': 'cars',
  tree_oak: 'nature',
  tree_default: 'nature',
  tree_pineDefaultA: 'nature',
  loungeSofa: 'furniture',
  loungeChair: 'furniture',
  tableCoffee: 'furniture',
  bedSingle: 'furniture',
  kitchenFridge: 'furniture',
  radio: 'furniture',
  pottedPlant: 'furniture',
  bookcaseOpen: 'furniture',
  rugRectangle: 'furniture',
  table: 'furniture',
  'bowl-soup': 'food',
  apple: 'food',
  bread: 'food',
  burger: 'food',
  carrot: 'food',
  grass_large: 'nature',
  log_large: 'nature',
  stump_round: 'nature',
  rock_smallA: 'nature',
  rock_smallB: 'nature',
  'animal-cat': 'pets',
  'animal-bunny': 'pets',
  'animal-dog': 'pets',
  'animal-chick': 'pets',
};

const EXTRA_MODELS: Array<[string, string]> = [
  ['food', 'apple'],
  ['food', 'apple-half'],
  ['food', 'banana'],
  ['food', 'bread'],
  ['food', 'burger'],
  ['food', 'cake'],
  ['food', 'cake-birthday'],
  ['food', 'bowl-soup'],
  ['food', 'candy-bar'],
  ['food', 'carrot'],
  ['food', 'broccoli'],
  ['food', 'carton'],
  ['food', 'bottle-ketchup'],
  ['food', 'cup'],
  ['food', 'plate'],
  ['food', 'pizza'],
  ['food', 'donut'],
  ['food', 'cookie'],
  ['food', 'sandwich'],
  ['food', 'ice-cream'],
  ['food', 'mug'],
  ['food', 'can'],
  ['furniture', 'bear'],
  ['furniture', 'books'],
  ['furniture', 'lampRoundTable'],
  ['furniture', 'pillow'],
  ['furniture', 'pillowBlue'],
  ['furniture', 'plantSmall1'],
  ['furniture', 'plantSmall2'],
  ['furniture', 'toaster'],
  ['furniture', 'kitchenMicrowave'],
  ['furniture', 'kitchenCoffeeMachine'],
  ['furniture', 'televisionModern'],
  ['furniture', 'sideTable'],
  ['nature', 'flower_redA'],
  ['nature', 'flower_yellowA'],
  ['nature', 'flower_purpleA'],
  ['nature', 'plant_bush'],
  ['nature', 'plant_bushSmall'],
  ['nature', 'mushroom_red'],
  ['nature', 'rock_smallA'],
  ['nature', 'rock_smallB'],
  ['nature', 'grass_large'],
  ['nature', 'log_large'],
  ['nature', 'stump_round'],
  ['nature', 'lily_small'],
  ['holiday', 'present-a-cube'],
  ['holiday', 'present-b-rectangle'],
  ['holiday', 'sled'],
  ['holiday', 'snowman'],
  ['holiday', 'tree-decorated'],
  ['holiday', 'lights-colored'],
  ['holiday', 'wreath'],
  ['skate', 'skateboard'],
  ['skate', 'rail-low'],
  ['skate', 'half-pipe'],
  ['market', 'display-fruit'],
  ['market', 'shopping-basket'],
  ['market', 'shopping-cart'],
  ['market', 'cash-register'],
  ['pets', 'animal-cat'],
  ['pets', 'animal-bunny'],
  ['pets', 'animal-dog'],
  ['pets', 'animal-chick'],
];

let ready = false;

export function propsReady(): boolean {
  return ready;
}

export async function preloadProps(): Promise<void> {
  await Promise.all([
    ...PROP_IDS.map((id) => loadGlb(propUrl({ prop: id }), 1)),
    ...ANIMAL_IDS.map((id) => loadGlb(`/assets/models/animals/${id}.gltf`, 1)),
    ...EXTRA_MODELS.map(([folder, id]) => loadGlb(`/assets/models/props/${folder}/${id}.glb`, 1)),
  ]);
  ready = true;
}

function propUrl(spec: Pick<DressSpec, 'prop' | 'folder'>): string {
  if (spec.folder === 'animals') return `/assets/models/animals/${spec.prop}.gltf`;
  const folder = PROP_FOLDER[spec.prop] ?? 'furniture';
  return `/assets/models/props/${folder}/${spec.prop}.glb`;
}

function sourceFor(spec: DressSpec): THREE.Group | null {
  return cloneCached(propUrl(spec));
}

function hasSkinnedMesh(source: THREE.Object3D): boolean {
  let skinned = false;
  source.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) skinned = true;
  });
  return skinned;
}

export function fitClone(source: THREE.Object3D, spec: Pick<DressSpec, 'fit' | 'value'>): THREE.Group {
  // Object3D.clone leaves a skinned mesh bound to the source bones, so the
  // animal draws at the origin instead of inside its pen.
  const model = (hasSkinnedMesh(source) ? cloneSkinned(source) : source.clone(true)) as THREE.Object3D;
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  model.scale.set(1, 1, 1);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const basis = spec.fit === 'width' ? Math.max(size.x, size.z) : size.y;
  const scale = spec.value / (basis || 1);
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(model);
  const center = fitted.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -fitted.min.y, -center.z);
  const wrap = new THREE.Group();
  wrap.add(model);
  return wrap;
}

export function trafficLightModel(height = 3.25): THREE.Group | null {
  if (!ready) return null;
  const src = cloneCached('/assets/models/props/roads/traffic-light.glb');
  if (!src) return null;
  return fitClone(src, { fit: 'height', value: height });
}

/** Kenney cars face +Z; Three.js lookAt aims -Z, so turn the model around. */
export function vehicleModel(id: string, height: number): THREE.Group | null {
  if (!ready) return null;
  const src = cloneCached(`/assets/models/props/cars/${id}.glb`);
  if (!src) return null;
  const fitted = fitClone(src, { fit: 'height', value: height });
  fitted.rotation.y = Math.PI;
  return fitted;
}

function hideVisuals(obj: THREE.Object3D): void {
  const hide = (mesh: THREE.Object3D) => {
    if ((mesh as THREE.Mesh).isMesh && mesh.name !== 'streetlamp') mesh.visible = false;
  };
  hide(obj);
  obj.traverse((child) => {
    if (child !== obj) hide(child);
  });
}

function placeOnBounds(root: THREE.Group, bounds: THREE.Box3, model: THREE.Group, y: number): void {
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.set(center.x, y, center.z);
  root.add(model);
}

function roadTiles(source: THREE.Object3D, bounds: THREE.Box3): THREE.Group {
  const size = bounds.getSize(new THREE.Vector3());
  const alongX = size.x >= size.z;
  const roadWidth = Math.min(size.x, size.z);
  const roadLength = Math.max(size.x, size.z);

  const piece = source.clone(true);
  piece.position.set(0, 0, 0);
  piece.rotation.set(0, 0, 0);
  piece.scale.set(1, 1, 1);
  piece.updateMatrixWorld(true);
  let pieceBox = new THREE.Box3().setFromObject(piece);
  let pieceSize = pieceBox.getSize(new THREE.Vector3());
  if ((pieceSize.x >= pieceSize.z) !== alongX) {
    piece.rotation.y = Math.PI / 2;
    piece.updateMatrixWorld(true);
    pieceBox = new THREE.Box3().setFromObject(piece);
    pieceSize = pieceBox.getSize(new THREE.Vector3());
  }

  const long0 = alongX ? pieceSize.x : pieceSize.z;
  const short0 = alongX ? pieceSize.z : pieceSize.x;
  const scale = roadWidth / (short0 || 1);
  piece.scale.setScalar(scale);
  piece.updateMatrixWorld(true);
  pieceBox = new THREE.Box3().setFromObject(piece);
  const center = pieceBox.getCenter(new THREE.Vector3());
  piece.position.set(-center.x, -pieceBox.min.y, -center.z);

  const tileLength = Math.max(long0 * scale, 0.5);
  const count = Math.min(28, Math.max(1, Math.round(roadLength / tileLength)));
  const tiles = new THREE.Group();
  const origin = bounds.getCenter(new THREE.Vector3());
  const start = -((count - 1) * tileLength) / 2;
  for (let i = 0; i < count; i++) {
    const tile = piece.clone(true);
    const offset = start + i * tileLength;
    if (alongX) tile.position.x += offset;
    else tile.position.z += offset;
    tiles.add(tile);
  }
  tiles.position.set(origin.x, bounds.max.y + 0.01, origin.z);
  tiles.userData.noCollide = true;
  return tiles;
}

function applyDress(root: THREE.Group, obj: THREE.Object3D, spec: DressSpec): void {
  const src = sourceFor(spec);
  if (!src) return;
  const bounds = new THREE.Box3().setFromObject(obj);
  if (bounds.isEmpty()) return;

  if (spec.fit === 'road') {
    root.add(roadTiles(src, bounds));
    hideVisuals(obj);
    return;
  }

  const model = fitClone(src, spec);
  if (obj.userData.noCollide) {
    model.traverse((child) => {
      child.userData.noCollide = true;
    });
  }
  if (obj.userData.dressStick) {
    hideVisuals(obj);
    model.position.set(0, 0, 0);
    obj.add(model);
    return;
  }
  placeOnBounds(root, bounds, model, bounds.min.y);
  hideVisuals(obj);
}

function addNeighborhoodExtras(root: THREE.Group): void {
  if (!root.getObjectByName('home-green')) return;
  const signSrc = cloneCached('/assets/models/props/roads/road-sign-stop.glb');
  if (signSrc) {
    const sign = fitClone(signSrc, { fit: 'height', value: 2.3 });
    sign.position.set(2.4, 0, 5.9);
    root.add(sign);
  }
}

function addHomeExtras(root: THREE.Group): void {
  if (root.userData.homeKind !== 'player' || !root.getObjectByName('furniture-sofa')) return;
  const plantSrc = cloneCached('/assets/models/props/furniture/pottedPlant.glb');
  if (!plantSrc) return;
  const plant = fitClone(plantSrc, { fit: 'height', value: 0.85 });
  plant.position.set(-8.4, 0, 8.2);
  root.add(plant);
}

interface ScatterItem {
  folder: string;
  model: string;
  x: number;
  z: number;
  height: number;
  y?: number;
  yaw?: number;
  solid?: boolean;
}

function placeScatter(root: THREE.Group, item: ScatterItem): void {
  const src = cloneCached(`/assets/models/props/${item.folder}/${item.model}.glb`);
  if (!src) return;
  const model = fitClone(src, { fit: 'height', value: item.height });
  model.position.set(item.x, item.y ?? 0, item.z);
  if (item.yaw) model.rotation.y = item.yaw;
  if (!item.solid) {
    model.traverse((child) => {
      child.userData.noCollide = true;
    });
  }
  root.add(model);
}

function homeScatter(kind: string): ScatterItem[] {
  if (kind === 'blue') {
    return [
      { folder: 'food', model: 'mug', x: 9.0, z: 6.7, y: 0.5, height: 0.12 },
      { folder: 'food', model: 'cookie', x: 9.5, z: 6.85, y: 0.5, height: 0.07 },
      { folder: 'skate', model: 'skateboard', x: -11.2, z: 2.4, height: 0.12 },
      { folder: 'furniture', model: 'bear', x: -7.6, z: 5.2, height: 0.4 },
      { folder: 'furniture', model: 'books', x: -13.4, z: 4.6, y: 0.85, height: 0.16 },
      { folder: 'holiday', model: 'present-b-rectangle', x: -14.2, z: 8.35, y: 0.62, height: 0.22 },
      { folder: 'nature', model: 'flower_purpleA', x: 3.6, z: 5.4, height: 0.4 },
      { folder: 'food', model: 'cup', x: 6.6, z: -8.2, y: 0.86, height: 0.12 },
      { folder: 'food', model: 'donut', x: 7.1, z: -8.05, y: 0.84, height: 0.08 },
    ];
  }
  if (kind === 'yellow') {
    return [
      { folder: 'nature', model: 'flower_yellowA', x: 4.4, z: 8.2, height: 0.42 },
      { folder: 'nature', model: 'flower_redA', x: 10.6, z: 5.6, height: 0.4 },
      { folder: 'nature', model: 'flower_purpleA', x: -6.2, z: 9.2, height: 0.4 },
      { folder: 'nature', model: 'lily_small', x: 6.4, z: 4.8, height: 0.34 },
      { folder: 'holiday', model: 'wreath', x: -8.6, z: 8.7, y: 1.15, height: 0.4 },
      { folder: 'food', model: 'cake', x: -1.5, z: 6.5, y: 0.66, height: 0.16 },
      { folder: 'food', model: 'cookie', x: -1.1, z: 6.7, y: 0.64, height: 0.07 },
      { folder: 'food', model: 'apple', x: -6.4, z: -6.2, y: 0.86, height: 0.16 },
      { folder: 'food', model: 'bread', x: -5.8, z: -6.35, y: 0.86, height: 0.14 },
      { folder: 'food', model: 'carrot', x: -6.8, z: -6.45, y: 0.86, height: 0.16 },
      { folder: 'furniture', model: 'books', x: 13.6, z: -3.2, y: 0.85, height: 0.16 },
      { folder: 'holiday', model: 'present-a-cube', x: 12.2, z: -4.6, height: 0.24 },
    ];
  }
  return [
    { folder: 'food', model: 'apple', x: 6.3, z: -6.2, y: 0.9, height: 0.16 },
    { folder: 'food', model: 'bread', x: 6.9, z: -6.35, y: 0.9, height: 0.14 },
    { folder: 'food', model: 'plate', x: 6.6, z: -5.9, y: 0.88, height: 0.06 },
    { folder: 'food', model: 'cup', x: 7.15, z: -6.05, y: 0.9, height: 0.12 },
    { folder: 'food', model: 'carrot', x: 9.4, z: -10.5, y: 1.05, height: 0.16 },
    { folder: 'food', model: 'broccoli', x: 10.1, z: -10.5, y: 1.05, height: 0.18 },
    { folder: 'furniture', model: 'toaster', x: 11.2, z: -10.5, y: 1.05, height: 0.26 },
    { folder: 'furniture', model: 'kitchenCoffeeMachine', x: 12.2, z: -10.45, y: 1.05, height: 0.32 },
    { folder: 'food', model: 'cake', x: 0.05, z: 5.15, y: 0.5, height: 0.16 },
    { folder: 'food', model: 'banana', x: 0.45, z: 5.3, y: 0.5, height: 0.12 },
    { folder: 'food', model: 'candy-bar', x: -12.7, z: 2.15, y: 0.85, height: 0.08 },
    { folder: 'food', model: 'cookie', x: -12.3, z: 2.35, y: 0.85, height: 0.06 },
    { folder: 'furniture', model: 'bear', x: -11.2, z: 7.5, height: 0.42 },
    { folder: 'holiday', model: 'present-a-cube', x: -10.2, z: 7.8, height: 0.24 },
    { folder: 'furniture', model: 'books', x: -4.6, z: 9.4, y: 1.45, height: 0.16 },
    { folder: 'food', model: 'ice-cream', x: -9.6, z: 8.4, height: 0.2 },
  ];
}

function scatterZone(root: THREE.Group): void {
  const piles: Record<string, ScatterItem[]> = {
    'zone-home': [],
    'zone-park': [
      { folder: 'nature', model: 'flower_redA', x: -8, z: 6, height: 0.45 },
      { folder: 'nature', model: 'flower_yellowA', x: -6, z: -6, height: 0.4 },
      { folder: 'nature', model: 'flower_purpleA', x: 7, z: -8, height: 0.42 },
      { folder: 'nature', model: 'flower_redA', x: 13, z: 6, height: 0.4 },
      { folder: 'nature', model: 'plant_bush', x: -14, z: -4, height: 1.1, solid: true },
      { folder: 'nature', model: 'plant_bushSmall', x: 4, z: 8, height: 0.7 },
      { folder: 'nature', model: 'mushroom_red', x: -11, z: 8, height: 0.28 },
      { folder: 'nature', model: 'rock_smallA', x: 2, z: -8, height: 0.4, solid: true },
      { folder: 'nature', model: 'rock_smallB', x: 15, z: 2, height: 0.35, solid: true },
      { folder: 'nature', model: 'grass_large', x: -3, z: 8, height: 0.35 },
      { folder: 'nature', model: 'log_large', x: -15, z: 8, height: 0.4, solid: true },
      { folder: 'nature', model: 'stump_round', x: 12, z: -8, height: 0.4, solid: true },
      { folder: 'nature', model: 'lily_small', x: -2, z: 11, height: 0.35 },
      { folder: 'skate', model: 'skateboard', x: 6, z: 5, height: 0.12 },
      { folder: 'skate', model: 'rail-low', x: 11, z: 7, height: 0.55, solid: true },
      { folder: 'skate', model: 'half-pipe', x: 16, z: -6, height: 1.6, yaw: 0.4, solid: true },
      { folder: 'holiday', model: 'sled', x: 3, z: 3, height: 0.35 },
      { folder: 'holiday', model: 'present-b-rectangle', x: -5, z: 2, height: 0.28 },
      { folder: 'pets', model: 'animal-bunny', x: -8, z: 2, height: 0.4 },
      { folder: 'pets', model: 'animal-chick', x: 9, z: -2, height: 0.28 },
      { folder: 'holiday', model: 'snowman', x: -16, z: 12, height: 1.3, solid: true },
      { folder: 'holiday', model: 'tree-decorated', x: 18, z: 10, height: 2.4, solid: true },
    ],
    'zone-shop': [
      { folder: 'market', model: 'display-fruit', x: -7.6, z: -6.4, height: 1.2 },
      { folder: 'market', model: 'cash-register', x: 0.55, z: 4.55, y: 1.08, height: 0.28 },
      { folder: 'market', model: 'shopping-basket', x: 2.4, z: 2.2, height: 0.32 },
      { folder: 'market', model: 'shopping-cart', x: 7.4, z: -6.2, height: 0.95 },
      { folder: 'food', model: 'apple', x: -5.7, z: -4.5, y: 1.18, height: 0.18 },
      { folder: 'food', model: 'banana', x: -5.7, z: -3.9, y: 1.18, height: 0.14 },
      { folder: 'food', model: 'carrot', x: -5.7, z: -1.1, y: 1.18, height: 0.18 },
      { folder: 'food', model: 'broccoli', x: -5.7, z: -0.5, y: 1.18, height: 0.2 },
      { folder: 'food', model: 'bread', x: -5.7, z: 2.1, y: 1.18, height: 0.16 },
      { folder: 'food', model: 'cake', x: -5.7, z: 2.7, y: 1.18, height: 0.18 },
      { folder: 'food', model: 'burger', x: 5.7, z: -4.5, y: 1.18, height: 0.16 },
      { folder: 'food', model: 'sandwich', x: 5.7, z: -3.9, y: 1.18, height: 0.12 },
      { folder: 'food', model: 'pizza', x: 5.7, z: -1.1, y: 1.18, height: 0.1 },
      { folder: 'food', model: 'donut', x: 5.7, z: -0.5, y: 1.18, height: 0.1 },
      { folder: 'food', model: 'ice-cream', x: 5.7, z: 2.1, y: 1.18, height: 0.2 },
      { folder: 'food', model: 'cookie', x: 5.7, z: 2.7, y: 1.18, height: 0.08 },
      { folder: 'food', model: 'carton', x: -0.4, z: 4.55, y: 1.08, height: 0.2 },
      { folder: 'food', model: 'bottle-ketchup', x: 1.15, z: 4.55, y: 1.08, height: 0.22 },
      { folder: 'food', model: 'apple', x: -5.2, z: -4.2, y: 0.52, height: 0.16 },
      { folder: 'food', model: 'banana', x: -5.2, z: -0.8, y: 0.52, height: 0.14 },
      { folder: 'food', model: 'bread', x: -5.2, z: 2.4, y: 0.52, height: 0.16 },
      { folder: 'food', model: 'burger', x: 5.2, z: -4.2, y: 0.52, height: 0.16 },
      { folder: 'food', model: 'pizza', x: 5.2, z: -0.8, y: 0.52, height: 0.1 },
      { folder: 'food', model: 'donut', x: 5.2, z: 2.4, y: 0.52, height: 0.1 },
      { folder: 'food', model: 'cake', x: -5.2, z: -4.2, y: 1.82, height: 0.18 },
      { folder: 'food', model: 'cookie', x: -5.2, z: -0.8, y: 1.82, height: 0.08 },
      { folder: 'food', model: 'ice-cream', x: 5.2, z: -4.2, y: 1.82, height: 0.2 },
      { folder: 'food', model: 'sandwich', x: 5.2, z: -0.8, y: 1.82, height: 0.12 },
    ],
    'zone-neighborhood': [
      { folder: 'nature', model: 'flower_yellowA', x: -12, z: -8.2, height: 0.4 },
      { folder: 'nature', model: 'flower_redA', x: 0, z: -8.2, height: 0.4 },
      { folder: 'nature', model: 'flower_purpleA', x: 12, z: -8.2, height: 0.4 },
      { folder: 'nature', model: 'plant_bushSmall', x: -16, z: -6, height: 0.8, solid: true },
      { folder: 'nature', model: 'plant_bush', x: 16, z: -8, height: 1, solid: true },
      { folder: 'furniture', model: 'plantSmall2', x: -8, z: -8, height: 0.5 },
      { folder: 'furniture', model: 'bear', x: 8, z: -8, height: 0.4 },
      { folder: 'holiday', model: 'present-a-cube', x: 6, z: -7, height: 0.28 },
      { folder: 'nature', model: 'rock_smallA', x: -4, z: 8, height: 0.35, solid: true },
      { folder: 'nature', model: 'grass_large', x: 10, z: 6, height: 0.3 },
      { folder: 'skate', model: 'skateboard', x: -6, z: 7, height: 0.12 },
    ],
    'zone-school': [
      { folder: 'nature', model: 'flower_redA', x: 6, z: 8, height: 0.4 },
      { folder: 'nature', model: 'flower_yellowA', x: 12, z: 6, height: 0.38 },
      { folder: 'nature', model: 'plant_bushSmall', x: 14, z: 1, height: 0.7 },
      { folder: 'skate', model: 'skateboard', x: 8, z: 6, height: 0.12 },
      { folder: 'holiday', model: 'present-b-rectangle', x: 4, z: 4, height: 0.26 },
      { folder: 'furniture', model: 'books', x: -13.1, z: -8.6, y: 0.78, height: 0.16 },
      { folder: 'nature', model: 'rock_smallB', x: -2, z: 8, height: 0.3, solid: true },
    ],
    'zone-zoo': [
      { folder: 'nature', model: 'flower_purpleA', x: -14, z: 4.6, height: 0.42 },
      { folder: 'nature', model: 'flower_yellowA', x: 14, z: -4.6, height: 0.42 },
      { folder: 'nature', model: 'flower_redA', x: 26, z: 18, height: 0.4 },
      { folder: 'nature', model: 'plant_bush', x: -40, z: 8, height: 1.1, solid: true },
      { folder: 'nature', model: 'plant_bushSmall', x: 40, z: -8, height: 0.8, solid: true },
      { folder: 'nature', model: 'lily_small', x: -26, z: 18, height: 0.32 },
      { folder: 'holiday', model: 'wreath', x: 6, z: 22, height: 0.5 },
    ],
  };
  const items = root.name === 'zone-home' ? homeScatter(String(root.userData.homeKind ?? 'player')) : (piles[root.name] ?? []);
  for (const item of items) placeScatter(root, item);
}

/** Replace tagged placeholder meshes with Kenney / Quaternius models. Safe to call once per zone group. */
export function dressZone(root: THREE.Group): void {
  if (!ready || root.userData.dressed) return;
  const jobs: THREE.Object3D[] = [];
  root.traverse((obj) => {
    if (obj.userData?.dress) jobs.push(obj);
  });
  for (const obj of jobs) applyDress(root, obj, obj.userData.dress as DressSpec);
  addNeighborhoodExtras(root);
  addHomeExtras(root);
  scatterZone(root);
  root.userData.dressed = true;
}
