import { bus } from '../core/EventBus';
import type { InventoryItem } from '../core/types';

export class InventorySystem {
  items: InventoryItem[] = [];
  capacity = 8;

  set(items: InventoryItem[]): void {
    this.items = items;
    bus.emit('inventory-changed', this.items);
  }

  add(item: InventoryItem): boolean {
    if (this.items.length >= this.capacity) return false;
    this.items.push(item);
    bus.emit('inventory-changed', this.items);
    return true;
  }

  remove(id: string): InventoryItem | null {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    const [item] = this.items.splice(idx, 1);
    bus.emit('inventory-changed', this.items);
    return item;
  }

  has(id: string): boolean {
    return this.items.some((i) => i.id === id);
  }
}
