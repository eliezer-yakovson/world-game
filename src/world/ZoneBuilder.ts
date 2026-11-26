import * as THREE from 'three';
import { SCHOOL_SEATS, TEACHERS, schoolSpawns } from '../characters/schoolDay';
import { box, cyl, mats } from './materials';
import { encountersIn } from '../scenes/encounters';
import { buildPlayground, playgroundSpots } from './playground';
import { RIDE_TICKET_PRICE, buildLunaPark, lunaQueues, lunaSpots } from './lunaPark';
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
    case 'luna':
      return buildLuna();
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

function addEncounters(zone: ZoneId, group: THREE.Group, interactables: Interactable[]): void {
  for (const encounter of encountersIn(zone)) {
    const { x, z } = encounter.spot;
    const pole = box(0.08, 1.15, 0.08, mats.wood, x, 0.55, z);
    pole.name = `encounter-${encounter.id}`;
    pole.userData.noCollide = true;
    const flag = box(0.32, 0.16, 0.04, mats.play, x + 0.18, 1.02, z);
    flag.userData.noCollide = true;
    group.add(pole, flag);
    interactables.push({
      id: `encounter-${encounter.id}`,
      label: encounter.label,
      position: new THREE.Vector3(x, 0, z),
      radius: 1.7,
      type: 'activity',
      data: { action: 'encounter', scene: encounter.id },
    });
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
    h.userData.dress = { prop, fit: 'width', value: 9.2 };
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
  makeSign('לונה פארק', -20, -16, 'luna');

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
  addEncounters('neighborhood', group, interactables);

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
  const height = 4.2;
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
        ? box(gap1 - gap0, 0.22, 0.28, mats.wood, (gap0 + gap1) / 2, 3.62, fixed)
        : box(0.28, 0.22, gap1 - gap0, mats.wood, fixed, 3.62, (gap0 + gap1) / 2);
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

function decor(
  group: THREE.Group,
  mesh: THREE.Mesh,
  prop?: string,
  fit?: 'width' | 'height',
  value?: number,
): THREE.Mesh {
  if (prop && fit && value) mesh.userData.dress = { prop, fit, value };
  group.add(mesh);
  return mesh;
}

/** Noam's house: one long bedroom on the left, an open music room, and a kitchen tucked in the back. */
function furnishBlue(group: THREE.Group, interactables: Interactable[]): void {
  const interior = new THREE.MeshStandardMaterial({ color: 0xd5e6f5, roughness: 0.9 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0x2c5f96 });
  addWall(group, interior, 'z', -1.2, -11.8, 11.8, [{ at: 0.6, width: 2.6 }]);
  addWall(group, interior, 'x', -5.6, -1.0, 15.8, [{ at: 7.2, width: 2.5 }]);

  roomFloor(group, 0x7f9cc4, -8.6, 0, 14.4, 23.2);
  roomFloor(group, 0xd7ebf8, 7.3, 3.1, 16.6, 16.6);
  roomFloor(group, 0xb7c9d6, 7.3, -8.7, 16.6, 6.4);

  roomWindow(group, -15.82, 2.2, 2.2, 'z');
  roomWindow(group, -15.82, -6.4, 1.6, 'z');
  roomWindow(group, 15.82, 6.2, 2, 'z');
  roomWindow(group, 8.2, -11.82, 2.2, 'x');

  decor(group, box(3.2, 0.8, 1.15, cloth, 9.2, 0.42, 8.6), 'loungeSofa', 'width', 3.2);
  decor(group, box(1.6, 0.42, 0.9, mats.wood, 9.2, 0.24, 6.7), 'tableCoffee', 'width', 1.6);
  decor(group, box(0.85, 0.8, 0.85, cloth, 6.2, 0.42, 8.5), 'loungeChair', 'width', 0.9);
  decor(group, box(0.85, 0.8, 0.85, cloth, 12.2, 0.42, 8.5), 'loungeChair', 'width', 0.9);
  const rug = decor(group, box(4.6, 0.04, 2.8, new THREE.MeshStandardMaterial({ color: 0x1d4e89 }), 9.2, 0.03, 7.5), 'rugRectangle', 'width', 4.6);
  rug.userData.noCollide = true;
  decor(group, box(0.55, 0.7, 0.35, mats.metal, 14.55, 0.4, 5.4), 'televisionModern', 'height', 0.7);
  decor(group, box(0.5, 0.35, 0.4, mats.wood, 14.2, 0.22, 9.1), 'radio', 'height', 0.4);
  decor(group, box(0.7, 1.7, 0.55, mats.wood, 14.55, 0.88, 2.4), 'bookcaseOpen', 'height', 1.7);
  decor(group, box(0.5, 0.75, 0.5, mats.wood, 3.4, 0.4, 8.6), 'pottedPlant', 'height', 0.85);
  decor(group, box(0.4, 0.5, 0.4, mats.wood, 4.4, 0.28, 4.4), 'plantSmall2', 'height', 0.5);

  decor(group, box(1.05, 1.85, 0.8, mats.metal, 14.4, 0.95, -10.2), 'kitchenFridge', 'height', 1.85);
  group.add(box(5.4, 0.95, 0.7, mats.wood, 8.4, 0.5, -10.6));
  const coffee = decor(group, box(0.4, 0.32, 0.35, mats.metal, 10.6, 1.14, -10.55), 'kitchenCoffeeMachine', 'height', 0.34);
  coffee.userData.noCollide = true;
  const toaster = decor(group, box(0.38, 0.26, 0.32, mats.metal, 7.4, 1.1, -10.55), 'toaster', 'height', 0.26);
  toaster.userData.noCollide = true;
  decor(group, box(1.5, 0.75, 0.95, mats.wood, 6.6, 0.4, -8.2), 'table', 'height', 0.75);
  decor(group, box(0.5, 0.72, 0.5, mats.wood, 5.3, 0.38, -7.35), 'loungeChair', 'height', 0.72);
  decor(group, box(0.5, 0.72, 0.5, mats.wood, 7.9, 0.38, -7.35), 'loungeChair', 'height', 0.72);

  decor(group, box(2.4, 0.5, 1.4, new THREE.MeshStandardMaterial({ color: 0x9ec1e8 }), -10.2, 0.28, -7.2), 'bedSingle', 'width', 2.4);
  decor(group, box(0.5, 0.5, 0.5, mats.wood, -12.6, 0.28, -8.6), 'lampRoundTable', 'height', 0.5);
  const pillow = decor(group, box(0.45, 0.18, 0.55, new THREE.MeshStandardMaterial({ color: 0xd6ecff }), -9.4, 0.58, -7.2), 'pillowBlue', 'height', 0.2);
  pillow.userData.noCollide = true;
  decor(group, box(1.3, 0.75, 0.7, mats.wood, -13.4, 0.4, 4.6), 'table', 'height', 0.75);
  decor(group, box(0.5, 0.7, 0.5, mats.wood, -12.2, 0.38, 5.5), 'loungeChair', 'height', 0.72);
  decor(group, box(0.6, 1.8, 1.1, mats.wood, -14.7, 0.92, 1.1), 'bookcaseOpen', 'height', 1.8);
  decor(group, box(0.55, 0.55, 0.45, mats.wood, -14.3, 0.3, 8.4), 'sideTable', 'height', 0.55);
  const bedRug = box(3.2, 0.04, 2, new THREE.MeshStandardMaterial({ color: 0x24558a }), -10, 0.03, -5.4);
  bedRug.userData.noCollide = true;
  group.add(bedRug);
  decor(group, box(0.45, 0.6, 0.45, mats.wood, -4.4, 0.32, -8.2), 'plantSmall1', 'height', 0.55);

  interactables.push({
    id: 'guest-look-blue',
    label: 'להסתכל על החדר של נועם',
    position: new THREE.Vector3(-4.4, 0, 0.8),
    radius: 2,
    type: 'activity',
    data: { action: 'visitNoamRoom' },
  });
  interactables.push({
    id: 'guest-snack-blue',
    label: 'לבקש כיבוד קטן',
    position: new THREE.Vector3(6.6, 0, -7.4),
    radius: 1.8,
    type: 'activity',
    data: { action: 'guestSnack' },
  });
}

/** Maya's house: a wide plant-filled parlor in front, the kitchen on the left, and her room on the right. */
function furnishYellow(group: THREE.Group, interactables: Interactable[]): void {
  const interior = new THREE.MeshStandardMaterial({ color: 0xf6e6bf, roughness: 0.9 });
  const cloth = new THREE.MeshStandardMaterial({ color: 0xd0892b });
  addWall(group, interior, 'x', 1.2, -15.8, 15.8, [
    { at: -7.2, width: 2.5 },
    { at: 7.4, width: 2.5 },
  ]);
  addWall(group, interior, 'z', 0.4, -11.8, 1.0, []);

  roomFloor(group, 0xf3d48a, 0, 6.5, 31.4, 10.4);
  roomFloor(group, 0xe0b56a, -7.8, -5.2, 15.4, 12.4);
  roomFloor(group, 0xf0c2b0, 8.2, -5.2, 15, 12.4);

  roomWindow(group, -7.2, 11.82, 1.8, 'x');
  roomWindow(group, 8.4, 11.82, 1.8, 'x');
  roomWindow(group, -15.82, -5.2, 1.8, 'z');
  roomWindow(group, 15.82, -4.2, 1.8, 'z');

  decor(group, box(3.1, 0.8, 1.15, cloth, -8.6, 0.42, 8.7), 'loungeSofa', 'width', 3.1);
  decor(group, box(1.7, 0.55, 1.05, mats.wood, -1.4, 0.3, 6.5), 'table', 'width', 1.7);
  decor(group, box(0.8, 0.75, 0.8, cloth, -3.5, 0.4, 6.5), 'loungeChair', 'width', 0.85);
  decor(group, box(0.8, 0.75, 0.8, cloth, 0.7, 0.4, 6.5), 'loungeChair', 'width', 0.85);
  decor(group, box(0.8, 0.75, 0.8, cloth, -1.4, 0.4, 8.3), 'loungeChair', 'width', 0.85);
  const rug = decor(group, box(5.2, 0.04, 3.2, new THREE.MeshStandardMaterial({ color: 0xc47b2b }), -2.2, 0.03, 7), 'rugRectangle', 'width', 5.2);
  rug.userData.noCollide = true;
  decor(group, box(0.7, 1.7, 0.6, mats.wood, -14.4, 0.88, 7.2), 'bookcaseOpen', 'height', 1.7);
  decor(group, box(0.5, 0.8, 0.5, mats.wood, 5.2, 0.42, 8.6), 'pottedPlant', 'height', 0.9);
  decor(group, box(0.45, 0.6, 0.45, mats.wood, 11.2, 0.32, 7.4), 'plantSmall1', 'height', 0.6);
  decor(group, box(0.4, 0.55, 0.4, mats.wood, 4.2, 0.3, 4.6), 'plantSmall2', 'height', 0.55);
  decor(group, box(0.55, 0.4, 0.45, mats.wood, 13.2, 0.22, 8.8), 'radio', 'height', 0.4);
  group.add(box(1.8, 0.42, 0.55, cloth, 8.6, 0.24, 10.35));

  group.add(box(0.7, 0.95, 4.6, mats.wood, -14.7, 0.5, -5.4));
  decor(group, box(0.9, 1.85, 0.75, mats.metal, -14.2, 0.95, -9.8), 'kitchenFridge', 'height', 1.85);
  const microwave = decor(group, box(0.45, 0.3, 0.35, mats.metal, -14.55, 1.15, -3.4), 'kitchenMicrowave', 'height', 0.3);
  microwave.userData.noCollide = true;
  decor(group, box(1.6, 0.75, 1, mats.wood, -6.2, 0.4, -6.2), 'table', 'height', 0.75);
  decor(group, box(0.5, 0.72, 0.5, mats.wood, -7.6, 0.38, -5.3), 'loungeChair', 'height', 0.72);
  decor(group, box(0.5, 0.72, 0.5, mats.wood, -4.8, 0.38, -5.3), 'loungeChair', 'height', 0.72);
  decor(group, box(0.5, 0.75, 0.5, mats.wood, -10.4, 0.4, -9.6), 'pottedPlant', 'height', 0.8);

  decor(group, box(2.4, 0.5, 1.45, new THREE.MeshStandardMaterial({ color: 0xf2b8a0 }), 9.2, 0.28, -7.6), 'bedSingle', 'width', 2.4);
  decor(group, box(0.5, 0.5, 0.5, mats.wood, 6.8, 0.28, -8.8), 'lampRoundTable', 'height', 0.5);
  decor(group, box(0.5, 0.5, 0.5, mats.wood, 11.6, 0.28, -8.8), 'lampRoundTable', 'height', 0.5);
  const pillow = decor(group, box(0.45, 0.18, 0.55, new THREE.MeshStandardMaterial({ color: 0xfff1e4 }), 8.6, 0.58, -7.6), 'pillow', 'height', 0.2);
  pillow.userData.noCollide = true;
  decor(group, box(1.2, 0.75, 0.7, mats.wood, 13.6, 0.4, -3.2), 'table', 'height', 0.75);
  decor(group, box(0.5, 0.7, 0.5, mats.wood, 12.4, 0.38, -2.4), 'loungeChair', 'height', 0.7);
  decor(group, box(0.6, 1.6, 0.9, mats.wood, 14.5, 0.82, -9.4), 'bookcaseOpen', 'height', 1.6);
  const bedRug = box(3.4, 0.04, 2.2, new THREE.MeshStandardMaterial({ color: 0xd98b78 }), 9.2, 0.03, -5.6);
  bedRug.userData.noCollide = true;
  group.add(bedRug);

  interactables.push({
    id: 'guest-look-yellow',
    label: 'להסתכל על הגינה מהחלון',
    position: new THREE.Vector3(8.2, 0, 8.6),
    radius: 2,
    type: 'activity',
    data: { action: 'visitMayaWindow' },
  });
  interactables.push({
    id: 'guest-snack-yellow',
    label: 'לבקש כיבוד קטן',
    position: new THREE.Vector3(-6.2, 0, -5.2),
    radius: 1.8,
    type: 'activity',
    data: { action: 'guestSnack' },
  });
}

function buildHome(kind: 'player' | 'blue' | 'yellow'): ZoneBuildResult {
  const group = new THREE.Group();
  group.name = 'zone-home';
  const interactables: Interactable[] = [];
  const wallMat = kind === 'blue' ? mats.wallBlue : kind === 'yellow' ? mats.wallYellow : mats.wall;
  group.userData.homeKind = kind;

  group.add(box(32.4, 0.2, 24.4, mats.floor, 0, -0.1, 0));
  addWall(group, wallMat, 'x', -12, -16, 16, []);
  addWall(group, wallMat, 'x', 12, -16, 16, [{ at: 0, width: 2.5 }]);
  addWall(group, wallMat, 'z', -16, -12, 12, []);
  addWall(group, wallMat, 'z', 16, -12, 12, []);
  if (kind === 'player') {
  const sofaColor = 0x4a6fa5;
  const interior = new THREE.MeshStandardMaterial({ color: 0xf4efe4, roughness: 0.9 });
  // Bedroom and kitchen behind, kids' room, living room and bathroom in front. Doorways are wide enough to walk through.
  addWall(group, interior, 'x', -1, -15.8, 15.8, [
    { at: -8, width: 2.3 },
    { at: 6, width: 2.3 },
  ]);
  addWall(group, interior, 'z', -1, -11.8, -1.2, [{ at: -6.2, width: 2.2 }]);
  addWall(group, interior, 'z', -6, -0.8, 11.8, [{ at: 5, width: 2.3 }]);
  addWall(group, interior, 'z', 7, -0.8, 11.8, [{ at: 5, width: 2.3 }]);


  roomFloor(group, 0xc9c3dc, -8.6, -6.5, 14.2, 10.2);
  roomFloor(group, 0xd7e0da, 7.4, -6.5, 16.4, 10.2);
  roomFloor(group, 0xf0d3a8, -11, 5.4, 9.4, 12.2);
  roomFloor(group, 0xe7d7b8, 0.4, 5.4, 12.2, 12.2);
  roomFloor(group, 0xc5dce6, 11.4, 5.4, 8.4, 12.2);

  roomWindow(group, -8, -11.82, 2.2, 'x');
  roomWindow(group, 8, -11.82, 2.4, 'x');
  roomWindow(group, -15.82, 6, 1.8, 'z');
  roomWindow(group, 15.82, 7.2, 1.8, 'z');
  roomWindow(group, -3.2, 11.82, 1.6, 'x');

  const sofaMat = new THREE.MeshStandardMaterial({ color: sofaColor });
  const sofa = decor(group, box(3.1, 0.8, 1.15, sofaMat, -2.2, 0.42, 6.4), 'loungeSofa', 'width', 3.1);
  sofa.name = 'furniture-sofa';
  decor(group, box(1.4, 0.42, 0.8, mats.wood, 0.2, 0.24, 5.1), 'tableCoffee', 'width', 1.4);
  decor(group, box(0.85, 0.8, 0.85, sofaMat, 2.5, 0.42, 5.1), 'loungeChair', 'width', 0.9);
  decor(group, box(0.85, 0.8, 0.85, sofaMat, 2.5, 0.42, 7.5), 'loungeChair', 'width', 0.9);
  const rug = decor(group, box(4.2, 0.04, 2.4, new THREE.MeshStandardMaterial({ color: 0xb85c38 }), -0.4, 0.03, 5.6), 'rugRectangle', 'width', 4.2);
  rug.userData.noCollide = true;
  decor(group, box(0.55, 0.35, 0.4, mats.metal, 4.2, 0.22, 8.8), 'radio', 'height', 0.42);
  decor(group, box(0.7, 1.7, 0.7, mats.wood, -4.6, 0.88, 9.4), 'bookcaseOpen', 'height', 1.8);
  decor(group, box(0.55, 0.7, 0.55, mats.wood, 4.6, 0.38, 2.4), 'pottedPlant', 'height', 0.85);
  decor(group, box(0.45, 0.55, 0.45, mats.wood, -4.2, 0.3, 2.6), 'plantSmall1', 'height', 0.55);

  decor(group, box(2.6, 0.55, 1.5, new THREE.MeshStandardMaterial({ color: 0x7aa2e3 }), -10, 0.3, -8.4), 'bedSingle', 'width', 2.6);
  decor(group, box(0.55, 0.55, 0.55, mats.wood, -12.7, 0.3, -9.8), 'lampRoundTable', 'height', 0.55);
  decor(group, box(0.55, 0.55, 0.55, mats.wood, -7.3, 0.3, -9.8), 'lampRoundTable', 'height', 0.55);
  decor(group, box(0.7, 1.8, 1.3, mats.wood, -14.6, 0.92, -5.6), 'bookcaseOpen', 'height', 1.9);
  decor(group, box(1.2, 0.7, 0.5, mats.wood, -14.5, 0.38, -8.8), 'sideTable', 'height', 0.7);
  const bedRug = box(3.2, 0.04, 2.2, new THREE.MeshStandardMaterial({ color: 0x8e6aa8 }), -10, 0.03, -6.4);
  bedRug.userData.noCollide = true;
  group.add(bedRug);
  decor(group, box(0.4, 0.18, 0.55, new THREE.MeshStandardMaterial({ color: 0xf2f4f8 }), -9.2, 0.62, -8.4), 'pillow', 'height', 0.22);

  decor(group, box(1.05, 1.85, 0.8, mats.metal, 14.2, 0.95, -10.3), 'kitchenFridge', 'height', 1.85);
  group.add(box(4.4, 0.95, 0.7, mats.wood, 10.2, 0.5, -10.5));
  group.add(box(1.3, 0.9, 0.7, mats.metal, 6.6, 0.48, -10.5));
  decor(group, box(1.7, 0.78, 1.05, mats.wood, 6.6, 0.42, -6.2), 'table', 'height', 0.78);
  decor(group, box(0.55, 0.75, 0.55, mats.wood, 5.1, 0.4, -5.15), 'loungeChair', 'height', 0.8);
  decor(group, box(0.55, 0.75, 0.55, mats.wood, 8.1, 0.4, -5.15), 'loungeChair', 'height', 0.8);
  decor(group, box(0.55, 0.75, 0.55, mats.wood, 6.6, 0.4, -7.5), 'loungeChair', 'height', 0.8);
  decor(group, box(0.55, 1.6, 0.9, mats.wood, 14.3, 0.82, -6.2), 'bookcaseOpen', 'height', 1.6);
  const meal = box(0.35, 0.12, 0.35, mats.wood, 6.6, 0.88, -6.2);
  meal.userData.noCollide = true;
  meal.userData.dress = { prop: 'bowl-soup', fit: 'height', value: 0.16 };
  group.add(meal);
  decor(group, box(0.5, 0.7, 0.5, mats.wood, 2.4, 0.38, -10.2), 'pottedPlant', 'height', 0.7);

  const desk = decor(group, box(1.3, 0.75, 0.7, mats.wood, -12.6, 0.4, 2.2), 'table', 'height', 0.75);
  desk.name = 'kids-desk';
  decor(group, box(0.5, 0.7, 0.5, mats.wood, -12.6, 0.38, 3.3), 'loungeChair', 'height', 0.75);
  decor(group, box(0.55, 1.7, 1.2, mats.wood, -14.8, 0.88, 6.2), 'bookcaseOpen', 'height', 1.7);
  const kidsRug = box(3.4, 0.04, 2.4, new THREE.MeshStandardMaterial({ color: 0x3d9b8f }), -11, 0.03, 7.1);
  kidsRug.userData.noCollide = true;
  group.add(kidsRug);
  group.add(box(0.9, 0.45, 0.7, mats.wood, -14.2, 0.26, 8.6));
  decor(group, box(1.5, 0.4, 0.9, new THREE.MeshStandardMaterial({ color: 0xf0d3a8 }), -8.8, 0.22, 9.2), 'pillowBlue', 'width', 0.7);
  const blocks = box(0.28, 0.28, 0.28, mats.play, -11.4, 0.16, 6.6);
  blocks.userData.noCollide = true;
  group.add(blocks);

  group.add(box(1.7, 0.55, 0.75, new THREE.MeshStandardMaterial({ color: 0xf7f8fb, roughness: 0.35 }), 12.6, 0.3, 9.3));
  group.add(box(0.7, 0.8, 0.5, new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: 0.4 }), 9.3, 0.42, 9.5));
  group.add(box(0.8, 0.95, 0.7, mats.metal, 14.4, 0.5, 6.2));
  decor(group, box(0.45, 1.3, 0.4, mats.wood, 14.6, 0.68, 3.3), 'bookcaseOpen', 'height', 1.3);
  const mirror = box(0.7, 0.9, 0.06, mats.glass, 9.3, 1.7, 10.4);
  mirror.userData.noCollide = true;
  group.add(mirror);

  interactables.push({
    id: `sit-sofa-${kind}`,
    label: 'לשבת על הספה',
    position: new THREE.Vector3(-2.2, 0, 5.1),
    radius: 1.8,
    type: 'activity',
    data: { action: 'sitSofa' },
  });
  interactables.push({
    id: `radio-${kind}`,
    label: 'להדליק/לכבות מוזיקה',
    position: new THREE.Vector3(3.6, 0, 8.2),
    radius: 1.5,
    type: 'activity',
    data: { action: 'toggleMusic' },
  });
  interactables.push({
    id: `meal-${kind}`,
    label: 'לשבת לארוחה משפחתית',
    position: new THREE.Vector3(6.6, 0, -4.6),
    radius: 1.8,
    type: 'activity',
    data: { action: 'playScene', scene: 'family-meal', task: 'eat' },
  });
  interactables.push({
    id: `story-${kind}`,
    label: 'סיפור לפני השינה',
    position: new THREE.Vector3(-10, 0, -6.2),
    radius: 1.8,
    type: 'activity',
    data: { action: 'playScene', scene: 'bedtime', task: 'rest' },
  });
  interactables.push({
    id: `game-night-${kind}`,
    label: 'ערב משחקים בסלון',
    position: new THREE.Vector3(0.2, 0, 4.2),
    radius: 1.8,
    type: 'activity',
    data: { action: 'playScene', scene: 'game-night', task: 'playBall' },
  });
  interactables.push({
    id: `build-${kind}`,
    label: 'לבנות עם האח על השטיח',
    position: new THREE.Vector3(-11, 0, 6.4),
    radius: 1.8,
    type: 'activity',
    data: { action: 'playScene', scene: 'build-together', task: 'playBlocks' },
  });

    const album = box(1.5, 1, 0.06, mats.wood, -4.4, 1.7, -0.82);
    album.userData.noCollide = true;
    group.add(album);
    interactables.push({
      id: 'album',
      label: 'לפתוח אלבום הצלחות',
      position: new THREE.Vector3(-4.4, 0, -1.6),
      radius: 1.5,
      type: 'album',
    });
    for (let i = 0; i < 5; i++) {
      const toy = box(0.32, 0.32, 0.32, mats.play, -12.2 + (i % 3) * 0.5, 0.18, 7.6 + Math.floor(i / 3) * 0.5);
      toy.name = `mess-toy-${i}`;
      toy.visible = false;
      group.add(toy);
    }
    const furniture = [
      { id: 'plant-pot', label: 'להזיז עציץ', x: 3.3, z: 2.5 },
      { id: 'chair', label: 'להזיז כיסא', x: 4.4, z: -4.5 },
      { id: 'toybox', label: 'להזיז ארגז צעצועים', x: -13.4, z: 8.8 },
    ];
    for (const item of furniture) {
      const mesh = box(0.7, 0.7, 0.7, mats.wood, item.x, 0.35, item.z);
      mesh.name = item.id;
      if (item.id === 'plant-pot') mesh.userData.dress = { prop: 'pottedPlant', fit: 'height', value: 0.7 };
      if (item.id === 'chair') mesh.userData.dress = { prop: 'loungeChair', fit: 'height', value: 0.85 };
      group.add(mesh);
      interactables.push({
        id: item.id,
        label: item.label,
        position: new THREE.Vector3(item.x, 0, item.z),
        radius: 1.6,
        type: 'furniture',
        mesh,
        data: { movable: true },
      });
    }
    const cup = cyl(0.12, 0.22, mats.glass, 7.2, 0.95, -6.2);
    cup.userData.noCollide = true;
    group.add(cup);
    interactables.push({
      id: 'spill-cup',
      label: 'לגעת בכוס על השולחן',
      position: new THREE.Vector3(7.2, 0, -5.4),
      radius: 1.4,
      type: 'activity',
      data: { situation: 'spilled_drink' },
    });
    interactables.push({
      id: 'lie-bed',
      label: 'לשכב על המיטה',
      position: new THREE.Vector3(-10, 0, -6.5),
      radius: 1.6,
      type: 'activity',
      data: { action: 'lieBed' },
    });
    interactables.push({
      id: 'fridge',
      label: 'לאכול משהו מהמקרר',
      position: new THREE.Vector3(13.2, 0, -9.2),
      radius: 1.6,
      type: 'activity',
      data: { action: 'eat' },
    });
  } else if (kind === 'blue') {
    furnishBlue(group, interactables);
  } else {
    furnishYellow(group, interactables);
  }

  interactables.push({
    id: `exit-home-${kind}`,
    label: 'לצאת מהדלת לשכונה',
    position: new THREE.Vector3(0, 0, 10.2),
    radius: 2.2,
    type: 'door',
    data: { target: 'neighborhood' },
  });
  const door = box(1.6, 2.6, 0.16, mats.door, 0, 1.3, 11.72);
  door.name = 'home-door';
  group.add(door);
  group.add(box(0.16, 3.3, 0.24, mats.wood, -1.35, 1.65, 11.72));
  group.add(box(0.16, 3.3, 0.24, mats.wood, 1.35, 1.65, 11.72));
  group.add(box(0.08, 0.08, 0.1, mats.metal, 0.55, 1.2, 11.6));

  const homeZone: ZoneId = kind === 'player' ? 'home' : kind === 'blue' ? 'home_blue' : 'home_yellow';
  addEncounters(homeZone, group, interactables);

  const npcSpawns =
    kind === 'player'
      ? [
          { id: 'mom', position: new THREE.Vector3(9.4, 0, -7.6) },
          { id: 'dad', position: new THREE.Vector3(1.6, 0, 7.4) },
          { id: 'brother', position: new THREE.Vector3(-10.6, 0, 6.6) },
        ]
      : kind === 'blue'
        ? [
            { id: 'noam', position: new THREE.Vector3(-8, 0, 1.8) },
            { id: 'dad', position: new THREE.Vector3(4.2, 0, 3.2) },
          ]
        : [
            { id: 'maya', position: new THREE.Vector3(10.6, 0, -4) },
            { id: 'neighbor', position: new THREE.Vector3(2.4, 0, 5.2) },
          ];

  return {
    group,
    interactables,
    spawn: new THREE.Vector3(0.2, 0, 3.2),
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
  for (const teacher of TEACHERS) {
    const color = teacher.id === 'teacher' ? 0x2f6b4f : 0x245c8a;
    group.add(box(2.2, 2.5, 0.12, new THREE.MeshStandardMaterial({ color }), teacher.x, 1.7, -11.9));
  }
  // Yard
  group.add(box(24, 0.15, 18, mats.grass, 12, 0.02, 5));
  group.add(box(1.2, 0.3, 1.2, mats.play, 3.2, 0.3, 1.2));
  group.add(cyl(0.8, 0.2, mats.sand, 10, 0.15, 6));

  for (const seat of SCHOOL_SEATS) {
    const desk = box(1.15, 0.7, 0.7, mats.wood, seat.x, 0.35, seat.deskZ);
    desk.userData.dress = { prop: 'table', fit: 'height', value: 0.72 };
    group.add(desk);
    group.add(box(0.42, 0.42, 0.42, mats.play, seat.x, 0.22, seat.deskZ + 0.52));
    if (!seat.forPlayer) continue;
    interactables.push({
      id: `sit-${seat.id}`,
      label: 'לשבת ליד השולחן',
      position: new THREE.Vector3(seat.sitX, 0, seat.sitZ + 0.8),
      radius: 1.15,
      type: 'activity',
      data: { action: 'sitDesk', x: seat.sitX, z: seat.sitZ, standZ: seat.sitZ + 0.85, yaw: seat.yaw },
    });
  }
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
    position: new THREE.Vector3(12, 0, 6),
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
  addEncounters('school', group, interactables);

  return {
    group,
    interactables,
    spawn: new THREE.Vector3(-8, 0, 4),
    npcSpawns: schoolSpawns(),
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
  addEncounters('shop', group, interactables);

  return {
    group,
    interactables,
    spawn: new THREE.Vector3(0, 0, 1.2),
    npcSpawns: [{ id: 'shopkeeper', position: new THREE.Vector3(1.7, 0, 3.5) }],
  };
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

  buildPlayground(group);
  for (const spot of playgroundSpots()) {
    interactables.push({
      id: `ride-${spot.id}-${spot.slot}`,
      label: spot.label,
      position: new THREE.Vector3(spot.x, 0, spot.z),
      radius: 1.65,
      type: 'activity',
      data: { action: 'ride', ride: spot.id, slot: spot.slot },
    });
  }
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
  addEncounters('park', group, interactables);

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

function buildLuna(): ZoneBuildResult {
  const group = new THREE.Group();
  group.name = 'zone-luna';
  const interactables: Interactable[] = [];

  group.add(box(68, 0.2, 58, mats.grass, 0, -0.1, 2));
  for (const [x, z] of [
    [-30, 18],
    [30, 18],
    [-30, -18],
    [30, -18],
    [0, -20],
  ]) {
    group.add(tree(x, z));
  }
  group.add(bench(8, 14));
  group.add(bench(-8, 14, Math.PI));

  buildLunaPark(group);
  for (const spot of lunaSpots()) {
    interactables.push({
      id: `ride-${spot.id}-${spot.slot}`,
      label: spot.label,
      position: new THREE.Vector3(spot.x, 0, spot.z),
      radius: 1.05,
      type: 'activity',
      data: { action: 'ride', ride: spot.id, slot: spot.slot },
    });
  }
  for (const line of lunaQueues()) {
    interactables.push({
      id: `queue-${line.id}`,
      label: line.label,
      position: new THREE.Vector3(line.x, 0, line.z),
      radius: 2.2,
      type: 'activity',
      data: { action: 'queue', ride: line.id },
    });
  }
  interactables.push({
    id: 'luna-ticket',
    label: `לקנות כרטיס למתקן — ${RIDE_TICKET_PRICE}₪`,
    position: new THREE.Vector3(-6.2, 0, 17.3),
    radius: 2.4,
    type: 'activity',
    data: { action: 'buyTicket' },
  });
  interactables.push({
    id: 'luna-snacks',
    label: 'לקנות בדוכן החטיפים',
    position: new THREE.Vector3(6.2, 0, 17.3),
    radius: 2.4,
    type: 'activity',
    data: { action: 'fairSnacks' },
  });
  interactables.push({
    id: 'exit-luna',
    label: 'לחזור לשכונה',
    position: new THREE.Vector3(0, 0, 23.2),
    radius: 2.4,
    type: 'door',
    data: { target: 'neighborhood' },
  });
  addEncounters('luna', group, interactables);

  return {
    group,
    interactables,
    spawn: new THREE.Vector3(0, 0, 20),
    npcSpawns: [
      { id: 'dani', position: new THREE.Vector3(-2, 0, 15) },
      { id: 'noam', position: new THREE.Vector3(2, 0, 14) },
      { id: 'maya', position: new THREE.Vector3(-6, 0, 12) },
    ],
  };
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
  addEncounters('zoo', group, interactables);

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
