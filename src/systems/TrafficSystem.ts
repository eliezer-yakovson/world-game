import * as THREE from 'three';
import { vehicleModel } from '../world/PropLibrary';

interface Car {
  mesh: THREE.Group;
  t: number;
  speed: number;
  path: THREE.Vector3[];
}

export class TrafficSystem {
  private cars: Car[] = [];
  private group = new THREE.Group();
  private bus: Car | null = null;
  private lightsGreen = true;
  private lightTimer = 0;

  get root(): THREE.Group {
    return this.group;
  }

  getObstacles(): Array<{ x: number; z: number; radius: number }> {
    const obstacles = this.cars.map((car) => ({
      x: car.mesh.position.x,
      z: car.mesh.position.z,
      radius: 1.15,
    }));
    if (this.bus) {
      obstacles.push({ x: this.bus.mesh.position.x, z: this.bus.mesh.position.z, radius: 1.7 });
    }
    return obstacles;
  }

  clear(): void {
    while (this.group.children.length) this.group.remove(this.group.children[0]);
    this.cars = [];
    this.bus = null;
  }

  setup(path: THREE.Vector3[] | undefined, parent: THREE.Group): void {
    this.clear();
    this.group.name = 'traffic';
    parent.add(this.group);
    if (!path || path.length < 2) return;

    for (let i = 0; i < 4; i++) {
      const car = this.makeVehicle(i, false);
      this.cars.push({
        mesh: car,
        t: i / 4,
        speed: 0.05 + Math.random() * 0.03,
        path,
      });
      this.group.add(car);
    }

    const busMesh = this.makeVehicle(0, true);
    this.bus = { mesh: busMesh, t: 0.1, speed: 0.035, path };
    this.group.add(busMesh);
  }

  update(dt: number): void {
    this.lightTimer += dt;
    if (this.lightTimer > 8) {
      this.lightTimer = 0;
      this.lightsGreen = !this.lightsGreen;
    }

    const all = [...this.cars, ...(this.bus ? [this.bus] : [])];
    for (const car of all) {
      const nearCrosswalk = car.t > 0.28 && car.t < 0.42;
      const speed = !this.lightsGreen && nearCrosswalk ? 0 : car.speed;
      car.t = (car.t + speed * dt) % 1;
      const pos = this.samplePath(car.path, car.t);
      const next = this.samplePath(car.path, (car.t + 0.01) % 1);
      car.mesh.position.copy(pos);
      car.mesh.lookAt(next.x, pos.y, next.z);
    }
  }

  getBusPosition(): THREE.Vector3 | null {
    return this.bus ? this.bus.mesh.position.clone() : null;
  }

  private samplePath(path: THREE.Vector3[], t: number): THREE.Vector3 {
    const total = path.length - 1;
    const f = t * total;
    const i = Math.floor(f);
    const frac = f - i;
    const a = path[Math.min(i, path.length - 1)];
    const b = path[Math.min(i + 1, path.length - 1)];
    return new THREE.Vector3().lerpVectors(a, b, frac);
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
      new THREE.BoxGeometry(isBus ? 2.4 : 1.8, isBus ? 1.4 : 0.7, isBus ? 5.5 : 3.4),
      new THREE.MeshStandardMaterial({ color: isBus ? 0xf0c040 : 0xcc4444 }),
    );
    body.position.y = isBus ? 0.9 : 0.45;
    body.castShadow = true;
    g.add(body);
    return g;
  }
}
