import * as THREE from 'three';
import { box, cyl, mats } from './materials';
import type { ZoneId } from '../core/types';

export interface Interactable {
  id: string;
  label: string;
  position: THREE.Vector3;
  radius: number;
  type:
    | 'door'
    | 'item'
    | 'npc'
    | 'shop'
    | 'vehicle'
    | 'phone'
    | 'album'
    | 'furniture'
    | 'activity'
    | 'bus'
    | 'parent_car'
    | 'ride';
  data?: Record<string, unknown>;
  mesh?: THREE.Object3D;
}

export interface ZoneBuildResult {
  group: THREE.Group;
  interactables: Interactable[];
  spawn: THREE.Vector3;
  npcSpawns: Array<{ id: string; position: THREE.Vector3 }>;
  carPath?: THREE.Vector3[];
  carLanes?: THREE.Vector3[][];
  trafficLights?: TrafficLightSpot[];
}

export interface TrafficLightSpot {
  x: number;
  z: number;
  /** Which road this head governs: x is east-west, z is north-south. */
  axis: 'x' | 'z';
  faceX: number;
  faceZ: number;
}

function house(x: number, z: number, wall: THREE.Material, name: string): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.add(box(6, 3.2, 5, wall, x, 1.6, z));
  const roof = box(6.6, 0.4, 5.6, mats.roof, x, 3.5, z);
  g.add(roof);
  g.add(box(1.2, 2, 0.15, mats.wood, x, 1, z + 2.55));
  g.add(box(1, 1, 0.1, mats.glass, x - 1.8, 1.8, z + 2.55));
  g.add(box(1, 1, 0.1, mats.glass, x + 1.8, 1.8, z + 2.55));
  return g;
}

function tree(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'prop-tree';
  const options = ['tree-large', 'tree-small', 'tree_oak', 'tree_default', 'tree_pineDefaultA'] as const;
  const prop = options[Math.abs(Math.round(x * 3 + z * 7)) % options.length];
  g.userData.dress = { prop, fit: 'height', value: prop === 'tree-small' ? 2.3 : 3.6 };
  g.add(cyl(0.25, 1.6, mats.wood, x, 0.8, z));
  const leaves = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), mats.grass);
  leaves.position.set(x, 2.4, z);
  leaves.castShadow = true;
  g.add(leaves);
  return g;
}

function bench(x: number, z: number, rot = 0): THREE.Group {
  const g = new THREE.Group();
  const seat = box(1.8, 0.15, 0.55, mats.wood, x, 0.45, z);
  seat.rotation.y = rot;
  g.add(seat);
  g.add(box(0.12, 0.45, 0.55, mats.wood, x - 0.75, 0.22, z));
  g.add(box(0.12, 0.45, 0.55, mats.wood, x + 0.75, 0.22, z));
  return g;
}

export function buildZone(zone: ZoneId): ZoneBuildResult {
  switch (zone) {
    case 'neighborhood':
      return buildNeighborhood();
    case 'home':
      return buildHome('player');
    case 'home_blue':
      return buildHome('blue');
    case 'home_yellow':
      return buildHome('yellow');
    case 'school':
      return buildSchool();
    case 'shop':
      return buildShop();
    case 'park':
      return buildPark();
    case 'zoo':
      return buildZoo();
  }
}

const LANE_Y = 0.32;

function approach(from: [number, number], to: [number, number], dist: number): [number, number] {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz) || 1;
  const d = Math.min(dist, len * 0.4);
  return [to[0] - (dx / len) * d, to[1] - (dz / len) * d];
}

/** Closed lane. Corners are rounded so a car stays on the asphalt through the turn. */
function roundedLane(corners: Array<[number, number]>): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const prev = corners[(i - 1 + n) % n];
    const cur = corners[i];
    const next = corners[(i + 1) % n];
    const pin = approach(prev, cur, 3);
    const pout = approach(next, cur, 3);
    for (let s = 0; s <= 4; s++) {
      const t = s / 4;
      const u = 1 - t;
      pts.push(
        new THREE.Vector3(
          u * u * pin[0] + 2 * u * t * cur[0] + t * t * pout[0],
          LANE_Y,
          u * u * pin[1] + 2 * u * t * cur[1] + t * t * pout[1],
        ),
      );
    }
  }
  return pts;
}

function neighborhoodLanes(): THREE.Vector3[][] {
  const west = -24;
  const east = 26;
  const south = -24;
  const north = 22;
  const lane = 1.55;
  // Right-hand lanes: counter-clockwise on the inner side, clockwise on the outer side.
  const inner: Array<[number, number]> = [
    [west + lane, south + lane],
    [west + lane, north - lane],
    [east - lane, north - lane],
    [east - lane, south + lane],
  ];
  const outer: Array<[number, number]> = [
    [west - lane, south - lane],
    [east + lane, south - lane],
    [east + lane, north + lane],
    [west - lane, north + lane],
  ];
  const main = [
    [-30, -lane],
    [30, -lane],
    [32.6, -lane],
    [33.4, -0.7],
    [33.4, 0.7],
    [32.6, lane],
    [30, lane],
    [-30, lane],
    [-32.6, lane],
    [-33.4, 0.7],
    [-33.4, -0.7],
    [-32.6, -lane],
  ].map(([x, z]) => new THREE.Vector3(x, LANE_Y, z));
  return [roundedLane(inner), roundedLane(outer), main];
}

function neighborhoodLights(): TrafficLightSpot[] {
  const junctions: Array<[number, number]> = [
    [-24, 0],
    [26, 0],
    [-24, -24],
    [26, -24],
    [-24, 22],
    [26, 22],
    [0, 0],
  ];
  const lights: TrafficLightSpot[] = [];
  const o = 5.2;
  for (const [x, z] of junctions) {
    lights.push({ x: x - o, z: z + o, axis: 'x', faceX: x, faceZ: z });
    lights.push({ x: x + o, z: z - o, axis: 'z', faceX: x, faceZ: z });
  }
  return lights;
}

function addRoad(group: THREE.Group, width: number, depth: number, x: number, z: number): void {
  const mesh = box(width, 0.14, depth, mats.road, x, 0.02, z);
  mesh.userData.dress = { prop: 'road-straight', fit: 'road', value: 1 };
  group.add(mesh);
}

function zebra(group: THREE.Group, x: number, z: number, along: 'x' | 'z', mat: THREE.Material): void {
  for (let i = -2; i <= 2; i++) {
    const stripe =
      along === 'x'
        ? box(0.55, 0.04, 3.2, mat, x + i * 1.05, 0.11, z)
        : box(3.2, 0.04, 0.55, mat, x, 0.11, z + i * 1.05);
    stripe.userData.noCollide = true;
    group.add(stripe);
  }
}

