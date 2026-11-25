import * as THREE from 'three';
import { bus } from '../core/EventBus';

export class HomeLifeSystem {
  messLevel = 0;
  private toys: THREE.Object3D[] = [];

  bindToys(group: THREE.Group): void {
    this.toys = [];
    group.traverse((obj) => {
      if (obj.name.startsWith('mess-toy-')) this.toys.push(obj);
    });
    this.applyMessVisual();
  }

  increaseMess(amount = 1): void {
    this.messLevel = Math.min(5, this.messLevel + amount);
    this.applyMessVisual();
    bus.emit('mess-changed', this.messLevel);
  }

  tidy(): void {
    this.messLevel = 0;
    this.applyMessVisual();
    bus.emit('mess-changed', this.messLevel);
  }

  maybePlayMess(chance = 0.002): boolean {
    if (Math.random() > chance) return false;
    this.increaseMess(1);
    return true;
  }

  private applyMessVisual(): void {
    this.toys.forEach((toy, i) => {
      toy.visible = i < this.messLevel;
      toy.position.y = 0.2;
    });
  }
}
