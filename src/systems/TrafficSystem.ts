import * as THREE from 'three';
import { trafficLightModel, vehicleModel } from '../world/PropLibrary';
import type { TrafficLightSpot } from '../world/ZoneBuilder';

interface Lane {
  points: THREE.Vector3[];
  segLen: number[];
  total: number;
}

interface Vehicle {
  mesh: THREE.Group;
  lane: Lane;
  distance: number;
  cruise: number;
  half: number;
  isBus: boolean;
  forward: THREE.Vector3;
  pos: THREE.Vector3;
}

interface Signal {
  axis: 'x' | 'z';
  red: THREE.MeshStandardMaterial;
  green: THREE.MeshStandardMaterial;
}

const bulbGeo = new THREE.SphereGeometry(0.16, 10, 8);

/**
 * Cars ride closed right-hand lanes. A faster car slows to the gap ahead,
 * a red light holds it before the junction, and a car already in the box
 * has priority. Nothing shares a point, so they can't stack.
 */
export class TrafficSystem {
  private vehicles: Vehicle[] = [];
  private group = new THREE.Group();
  private signals: Signal[] = [];
  private crossings: Array<{ x: number; z: number }> = [];
  private ewGreen = true;
  private lightTimer = 0;

  get root(): THREE.Group {
    return this.group;
  }

  getObstacles(): Array<{ x: number; z: number; radius: number }> {
    return this.vehicles.map((car) => ({
      x: car.mesh.position.x,
      z: car.mesh.position.z,
      radius: car.isBus ? 1.7 : 1.15,
    }));
  }

  clear(): void {
    while (this.group.children.length) this.group.remove(this.group.children[0]);
    for (const signal of this.signals) {
      signal.red.dispose();
      signal.green.dispose();
    }
    this.vehicles = [];
    this.signals = [];
    this.crossings = [];
  }

  setup(lanes: THREE.Vector3[][] | undefined, lights: TrafficLightSpot[] | undefined, parent: THREE.Group): void {
    this.clear();
    this.group.name = 'traffic';
    parent.add(this.group);
    this.ewGreen = true;
    this.lightTimer = 0;
    for (const spot of lights ?? []) {
      this.addSignal(spot);
      if (!this.crossings.some((c) => Math.hypot(c.x - spot.faceX, c.z - spot.faceZ) < 0.5)) {
        this.crossings.push({ x: spot.faceX, z: spot.faceZ });
      }
    }
    if (!lanes || lanes.length === 0) return;

    const compiled = lanes.map((points) => this.compile(points)).filter((lane) => lane.total > 8);
    compiled.forEach((lane, laneIndex) => {
      const count = laneIndex === compiled.length - 1 ? 4 : 5;
      for (let i = 0; i < count; i++) {
        this.spawn(lane, ((i + 0.35) / count) * lane.total, 4.2 + ((laneIndex * 3 + i) % 5) * 0.4, false);
      }
    });
    const main = compiled[compiled.length - 1];
    if (main) this.spawn(main, main.total * 0.2, 3.4, true);
    this.paintSignals();
  }

