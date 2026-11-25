import * as THREE from 'three';
import type { ZoneId } from '../core/types';
import { buildZone, type Interactable, type ZoneBuildResult } from './ZoneBuilder';
import { bus } from '../core/EventBus';

export class ZoneManager {
  current: ZoneId = 'home';
  private result: ZoneBuildResult | null = null;
  private root = new THREE.Group();

  get group(): THREE.Group {
    return this.root;
  }

  get interactables(): Interactable[] {
    return this.result?.interactables ?? [];
  }

  get npcSpawns() {
    return this.result?.npcSpawns ?? [];
  }

  get carPath() {
    return this.result?.carPath;
  }

  get spawn(): THREE.Vector3 {
    return this.result?.spawn.clone() ?? new THREE.Vector3();
  }

  load(zone: ZoneId, scene: THREE.Scene): ZoneBuildResult {
    if (this.result) {
      scene.remove(this.root);
      this.root.clear();
    }
    this.current = zone;
    this.result = buildZone(zone);
    this.root = this.result.group;
    scene.add(this.root);
    bus.emit('zone-changed', zone);
    return this.result;
  }

  nearestInteractable(pos: THREE.Vector3, radius = 2.4): Interactable | null {
    let best: Interactable | null = null;
    let bestD = radius;
    for (const it of this.interactables) {
      const d = it.position.distanceTo(pos);
      const reach = Math.min(radius, it.radius);
      if (d <= reach && d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best;
  }
}