function buildNeighborhood(): ZoneBuildResult {
  const group = new THREE.Group();
  group.name = 'zone-neighborhood';
  const interactables: Interactable[] = [];

  group.add(box(80, 0.2, 80, mats.grass, 0, -0.1, 0));
  // Main street plus a block to the south, a block to the north, and two cross streets.
  // The old side road at x=18 ran through the yellow house, so the east road sits past the houses.
  addRoad(group, 80, 8, 0, 0);
  addRoad(group, 74, 7, 0, -24);
  addRoad(group, 74, 7, 0, 22);
  addRoad(group, 7, 62, -24, -2);
  addRoad(group, 7, 62, 26, -2);
  // Sidewalks break at the cross streets so they don't pave over the junctions.
  for (const z of [5, -5]) {
    group.add(box(11.6, 0.12, 2.2, mats.sidewalk, -34.2, 0.04, z));
    group.add(box(41.4, 0.12, 2.2, mats.sidewalk, 1.1, 0.04, z));
    group.add(box(9.8, 0.12, 2.2, mats.sidewalk, 35.1, 0.04, z));
  }

  const paint = new THREE.MeshStandardMaterial({ color: 0xf4f4f4 });
  for (let i = -2; i <= 2; i++) {
    const stripe = box(0.6, 0.04, 3.5, paint, i * 1.1, 0.11, 0);
    stripe.userData.noCollide = true;
    group.add(stripe);
  }
  for (const [x, z] of [
    [-24, 0],
    [26, 0],
    [-24, -24],
    [26, -24],
    [-24, 22],
    [26, 22],
  ] as Array<[number, number]>) {
    zebra(group, x, z, 'x', paint);
    zebra(group, x, z, 'z', paint);
  }

  const homes: Array<[number, number, THREE.Material, string, string]> = [
    [-12, -12, mats.wallGreen, 'home-green', 'building-type-a'],
    [0, -12, mats.wallBlue, 'home-blue', 'building-type-b'],
    [12, -12, mats.wallYellow, 'home-yellow', 'building-type-c'],
    [-12, 12, mats.wall, 'school-block', 'building-type-l'],
    [14, 10, mats.wall, 'shop-block', 'building-type-e'],
  ];
  for (const [x, z, mat, name, prop] of homes) {
    const h = house(x, z, mat, name);
    h.userData.dress = { prop, fit: 'width', value: 7.4 };
    group.add(h);
  }

  for (const [x, z] of [
    [-20, -8],
    [-6, 8],
    [8, -8],
    [19.5, 6],
    [-18, 6],
  ]) {
    group.add(tree(x, z));
  }

  // Street lights
  for (const x of [-20, -5, 10, 20]) {
    const rig = new THREE.Group();
    rig.name = 'prop-lamp';
    rig.position.set(x, 0, 4.2);
    rig.userData.dress = { prop: 'light-curved', fit: 'height', value: 3.6 };
    rig.add(cyl(0.08, 3.2, mats.metal, 0, 1.6, 0));
    const lamp = box(0.5, 0.2, 0.5, new THREE.MeshStandardMaterial({ color: 0xffe6a0, emissive: 0x886622 }), 0, 3.3, 0);
    lamp.name = 'streetlamp';
    rig.add(lamp);
    group.add(rig);
  }

  // Signs
  const makeSign = (label: string, x: number, z: number, target: ZoneId) => {
    const sign = box(1.6, 1.1, 0.15, mats.wood, x, 1.2, z);
    sign.userData.sign = label;
    group.add(sign);
    interactables.push({
      id: `to-${target}`,
      label: `ללכת אל ${label}`,
      position: new THREE.Vector3(x, 0, z + 1.2),
      radius: 2.2,
      type: 'door',
      data: { target },
    });
  };

  makeSign('הבית שלי', -12, -9.2, 'home');
  makeSign('הבית הכחול', 0, -9.2, 'home_blue');
  makeSign('הבית הצהוב', 12, -9.2, 'home_yellow');
  makeSign('בית הספר', -12, 9.2, 'school');
  makeSign('המכולת', 14, 7.5, 'shop');
  makeSign('הפארק', 20.2, -6.6, 'park');
  makeSign('גן החיות', 18, -18, 'zoo');

  // Direct door hotspots at house fronts (easier discovery)
  interactables.push({
    id: 'door-home-green',
    label: 'להיכנס לבית שלי',
    position: new THREE.Vector3(-12, 0, -9.4),
    radius: 2.4,
    type: 'door',
    data: { target: 'home' },
  });
  interactables.push({
    id: 'door-home-blue',
    label: 'להיכנס לבית הכחול (נועם)',
    position: new THREE.Vector3(0, 0, -9.4),
    radius: 2.4,
    type: 'door',
    data: { target: 'home_blue' },
  });
  interactables.push({
    id: 'door-home-yellow',
    label: 'להיכנס לבית הצהוב (מאיה / דודה רחל)',
    position: new THREE.Vector3(12, 0, -9.4),
    radius: 2.4,
    type: 'door',
    data: { target: 'home_yellow' },
  });

  // Bus stop
  group.add(box(2.5, 0.1, 1.2, mats.sidewalk, -4, 0.1, 5.8));
  group.add(box(0.1, 2.2, 1.2, mats.metal, -5.1, 1.1, 5.8));
  interactables.push({
    id: 'bus-stop',
    label: 'לחכות לאוטובוס',
    position: new THREE.Vector3(-4, 0, 5.8),
    radius: 2,
    type: 'bus',
  });

  // Parent car spot
  const car = box(3.8, 0.8, 2.2, new THREE.MeshStandardMaterial({ color: 0x3d6ea8 }), 6, 0.5, -7.8);
  car.userData.dress = { prop: 'sedan', fit: 'height', value: 1.45 };
  group.add(car);
  interactables.push({
    id: 'parent-car',
    label: 'להיכנס להסעת ההורים',
    position: new THREE.Vector3(6, 0, -7.8),
    radius: 2.5,
    type: 'parent_car',
  });
  interactables.push({
    id: 'taxi',
    label: 'לקחת מונית קצרה',
    position: new THREE.Vector3(8, 0, 6.4),
    radius: 2.2,
    type: 'activity',
    data: { action: 'taxi' },
  });

  interactables.push({
    id: 'crosswalk',
    label: 'לחצות במעבר חצייה',
    position: new THREE.Vector3(0, 0, 0),
    radius: 2.5,
    type: 'activity',
    data: { situation: 'crosswalk' },
  });

  const carLanes = neighborhoodLanes();

  return {
    group,
    interactables,
    spawn: new THREE.Vector3(-8, 0, -5),
    npcSpawns: [
      { id: 'neighbor', position: new THREE.Vector3(10, 0, -10) },
      { id: 'noam', position: new THREE.Vector3(-2, 0, 6) },
      { id: 'maya', position: new THREE.Vector3(6, 0, 7) },
      { id: 'dani', position: new THREE.Vector3(2, 0, 8) },
    ],
    carPath: carLanes[2],
    carLanes,
    trafficLights: neighborhoodLights(),
  };
}