  update(dt: number): void {
    this.lightTimer += dt;
    if (this.lightTimer > 8) {
      this.lightTimer = 0;
      this.ewGreen = !this.ewGreen;
      this.paintSignals();
    }

    for (const car of this.vehicles) {
      let speed = car.cruise;
      const gap = this.gapAhead(car);
      if (gap < 14) speed *= Math.max(0, (gap - 3) / 11);
      speed = Math.min(speed, this.crossingSpeed(car));
      car.distance = this.wrap(car.distance + Math.max(0, speed) * dt, car.lane.total);
      this.pose(car);
    }

    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < this.vehicles.length; i++) {
        const a = this.vehicles[i];
        for (let j = 0; j < this.vehicles.length; j++) {
          if (i === j) continue;
          const b = this.vehicles[j];
          const dx = b.pos.x - a.pos.x;
          const dz = b.pos.z - a.pos.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.001 || dist > 6) continue;
          const along = a.forward.x * dx + a.forward.z * dz;
          const lateral = Math.sqrt(Math.max(0, dist * dist - along * along));
          if (lateral < 1.35 && along > 0 && dist < 5.8) {
            a.distance = this.wrap(a.distance - (5.8 - dist), a.lane.total);
            this.pose(a);
          } else if (dist < 2.4 && along > 0) {
            a.distance = this.wrap(a.distance - (2.8 - dist), a.lane.total);
            this.pose(a);
          }
        }
      }
    }

  }

  getBusPosition(): THREE.Vector3 | null {
    const bus = this.vehicles.find((car) => car.isBus);
    return bus ? bus.mesh.position.clone() : null;
  }

  private spawn(lane: Lane, distance: number, cruise: number, isBus: boolean): void {
    const mesh = this.makeVehicle(this.vehicles.length, isBus);
    const car: Vehicle = {
      mesh,
      lane,
      distance,
      cruise,
      half: isBus ? 2.55 : 1.7,
      isBus,
      forward: new THREE.Vector3(0, 0, 1),
      pos: new THREE.Vector3(),
    };
    this.vehicles.push(car);
    this.group.add(mesh);
    this.pose(car);
  }

  private gapAhead(car: Vehicle): number {
    let best = Infinity;
    for (const other of this.vehicles) {
      if (other === car || other.lane !== car.lane) continue;
      const gap = this.wrap(other.distance - car.distance, car.lane.total);
      const clear = gap - car.half - other.half;
      if (clear < best) best = clear;
    }
    return best;
  }

  /** 0 when this car must wait before a junction, otherwise no limit. */
  private crossingSpeed(car: Vehicle): number {
    const ax = Math.abs(car.forward.x);
    const az = Math.abs(car.forward.z);
    const turning = ax < az * 1.2 && az < ax * 1.2;
    const ew = ax >= az;
    const go = turning || (ew ? this.ewGreen : !this.ewGreen);
    for (const cross of this.crossings) {
      const dx = cross.x - car.pos.x;
      const dz = cross.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      // Inside 6m the car is committed and clears the box. Beyond 12.5m it is not at the light yet.
      if (dist < 6 || dist > 12.5) continue;
      const along = car.forward.x * dx + car.forward.z * dz;
      if (along < dist * 0.55) continue;
      if (!go) return 0;
      for (const other of this.vehicles) {
        if (other === car) continue;
        const od = Math.hypot(other.pos.x - cross.x, other.pos.z - cross.z);
        if (od > 6.2) continue;
        const parallel = Math.abs(car.forward.x * other.forward.x + car.forward.z * other.forward.z);
        if (parallel > 0.65) continue;
        return 0;
      }
    }
    return Infinity;
  }

  private pose(car: Vehicle): void {
    const pos = this.sample(car.lane, car.distance);
    const next = this.sample(car.lane, car.distance + 2.2);
    car.pos.copy(pos);
    car.mesh.position.copy(pos);
    const dx = next.x - pos.x;
    const dz = next.z - pos.z;
    const len = Math.hypot(dx, dz);
    if (len > 0.05) {
      car.forward.set(dx / len, 0, dz / len);
      car.mesh.lookAt(pos.x + car.forward.x, pos.y, pos.z + car.forward.z);
    }
  }

  private paintSignals(): void {
    for (const signal of this.signals) {
      const go = signal.axis === 'x' ? this.ewGreen : !this.ewGreen;
      signal.red.color.setHex(go ? 0x4a1515 : 0xff3b3b);
      signal.red.emissive.setHex(go ? 0x1a0000 : 0xff2020);
      signal.green.color.setHex(go ? 0x3dff55 : 0x12331a);
      signal.green.emissive.setHex(go ? 0x33ff44 : 0x002208);
    }
  }

  private addSignal(spot: TrafficLightSpot): void {
    const rig = new THREE.Group();
    const model = trafficLightModel(3.25);
    if (model) {
      rig.add(model);
    } else {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 3.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x2c3138 }),
      );
      pole.position.y = 1.6;
      rig.add(pole);
    }
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff2020 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x12331a, emissive: 0x002208 });
    const red = new THREE.Mesh(bulbGeo, redMat);
    const green = new THREE.Mesh(bulbGeo, greenMat);
    red.position.set(0, 2.95, 0.28);
    green.position.set(0, 2.5, 0.28);
    rig.add(red, green);
    rig.position.set(spot.x, 0, spot.z);
    rig.rotation.y = Math.atan2(spot.faceX - spot.x, spot.faceZ - spot.z);
    this.group.add(rig);
    this.signals.push({ axis: spot.axis, red: redMat, green: greenMat });
  }

  private compile(points: THREE.Vector3[]): Lane {
    const segLen: number[] = [];
    let total = 0;
    for (let i = 0; i < points.length; i++) {
      const len = points[i].distanceTo(points[(i + 1) % points.length]);
      segLen.push(len);
      total += len;
    }
    return { points, segLen, total };
  }

  private sample(lane: Lane, dist: number): THREE.Vector3 {
    let d = this.wrap(dist, lane.total);
    for (let i = 0; i < lane.points.length; i++) {
      const len = lane.segLen[i];
      if (d <= len || i === lane.points.length - 1) {
        const t = len > 0.0001 ? Math.min(1, d / len) : 0;
        return new THREE.Vector3().lerpVectors(lane.points[i], lane.points[(i + 1) % lane.points.length], t);
      }
      d -= len;
    }
    return lane.points[0].clone();
  }

  private wrap(dist: number, total: number): number {
    if (total <= 0) return 0;
    return ((dist % total) + total) % total;
  }

  private makeVehicle(index: number, isBus: boolean): THREE.Group {
    const g = new THREE.Group();
    const ids = ['sedan', 'suv', 'taxi', 'hatchback-sports'];
    const model = vehicleModel(isBus ? 'van' : ids[index % ids.length], isBus ? 2.15 : 1.4);
    if (model) {
      g.add(model);
      return g;
    }
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(isBus ? 2.2 : 1.7, isBus ? 1.5 : 0.7, isBus ? 5.1 : 3.3),
      new THREE.MeshStandardMaterial({ color: isBus ? 0xf0c040 : [0xcc4444, 0x3d6ea8, 0xe0b040, 0x4caf72][index % 4] }),
    );
    body.position.y = isBus ? 0.9 : 0.45;
    body.castShadow = true;
    g.add(body);
    return g;
  }
}
