import { bus } from '../core/EventBus';
import type { NeedsState } from '../core/types';

export class NeedsSystem {
  hunger = 30;
  fatigue = 20;

  get state(): NeedsState {
    return { hunger: this.hunger, fatigue: this.fatigue };
  }

  get isHungry(): boolean {
    return this.hunger >= 70;
  }

  get isTired(): boolean {
    return this.fatigue >= 70;
  }

  get strengthMultiplier(): number {
    return this.isHungry || this.isTired ? 2 : 1;
  }

  update(dtGameMinutes: number): void {
    this.hunger = Math.min(100, this.hunger + dtGameMinutes * 0.04);
    this.fatigue = Math.min(100, this.fatigue + dtGameMinutes * 0.03);
    bus.emit('needs-changed', this.state);
  }

  eat(amount = 35): void {
    this.hunger = Math.max(0, this.hunger - amount);
    bus.emit('needs-changed', this.state);
  }

  sleep(amount = 60): void {
    this.fatigue = Math.max(0, this.fatigue - amount);
    bus.emit('needs-changed', this.state);
  }

  set(state: NeedsState): void {
    this.hunger = state.hunger;
    this.fatigue = state.fatigue;
  }
}