/** A wall run with doorway gaps. `along` is the wall's long axis. */
function addWall(
  group: THREE.Group,
  mat: THREE.Material,
  along: 'x' | 'z',
  fixed: number,
  from: number,
  to: number,
  gaps: Array<{ at: number; width: number }>,
): void {
  const height = 3.5;
  const thick = 0.22;
  const cuts = gaps.filter((gap) => gap.at - gap.width / 2 < to && gap.at + gap.width / 2 > from).sort((a, b) => a.at - b.at);
  let cursor = from;
  const place = (a: number, b: number) => {
    const length = b - a;
    if (length < 0.12) return;
    const mid = (a + b) / 2;
    const mesh =
      along === 'x'
        ? box(length, height, thick, mat, mid, height / 2, fixed)
        : box(thick, height, length, mat, fixed, height / 2, mid);
    mesh.name = 'room-wall';
    group.add(mesh);
  };
  for (const gap of cuts) {
    const gap0 = Math.max(from, gap.at - gap.width / 2);
    const gap1 = Math.min(to, gap.at + gap.width / 2);
    place(cursor, gap0);
    const header =
      along === 'x'
        ? box(gap1 - gap0, 0.18, 0.28, mats.wood, (gap0 + gap1) / 2, 2.72, fixed)
        : box(0.28, 0.18, gap1 - gap0, mats.wood, fixed, 2.72, (gap0 + gap1) / 2);
    header.userData.noCollide = true;
    header.name = 'door-header';
    group.add(header);
    cursor = gap1;
  }
  place(cursor, to);
}

function roomFloor(group: THREE.Group, color: number, x: number, z: number, w: number, d: number): void {
  const mesh = box(w, 0.03, d, new THREE.MeshStandardMaterial({ color, roughness: 0.82 }), x, 0.02, z);
  mesh.userData.noCollide = true;
  mesh.castShadow = false;
  mesh.name = 'room-floor';
  group.add(mesh);
}

function roomWindow(group: THREE.Group, x: number, z: number, wide: number, axis: 'x' | 'z'): void {
  const thin = 0.06;
  const t = 0.08;
  const glass =
    axis === 'x'
      ? box(wide, 1.05, thin, mats.glass, x, 1.7, z)
      : box(thin, 1.05, wide, mats.glass, x, 1.7, z);
  glass.userData.noCollide = true;
  glass.name = 'room-window';
  group.add(glass);
  const strips =
    axis === 'x'
      ? [
          box(wide + t * 2, t, 0.08, mats.wood, x, 2.26, z),
          box(wide + t * 2, t, 0.08, mats.wood, x, 1.14, z),
          box(t, 1.12, 0.08, mats.wood, x - wide / 2 - t / 2, 1.7, z),
          box(t, 1.12, 0.08, mats.wood, x + wide / 2 + t / 2, 1.7, z),
        ]
      : [
          box(0.08, t, wide + t * 2, mats.wood, x, 2.26, z),
          box(0.08, t, wide + t * 2, mats.wood, x, 1.14, z),
          box(0.08, 1.12, t, mats.wood, x, 1.7, z - wide / 2 - t / 2),
          box(0.08, 1.12, t, mats.wood, x, 1.7, z + wide / 2 + t / 2),
        ];
  for (const strip of strips) {
    strip.userData.noCollide = true;
    group.add(strip);
  }
}

