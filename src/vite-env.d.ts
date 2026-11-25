/// <reference types="vite/client" />

declare module '*.json' {
  const value: unknown;
  export default value;
}

declare module 'yuka' {
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
    set(x: number, y: number, z: number): this;
  }

  export class Path {
    loop: boolean;
    add(v: Vector3): this;
  }

  export class SteeringManager {
    add(behavior: unknown): this;
  }

  export class Vehicle {
    position: Vector3;
    velocity: Vector3;
    maxSpeed: number;
    steering: SteeringManager;
    getSpeed(): number;
  }

  export class FollowPathBehavior {
    constructor(path: Path, radius?: number);
  }

  export class EntityManager {
    add(entity: Vehicle): this;
    remove(entity: Vehicle): this;
    update(delta: number): this;
  }

  export class Time {
    update(): this;
    getDelta(): number;
  }
}