function buildHome(kind: 'player' | 'blue' | 'yellow'): ZoneBuildResult {
  const group = new THREE.Group();
  group.name = 'zone-home';
  const interactables: Interactable[] = [];
  const wallMat = kind === 'blue' ? mats.wallBlue : kind === 'yellow' ? mats.wallYellow : mats.wall;
  const sofaColor = kind === 'blue' ? 0x3d6ea8 : kind === 'yellow' ? 0xd4a017 : 0x4a6fa5;

  group.add(box(18, 0.2, 14, mats.floor, 0, -0.1, 0));
  group.add(box(18, 3.5, 0.3, wallMat, 0, 1.75, -7));
  group.add(box(8, 3.5, 0.3, wallMat, -5, 1.75, 7));
  group.add(box(8, 3.5, 0.3, wallMat, 5, 1.75, 7));
  group.add(box(0.3, 3.5, 14, wallMat, -9, 1.75, 0));
  group.add(box(0.3, 3.5, 14, wallMat, 9, 1.75, 0));
  // Five rooms: bedroom and kitchen at the back, kids' room, living room and bathroom in front.
  const interior = new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.9 });
  const crossZ = -0.7;
  const kidsX = -3.45;
  const bathX = 4.55;
  const splitX = -0.9;
  addWall(group, interior, 'x', crossZ, -8.85, 8.85, [
    { at: -6.1, width: 1.6 },
    { at: -2.25, width: 1.6 },
    { at: 0.6, width: 1.85 },
    { at: 6.6, width: 1.6 },
  ]);
  addWall(group, interior, 'z', splitX, -6.85, -0.81, [{ at: -3.7, width: 1.6 }]);
  addWall(group, interior, 'z', kidsX, -0.59, 6.7, [{ at: 2.3, width: 1.65 }]);
  addWall(group, interior, 'z', bathX, -0.59, 6.7, [{ at: 2.3, width: 1.65 }]);

  roomFloor(group, 0xc9c3dc, -4.85, -3.75, 7.7, 5.7);
  roomFloor(group, 0xd7e0da, 3.95, -3.75, 9.5, 5.7);
  roomFloor(group, 0xf0d3a8, -6.15, 3.05, 5.2, 7.1);
  roomFloor(group, 0xc5dce6, 6.7, 3.05, 4.1, 7.1);

  roomWindow(group, -5.2, -6.68, 1.5, 'x');
  roomWindow(group, 3.6, -6.68, 1.6, 'x');
  roomWindow(group, -8.68, 3.6, 1.3, 'z');
  roomWindow(group, 8.68, 4.4, 1.2, 'z');
  roomWindow(group, 2.9, 6.68, 1.3, 'x');

  const sofa = box(2.5, 0.75, 1.05, new THREE.MeshStandardMaterial({ color: sofaColor }), -1.55, 0.4, 3.45);
  sofa.name = 'furniture-sofa';
  sofa.userData.dress = { prop: 'loungeSofa', fit: 'width', value: 2.5 };
  group.add(sofa);
  const coffee = box(1.15, 0.42, 0.7, mats.wood, 1.35, 0.24, 3.7);
  coffee.userData.dress = { prop: 'tableCoffee', fit: 'width', value: 1.15 };
  group.add(coffee);
  const fridge = box(0.9, 1.7, 0.75, mats.metal, 7.15, 0.85, -6.15);
  fridge.userData.dress = { prop: 'kitchenFridge', fit: 'height', value: 1.7 };
  group.add(fridge);
  const counter = box(1.55, 0.9, 0.62, mats.wood, 5.25, 0.45, -6.15);
  counter.name = 'kitchen-counter';
  group.add(counter);
  const crate = box(1.45, 0.75, 0.9, mats.wood, 3.3, 0.4, -4.3);
  crate.userData.dress = { prop: 'table', fit: 'height', value: 0.75 };
  group.add(crate);
  const bed = box(2.1, 0.5, 2.45, new THREE.MeshStandardMaterial({ color: 0x7aa2e3 }), -5.1, 0.28, -4.55);
  bed.userData.dress = { prop: 'bedSingle', fit: 'width', value: 2.1 };
  group.add(bed);
  const night = box(0.5, 0.5, 0.5, mats.wood, -3.25, 0.28, -5.55);
  night.userData.dress = { prop: 'lampRoundTable', fit: 'height', value: 0.5 };
  group.add(night);
  const desk = box(1.15, 0.7, 0.6, mats.wood, -6.35, 0.38, 2.15);
  desk.name = 'kids-desk';
  group.add(desk);
  const tub = box(1.35, 0.48, 0.62, new THREE.MeshStandardMaterial({ color: 0xf7f8fb, roughness: 0.35 }), 6.65, 0.28, 5.55);
  tub.name = 'bath-tub';
  group.add(tub);
  const washer = box(0.7, 0.9, 0.62, mats.metal, 8.15, 0.48, 4.55);
  washer.name = 'washer';
  group.add(washer);
  const sink = box(0.55, 0.72, 0.42, new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.4 }), 6.55, 0.4, 1.35);
  sink.name = 'sink';
  group.add(sink);
  interactables.push({
    id: `sit-sofa-${kind}`,
    label: 'לשבת על הספה',
    position: new THREE.Vector3(-1.55, 0, 2.55),
    radius: 1.55,
    type: 'activity',
    data: { action: 'sitSofa' },
  });

  const seat = box(0.7, 0.75, 0.7, new THREE.MeshStandardMaterial({ color: 0xe07a5f }), 2.7, 0.4, 2.35);
  seat.userData.dress = { prop: 'loungeChair', fit: 'width', value: 0.75 };
  group.add(seat);

  const rug = box(2.6, 0.04, 1.7, new THREE.MeshStandardMaterial({ color: 0xb85c38 }), -1.55, 0.03, 2.15);
  rug.userData.noCollide = true;
  rug.userData.dress = { prop: 'rugRectangle', fit: 'width', value: 2.6 };
  group.add(rug);
  const kidsRug = box(2.2, 0.04, 1.6, new THREE.MeshStandardMaterial({ color: 0x3d9b8f }), -6.1, 0.03, 3.7);
  kidsRug.userData.noCollide = true;
  group.add(kidsRug);
  const shelf = box(0.4, 1.55, 1.15, mats.wood, 8.2, 0.8, 2.7);
  shelf.userData.dress = { prop: 'bookcaseOpen', fit: 'height', value: 1.55 };
  group.add(shelf);

  const radio = box(0.5, 0.32, 0.35, mats.metal, 2.55, 0.2, 4.85);
  radio.userData.dress = { prop: 'radio', fit: 'height', value: 0.38 };
  group.add(radio);
  interactables.push({
    id: `radio-${kind}`,
    label: 'להדליק/לכבות מוזיקה',
    position: new THREE.Vector3(2.2, 0, 4.4),
    radius: 1.25,
    type: 'activity',
    data: { action: 'toggleMusic' },
  });

  if (kind === 'player') {
    const album = box(1.3, 0.9, 0.06, mats.wood, -8.62, 1.55, -3.4);
    album.userData.noCollide = true;
    group.add(album);
    interactables.push({
      id: 'album',
      label: 'לפתוח אלבום הצלחות',
      position: new THREE.Vector3(-7.7, 0, -3.4),
      radius: 1.5,
      type: 'album',
    });

    for (let i = 0; i < 5; i++) {
      const toy = box(0.32, 0.32, 0.32, mats.play, -7.3 + (i % 3) * 0.45, 0.18, 4.3 + Math.floor(i / 3) * 0.45);
      toy.name = `mess-toy-${i}`;
      toy.visible = false;
      group.add(toy);
    }

    const furniture = [
      { id: 'plant-pot', label: 'להזיז עציץ', x: 3.25, z: 0.95 },
      { id: 'chair', label: 'להזיז כיסא', x: 4.35, z: -3.35 },
      { id: 'toybox', label: 'להזיז ארגז צעצועים', x: -7.15, z: 4.75 },
    ];
    for (const f of furniture) {
      const mesh = box(0.7, 0.7, 0.7, mats.wood, f.x, 0.35, f.z);
      mesh.name = f.id;
      if (f.id === 'plant-pot') mesh.userData.dress = { prop: 'pottedPlant', fit: 'height', value: 0.6 };
      if (f.id === 'chair') mesh.userData.dress = { prop: 'loungeChair', fit: 'height', value: 0.8 };
      group.add(mesh);
      interactables.push({
        id: f.id,
        label: f.label,
        position: new THREE.Vector3(f.x, 0, f.z),
        radius: 1.6,
        type: 'furniture',
        mesh,
        data: { movable: true },
      });
    }

    const cup = cyl(0.12, 0.22, mats.glass, 3.55, 0.9, -4.15);
    cup.userData.noCollide = true;
    group.add(cup);
    interactables.push({
      id: 'spill-cup',
      label: 'לגעת בכוס על השולחן',
      position: new THREE.Vector3(2.3, 0, -3.6),
      radius: 1.4,
      type: 'activity',
      data: { situation: 'spilled_drink' },
    });

    interactables.push({
      id: 'lie-bed',
      label: 'לשכב על המיטה',
      position: new THREE.Vector3(-3.7, 0, -3.15),
      radius: 1.45,
      type: 'activity',
      data: { action: 'lieBed' },
    });

    interactables.push({
      id: 'fridge',
      label: 'לאכול משהו מהמקרר',
      position: new THREE.Vector3(6.3, 0, -5.15),
      radius: 1.45,
      type: 'activity',
      data: { action: 'eat' },
    });
  } else {
    interactables.push({
      id: `guest-look-${kind}`,
      label: kind === 'blue' ? 'להסתכל על החדר של נועם' : 'להסתכל על הגינה מהחלון',
      position: new THREE.Vector3(-1.4, 0, 2.2),
      radius: 2,
      type: 'activity',
      data: { action: kind === 'blue' ? 'visitNoamRoom' : 'visitMayaWindow' },
    });
    interactables.push({
      id: `guest-snack-${kind}`,
      label: 'לבקש כיבוד קטן',
      position: new THREE.Vector3(3.3, 0, -3.2),
      radius: 1.8,
      type: 'activity',
      data: { action: 'guestSnack' },
    });
  }

  interactables.push({
    id: `exit-home-${kind}`,
    label: 'לצאת מהדלת לשכונה',
    position: new THREE.Vector3(0, 0, 5.2),
    radius: 2.3,
    type: 'door',
    data: { target: 'neighborhood' },
  });
  const door = box(1.5, 2.35, 0.16, mats.door, 0, 1.18, 6.62);
  door.name = 'home-door';
  group.add(door);
  group.add(box(0.14, 2.55, 0.22, mats.wood, -0.86, 1.28, 6.62));
  group.add(box(0.14, 2.55, 0.22, mats.wood, 0.86, 1.28, 6.62));
  group.add(box(1.9, 0.16, 0.22, mats.wood, 0, 2.5, 6.62));
  group.add(box(0.08, 0.08, 0.1, mats.metal, 0.48, 1.15, 6.5));

  const npcSpawns =
    kind === 'player'
      ? [
          { id: 'mom', position: new THREE.Vector3(4.4, 0, -2.7) },
          { id: 'dad', position: new THREE.Vector3(1.65, 0, 1.45) },
          { id: 'brother', position: new THREE.Vector3(-5.5, 0, 3.3) },
        ]
      : kind === 'blue'
        ? [
            { id: 'noam', position: new THREE.Vector3(-5.6, 0, 3.1) },
            { id: 'dad', position: new THREE.Vector3(4.2, 0, -2.8) },
          ]
        : [
            { id: 'maya', position: new THREE.Vector3(-5.7, 0, 2.8) },
            { id: 'neighbor', position: new THREE.Vector3(1.4, 0, 1.8) },
          ];

  return {
    group,
    interactables,
    spawn: new THREE.Vector3(0.4, 0, 0.45),
    npcSpawns,
  };
}

function buildSchool(): ZoneBuildResult {
  const group = new THREE.Group();
  group.name = 'zone-school';
  const interactables: Interactable[] = [];

  group.add(box(40, 0.2, 30, mats.sidewalk, 0, -0.1, 0));
  const wallH = 3.1;
  group.add(box(18, 0.08, 12.4, mats.floor, -8, 0.04, -6.1));
  group.add(box(18.4, wallH, 0.35, mats.wall, -8, wallH / 2, -12.2));
  group.add(box(0.35, wallH, 12.4, mats.wall, -17.1, wallH / 2, -6.1));
  group.add(box(0.35, wallH, 12.4, mats.wall, 1.1, wallH / 2, -6.1));
  group.add(box(0.22, 2.7, 0.22, mats.wood, -16.6, 1.35, -0.2));
  group.add(box(0.22, 2.7, 0.22, mats.wood, 0.6, 1.35, -0.2));
  group.add(box(17.4, 0.16, 0.22, mats.wood, -8, 2.7, -0.2));
  group.add(box(0.22, wallH, 6.2, mats.wall, -8, wallH / 2, -8.8));
  group.add(box(2.2, 2.5, 0.12, new THREE.MeshStandardMaterial({ color: 0x2f6b4f }), -12.2, 1.7, -11.9));
  group.add(box(2.2, 2.5, 0.12, new THREE.MeshStandardMaterial({ color: 0x245c8a }), -3.6, 1.7, -11.9));
  // Yard
  group.add(box(18, 0.15, 14, mats.grass, 8, 0.02, 4));
  group.add(box(1.2, 0.3, 1.2, mats.play, 6, 0.3, 2));
  group.add(cyl(0.8, 0.2, mats.sand, 10, 0.15, 6));

  for (const roomX of [-12.2, -3.8]) {
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const dx = roomX + (col - 0.5) * 1.8;
        const dz = -8.6 + row * 1.7;
        const desk = box(1.15, 0.7, 0.7, mats.wood, dx, 0.35, dz);
        desk.userData.dress = { prop: 'table', fit: 'height', value: 0.72 };
        desk.userData.noCollide = false;
        group.add(desk);
        group.add(box(0.42, 0.42, 0.42, mats.play, dx, 0.22, dz + 0.55));
      }
    }
  }

  interactables.push({
    id: 'sit-desk-left',
    label: 'לשבת ליד השולחן',
    position: new THREE.Vector3(-13.1, 0, -7.35),
    radius: 1.35,
    type: 'activity',
    data: { action: 'sitDesk', x: -13.1, z: -8.05, standZ: -7.2, yaw: Math.PI },
  });
  interactables.push({
    id: 'sit-desk-right',
    label: 'לשבת ליד השולחן',
    position: new THREE.Vector3(-4.7, 0, -7.35),
    radius: 1.35,
    type: 'activity',
    data: { action: 'sitDesk', x: -4.7, z: -8.05, standZ: -7.2, yaw: Math.PI },
  });
  interactables.push({
    id: 'classroom',
    label: 'להיכנס לשיעור',
    position: new THREE.Vector3(-12.2, 0, -6.2),
    radius: 2.5,
    type: 'activity',
    data: { situation: 'class_question', action: 'class' },
  });
  interactables.push({
    id: 'tag-game',
    label: 'משחקי חצר בהפסקה',
    position: new THREE.Vector3(8, 0, 4),
    radius: 3,
    type: 'activity',
    data: { action: 'recessTag' },
  });
  group.add(box(3, 2.2, 2, mats.wood, -4, 1.1, 2));
  interactables.push({
    id: 'library',
    label: 'להיכנס לספרייה',
    position: new THREE.Vector3(-4, 0, 2),
    radius: 2,
    type: 'activity',
    data: { action: 'library' },
  });
  interactables.push({
    id: 'bike-rack',
    label: 'חניית אופניים',
    position: new THREE.Vector3(2, 0, 8),
    radius: 2,
    type: 'activity',
    data: { action: 'bikeRack' },
  });
  interactables.push({
    id: 'exit-school',
    label: 'לחזור לשכונה',
    position: new THREE.Vector3(-8, 0, 7.4),
    radius: 2.5,
    type: 'door',
    data: { target: 'neighborhood' },
  });

  return {
    group,
    interactables,
    spawn: new THREE.Vector3(-8, 0, 4),
    npcSpawns: [
      { id: 'teacher', position: new THREE.Vector3(-12.4, 0, -10.4) },
      { id: 'noam', position: new THREE.Vector3(7, 0, 3) },
      { id: 'maya', position: new THREE.Vector3(9, 0, 5) },
      { id: 'dani', position: new THREE.Vector3(5, 0, 6) },
    ],
  };
}

function buildShop(): ZoneBuildResult {
  const group = new THREE.Group();
  group.name = 'zone-shop';
  const interactables: Interactable[] = [];

  group.add(box(20, 0.2, 16, mats.floor, 0, -0.1, 0));
  group.add(box(20, 3.5, 0.3, mats.wall, 0, 1.75, -8));
  group.add(box(0.3, 3.5, 16, mats.wall, -10, 1.75, 0));
  group.add(box(0.3, 3.5, 16, mats.wall, 10, 1.75, 0));
  group.add(box(9, 3.5, 0.3, mats.wall, -5.5, 1.75, 8));
  group.add(box(9, 3.5, 0.3, mats.wall, 5.5, 1.75, 8));
  group.add(box(1.6, 2.4, 0.14, mats.door, 0, 1.2, 7.78));
  group.add(box(0.12, 2.55, 0.2, mats.wood, -0.86, 1.28, 7.78));
  group.add(box(0.12, 2.55, 0.2, mats.wood, 0.86, 1.28, 7.78));

  for (const sx of [-6.4, 6.4]) {
    for (const sz of [-4.2, -0.8, 2.4]) {
      const face = sx < 0 ? 1 : -1;
      group.add(box(4.4, 2.15, 0.12, mats.wood, sx, 1.08, sz));
      for (const h of [0.45, 1.12, 1.75]) {
        const board = box(4.4, 0.07, 0.72, mats.wood, sx + face * 0.32, h, sz);
        board.userData.noCollide = true;
        group.add(board);
      }
    }
  }
  group.add(box(3.2, 1.05, 0.8, mats.metal, 0, 0.52, 4.6));

  interactables.push({
    id: 'checkout',
    label: 'לקנות במכולת',
    position: new THREE.Vector3(0, 0, 3.1),
    radius: 2.6,
    type: 'shop',
  });
  interactables.push({
    id: 'stock-job',
    label: 'לעזור לסדר מדפים (כסף כיס)',
    position: new THREE.Vector3(-5, 0, -2),
    radius: 2,
    type: 'activity',
    data: { action: 'stockJob' },
  });
  interactables.push({
    id: 'return-broken',
    label: 'להחזיר מוצר שנשבר',
    position: new THREE.Vector3(2.2, 0, 4.2),
    radius: 1.8,
    type: 'activity',
    data: { action: 'returnBroken' },
  });
  interactables.push({
    id: 'exit-shop',
    label: 'לצאת לשכונה',
    position: new THREE.Vector3(0, 0, 6.3),
    radius: 2,
    type: 'door',
    data: { target: 'neighborhood' },
  });

  return {
    group,
    interactables,
    spawn: new THREE.Vector3(0, 0, 1.2),
    npcSpawns: [{ id: 'shopkeeper', position: new THREE.Vector3(1.7, 0, 3.5) }],
  };
}

function addPlayground(group: THREE.Group, ox: number, oz: number): void {
  const red = new THREE.MeshStandardMaterial({ color: 0xd64545, roughness: 0.55 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.55 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x3d7ec9, roughness: 0.55 });
  const green = new THREE.MeshStandardMaterial({ color: 0x3c9a5a, roughness: 0.55 });
  const place = (mesh: THREE.Object3D, x: number, z: number) => {
    mesh.position.x += ox + x;
    mesh.position.z += oz + z;
    group.add(mesh);
  };
  const post = (x: number, z: number) => place(box(0.14, 2.5, 0.14, blue, 0, 1.25, 0), x, z);
  post(-1.35, -0.85);
  post(1.35, -0.85);
  post(-1.35, 0.85);
  post(1.35, 0.85);
  place(box(2.9, 0.12, 0.12, blue, 0, 2.45, 0), 0, -0.85);
  place(box(2.9, 0.12, 0.12, blue, 0, 2.45, 0), 0, 0.85);
  place(box(0.12, 0.12, 1.85, blue, 0, 2.45, 0), -1.35, 0);
  place(box(0.12, 0.12, 1.85, blue, 0, 2.45, 0), 1.35, 0);
  for (const sx of [-0.5, 0.5]) {
    place(box(0.05, 1.35, 0.05, mats.metal, 0, 1.7, 0), sx, 0);
    place(box(0.62, 0.08, 0.32, red, 0, 0.98, 0), sx, 0);
  }

  place(box(1.05, 1.35, 1.05, yellow, 0, 0.68, 0), 3.3, -0.4);
  const chute = box(0.95, 0.12, 2.5, red, 0, 1.15, 0);
  chute.rotation.x = -0.5;
  place(chute, 3.3, 1.35);
  place(box(0.08, 1.25, 0.08, yellow, 0, 0.62, 0), 2.9, -1.15);
  place(box(0.08, 1.25, 0.08, yellow, 0, 0.62, 0), 3.7, -1.15);
  for (const hy of [0.35, 0.7, 1.05]) place(box(0.85, 0.07, 0.1, yellow, 0, hy, 0), 3.3, -1.15);

  const plank = box(0.42, 0.1, 2.6, green, 0, 0.62, 0);
  plank.rotation.z = 0.22;
  place(plank, 5.7, 0);
  place(cyl(0.22, 0.45, blue, 0, 0.28, 0), 5.7, 0);
  place(box(0.4, 0.08, 0.4, red, 0, 0.78, 0), 5.7, -1.15);
  place(box(0.4, 0.08, 0.4, yellow, 0, 0.46, 0), 5.7, 1.15);

  place(box(2.4, 0.22, 1.8, mats.wood, 0, 0.11, 0), 3.2, -3.1);
  place(box(2, 0.1, 1.4, mats.sand, 0, 0.22, 0), 3.2, -3.1);

  for (const [cx, cz] of [
    [-1.15, -3.5],
    [0.9, -3.5],
    [-1.15, -2.1],
    [0.9, -2.1],
  ] as Array<[number, number]>) {
    place(box(0.12, 1.55, 0.12, green, 0, 0.78, 0), cx, cz);
  }
  place(box(2.2, 0.1, 0.1, green, 0, 1.5, 0), -0.1, -3.5);
  place(box(2.2, 0.1, 0.1, green, 0, 1.5, 0), -0.1, -2.1);
  place(box(0.1, 0.1, 1.55, green, 0, 1.5, 0), -1.15, -2.8);
  place(box(0.1, 0.1, 1.55, green, 0, 1.5, 0), 0.9, -2.8);
}

function buildPark(): ZoneBuildResult {
  const group = new THREE.Group();
  group.name = 'zone-park';
  const interactables: Interactable[] = [];

  group.add(box(50, 0.2, 40, mats.grass, 0, -0.1, 0));
  group.add(box(3, 0.1, 20, mats.sand, 0, 0.02, 0));
  for (const [x, z] of [
    [-12, -8],
    [-8, 10],
    [10, -10],
    [14, 8],
    [-16, 2],
    [6, 12],
  ]) {
    group.add(tree(x, z));
  }
  group.add(bench(-4, 4));
  group.add(bench(4, -3, Math.PI / 2));

  addPlayground(group, 10, -1);

  interactables.push({
    id: 'swing',
    label: 'לשבת על הנדנדה',
    position: new THREE.Vector3(10.5, 0, -1),
    radius: 1.5,
    type: 'activity',
    data: { action: 'swing' },
  });
  interactables.push({
    id: 'slide',
    label: 'לרדת במגלשה',
    position: new THREE.Vector3(13.3, 0, -2.3),
    radius: 1.55,
    type: 'activity',
    data: { action: 'slide' },
  });
  interactables.push({
    id: 'seesaw',
    label: 'לשבת על נדנדת האיזון',
    position: new THREE.Vector3(15.7, 0, -2.15),
    radius: 1.5,
    type: 'activity',
    data: { action: 'seesaw' },
  });
  interactables.push({
    id: 'climb',
    label: 'לטפס על המתקן',
    position: new THREE.Vector3(9.9, 0, -3.8),
    radius: 1.55,
    type: 'activity',
    data: { action: 'climb' },
  });
  interactables.push({
    id: 'sandbox',
    label: 'לשחק בארגז החול',
    position: new THREE.Vector3(13.2, 0, -4.1),
    radius: 1.55,
    type: 'activity',
    data: { action: 'sandbox' },
  });
  interactables.push({
    id: 'park-argue',
    label: 'לגשת למשחק הכדור',
    position: new THREE.Vector3(0, 0, 0),
    radius: 2.5,
    type: 'activity',
    data: { situation: 'park_argument' },
  });
  interactables.push({
    id: 'lost-cat',
    label: 'לחפש את החתול של השכנה',
    position: new THREE.Vector3(-10, 0, -2),
    radius: 2.2,
    type: 'activity',
    data: { action: 'lostCat' },
  });
  interactables.push({
    id: 'street-fair',
    label: 'לגשת לדוכן היריד',
    position: new THREE.Vector3(6, 0, -6),
    radius: 2.2,
    type: 'activity',
    data: { action: 'streetFair' },
  });
  interactables.push({
    id: 'dog',
    label: 'ללטף כלב שכונה',
    position: new THREE.Vector3(-6, 0, 6),
    radius: 2,
    type: 'activity',
    data: { action: 'petDog' },
  });
  const dog = cyl(0.35, 0.5, new THREE.MeshStandardMaterial({ color: 0x8b6914 }), -6, 0.3, 6);
  dog.name = 'prop-dog';
  dog.userData.dress = { prop: 'Husky', fit: 'height', value: 0.75, folder: 'animals' };
  group.add(dog);

  interactables.push({
    id: 'exit-park',
    label: 'לחזור לשכונה',
    position: new THREE.Vector3(0, 0, 16),
    radius: 2.5,
    type: 'door',
    data: { target: 'neighborhood' },
  });

  return {
    group,
    interactables,
    spawn: new THREE.Vector3(6, 0, 5),
    npcSpawns: [
      { id: 'dani', position: new THREE.Vector3(1, 0, 1) },
      { id: 'noam', position: new THREE.Vector3(-1, 0, 1) },
      { id: 'maya', position: new THREE.Vector3(8, 0, 4) },
      { id: 'neighbor', position: new THREE.Vector3(-4, 0, 4) },
    ],
  };
}

const zooDirt = new THREE.MeshStandardMaterial({ color: 0x8a6840, roughness: 1 });
const zooMeadow = new THREE.MeshStandardMaterial({ color: 0x5c9a46, roughness: 1 });
const zooStraw = new THREE.MeshStandardMaterial({ color: 0xd7b14a, roughness: 1 });
const zooDen = new THREE.MeshStandardMaterial({ color: 0x2c261e, roughness: 1 });

interface ZooPen {
  kind: string;
  name: string;
  doing: string;
  prop: string;
  height: number;
  animals: boolean;
  floor: 'sand' | 'meadow' | 'dirt';
  food: string;
  foodH: number;
  gear: 'den' | 'trough' | 'log' | 'stump' | 'kennel' | 'post' | 'hutch' | 'coop';
}

function zooMarker(group: THREE.Group, prop: string, height: number, x: number, z: number): void {
  const marker = box(0.3, 0.3, 0.3, mats.wood, x, 0.16, z);
  marker.userData.noCollide = true;
  marker.userData.dress = { prop, fit: 'height', value: height };
  group.add(marker);
}

function zooLabel(text: string, x: number, y: number, z: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'rgba(48, 32, 18, 0.92)';
    ctx.fillRect(28, 34, 456, 92);
    ctx.fillStyle = '#fff6e4';
    ctx.font = '700 72px Arial, Rubik, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 80);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.position.set(x, y, z);
  sprite.scale.set(2.2, 0.68, 1);
  sprite.renderOrder = 20;
  return sprite;
}

function zooBench(group: THREE.Group, x: number, z: number, face: number): void {
  group.add(box(1.45, 0.1, 0.46, mats.wood, x, 0.48, z));
  group.add(box(1.45, 0.5, 0.08, mats.wood, x, 0.78, z + face * 0.2));
  for (const sx of [-0.55, 0.55]) {
    for (const sz of [-0.14, 0.14]) {
      const leg = box(0.08, 0.42, 0.08, mats.wood, x + sx, 0.21, z + sz);
      leg.userData.noCollide = true;
      group.add(leg);
    }
  }
}

function zooGear(group: THREE.Group, gear: ZooPen['gear'], x: number, z: number): void {
  const soft = (mesh: THREE.Mesh) => {
    mesh.userData.noCollide = true;
    group.add(mesh);
  };
  if (gear === 'den') {
    zooMarker(group, 'rock_smallA', 0.75, x, z);
    zooMarker(group, 'rock_smallB', 0.5, x + 0.55, z + 0.15);
    soft(box(0.7, 0.4, 0.45, zooDen, x, 0.22, z + 0.4));
    return;
  }
  if (gear === 'trough') {
    soft(box(1.3, 0.28, 0.55, mats.water, x, 0.22, z));
    soft(box(1.4, 0.1, 0.08, mats.wood, x, 0.38, z - 0.28));
    soft(box(1.4, 0.1, 0.08, mats.wood, x, 0.38, z + 0.28));
    soft(box(0.7, 0.32, 0.48, zooStraw, x + 0.9, 0.18, z));
    return;
  }
  if (gear === 'log') {
    zooMarker(group, 'log_large', 0.48, x, z);
    return;
  }
  if (gear === 'stump') {
    zooMarker(group, 'stump_round', 0.55, x, z);
    return;
  }
  if (gear === 'post') {
    group.add(cyl(0.08, 0.9, mats.wood, x, 0.45, z));
    soft(cyl(0.28, 0.08, mats.wood, x, 0.92, z));
    return;
  }
  if (gear === 'hutch') {
    group.add(box(1.05, 0.62, 0.8, mats.wood, x, 0.31, z));
    soft(box(1.2, 0.1, 0.95, zooStraw, x, 0.66, z));
    soft(box(0.36, 0.36, 0.06, zooDen, x, 0.24, z + 0.4));
    return;
  }
  if (gear === 'coop') {
    group.add(box(0.9, 0.7, 0.75, mats.wood, x, 0.35, z));
    soft(box(1.05, 0.1, 0.9, mats.roof, x, 0.74, z));
    soft(box(0.28, 0.32, 0.06, zooDen, x, 0.22, z + 0.38));
    return;
  }
  group.add(box(1.15, 0.72, 0.95, mats.wood, x, 0.36, z));
  soft(box(1.3, 0.12, 1.1, mats.roof, x, 0.78, z));
  soft(box(0.42, 0.42, 0.06, zooDen, x, 0.26, z + 0.48));
}

function buildZoo(): ZoneBuildResult {
  const group = new THREE.Group();
  group.name = 'zone-zoo';
  const interactables: Interactable[] = [];

  group.add(box(88, 0.2, 54, mats.grass, 0, -0.1, 4));
  group.add(box(78, 0.12, 4.2, mats.sidewalk, -2, 0.05, 0));
  group.add(box(4.4, 0.12, 26, mats.sidewalk, 0, 0.05, 13));

  const pens: ZooPen[] = [
    { kind: 'wolf', name: 'הזאב', doing: 'מסייר לאורך הגדר ומיילל בפינות.', prop: 'Wolf', height: 1.2, animals: true, floor: 'dirt', food: 'burger', foodH: 0.22, gear: 'den' },
    { kind: 'horse', name: 'הסוס', doing: 'רץ בסיבוב סביב הכלוב.', prop: 'Horse', height: 1.65, animals: true, floor: 'meadow', food: 'apple', foodH: 0.22, gear: 'trough' },
    { kind: 'fox', name: 'השועל', doing: 'מתגנב לאט ואז רץ לקצה השני.', prop: 'Fox', height: 0.85, animals: true, floor: 'dirt', food: 'bowl-soup', foodH: 0.22, gear: 'log' },
    { kind: 'deer', name: 'האייל', doing: 'רועה מהדשא ומרים את הראש.', prop: 'Deer', height: 1.35, animals: true, floor: 'meadow', food: 'carrot', foodH: 0.28, gear: 'stump' },
    { kind: 'cow', name: 'הפרה', doing: 'הולכת לאט ועוצרת ללעוס.', prop: 'Cow', height: 1.45, animals: true, floor: 'meadow', food: 'grass_large', foodH: 0.35, gear: 'trough' },
    { kind: 'husky', name: 'ההאסקי', doing: 'רץ סיבובים ואז מכשכש בזנב.', prop: 'Husky', height: 0.95, animals: true, floor: 'sand', food: 'bowl-soup', foodH: 0.22, gear: 'kennel' },
    { kind: 'cat', name: 'החתול', doing: 'משוטט ואז יושב להתגרד.', prop: 'animal-cat', height: 0.7, animals: false, floor: 'sand', food: 'bowl-soup', foodH: 0.2, gear: 'post' },
    { kind: 'bunny', name: 'הארנב', doing: 'קופץ ממקום למקום.', prop: 'animal-bunny', height: 0.62, animals: false, floor: 'meadow', food: 'carrot', foodH: 0.26, gear: 'hutch' },
    { kind: 'chick', name: 'האפרוח', doing: 'מסתובב ומנקר באדמה.', prop: 'animal-chick', height: 0.48, animals: false, floor: 'sand', food: 'bread', foodH: 0.18, gear: 'coop' },
    { kind: 'dog', name: 'הכלב', doing: 'רץ אל הקערה, מרחרח וחוזר.', prop: 'animal-dog', height: 0.78, animals: false, floor: 'sand', food: 'bowl-soup', foodH: 0.22, gear: 'kennel' },
  ];

  const cols = [-32, -20, -8, 8, 20];
  pens.forEach((pen, index) => {
    const x = cols[index % 5];
    const north = index >= 5;
    const z = north ? 11 : -11;
    const face = north ? -1 : 1;
    const hw = 4.2;
    const hd = 3.8;
    const floorMat = pen.floor === 'meadow' ? zooMeadow : pen.floor === 'dirt' ? zooDirt : mats.sand;
    const floor = box(hw * 2 - 0.4, 0.06, hd * 2 - 0.4, floorMat, x, 0.04, z);
    floor.userData.noCollide = true;
    group.add(floor);
    group.add(box(hw * 2, 1.15, 0.16, mats.fence, x, 0.58, z - face * hd));
    group.add(box(0.16, 1.15, hd * 2, mats.fence, x - hw, 0.58, z));
    group.add(box(0.16, 1.15, hd * 2, mats.fence, x + hw, 0.58, z));
    const frontZ = z + face * hd;
    for (let px = -hw; px <= hw; px += 0.8) {
      group.add(box(0.14, 1.4, 0.14, mats.wood, x + px, 0.7, frontZ));
    }

    const backZ = z - face * 2.15;
    zooMarker(group, pen.food, pen.foodH, x - 2.3, backZ);
    zooGear(group, pen.gear, x + 2.25, backZ);
    if (pen.floor === 'meadow') zooMarker(group, 'grass_large', 0.32, x + 1.1, z - face * 0.2);

    const anchor = new THREE.Group();
    anchor.name = `zoo-animal-${pen.kind}`;
    anchor.position.set(x, 0, z);
    anchor.rotation.order = 'YXZ';
    anchor.userData.noCollide = true;
    anchor.userData.dressStick = true;
    anchor.userData.zooPet = { kind: pen.kind, phase: index * 1.35 };
    anchor.userData.dress = {
      prop: pen.prop,
      fit: 'height',
      value: pen.height,
      ...(pen.animals ? { folder: 'animals' as const } : {}),
    };
    const marker = cyl(0.28, 0.5, mats.sand, 0, 0, 0);
    marker.userData.noCollide = true;
    anchor.add(marker);
    group.add(anchor);

    const signZ = frontZ + face * 0.55;
    group.add(box(0.12, 1.7, 0.12, mats.wood, x - 3.3, 0.85, signZ));
    const board = box(1.35, 0.4, 0.08, mats.wood, x - 3.3, 1.7, signZ);
    board.userData.noCollide = true;
    group.add(board);
    group.add(zooLabel(pen.name, x - 3.3, 2.25, signZ));
    zooBench(group, x + 0.8, frontZ + face * 1.15, face);

    interactables.push({
      id: `pen-${pen.kind}`,
      label: `להסתכל על ${pen.name}`,
      position: new THREE.Vector3(x + 0.8, 0, frontZ + face * 2.3),
      radius: 2.2,
      type: 'activity',
      data: { action: 'watchAnimal', animal: pen.name, doing: pen.doing },
    });
  });

  for (const [x, z] of [
    [-40, -16],
    [-40, 0],
    [-40, 18],
    [40, -16],
    [40, 4],
    [40, 20],
    [0, -18],
    [-18, 22],
    [22, 22],
  ] as Array<[number, number]>) {
    group.add(tree(x, z));
  }

  for (const [x, z] of [
    [-28, 4.7],
    [-14, -4.7],
    [2, 4.7],
    [14, -4.7],
    [26, 4.7],
    [-24, -16],
    [12, -16],
    [-6, 17],
    [16, 17],
    [-36, 8],
  ] as Array<[number, number]>) {
    zooMarker(group, 'grass_large', 0.38, x, z);
  }

  group.add(box(8, 0.4, 4, mats.wood, -16, 0.2, 21));
  interactables.push({
    id: 'show',
    label: 'לצפות במופע היומי',
    position: new THREE.Vector3(-16, 0, 18.5),
    radius: 2.6,
    type: 'activity',
    data: { action: 'zooShow' },
  });
  interactables.push({
    id: 'zoo-shop',
    label: 'חנות מזכרות',
    position: new THREE.Vector3(16, 0, 20),
    radius: 2,
    type: 'shop',
    data: { zooOnly: true },
  });
  interactables.push({
    id: 'camera',
    label: 'לצלם תמונה לאלבום',
    position: new THREE.Vector3(8, 0, 18),
    radius: 2,
    type: 'activity',
    data: { action: 'takePhoto' },
  });
  interactables.push({
    id: 'exit-zoo',
    label: 'לחזור לשכונה',
    position: new THREE.Vector3(0, 0, 25),
    radius: 2.4,
    type: 'door',
    data: { target: 'neighborhood' },
  });

  return {
    group,
    interactables,
    spawn: new THREE.Vector3(0, 0, 21),
    npcSpawns: [
      { id: 'zookeeper', position: new THREE.Vector3(-3.2, 0, 16) },
      { id: 'maya', position: new THREE.Vector3(3.4, 0, 15) },
    ],
  };
}
