import type { MemoryStore } from '../core/MemoryStore';
import type { ShopProduct } from '../core/types';
import { bus } from '../core/EventBus';

export class StrengthEconomy {
  money = 25;
  freePlay = false;

  constructor(private memory: MemoryStore) {}

  canBuy(product: ShopProduct): boolean {
    if (this.freePlay) return true;
    if (this.money < product.moneyCost) return false;
    return this.memory.canAfford(product.strengthCost);
  }

  buy(product: ShopProduct): boolean {
    if (!this.canBuy(product)) return false;
    if (!this.freePlay) {
      this.money -= product.moneyCost;
      this.memory.spendStrengths(product.strengthCost);
      bus.emit('money-changed', this.money);
    }
    return true;
  }

  payDelivery(cost: number): boolean {
    if (this.freePlay) return true;
    if (this.money < cost) return false;
    this.money -= cost;
    bus.emit('money-changed', this.money);
    return true;
  }

  addMoney(amount: number): void {
    this.money += amount;
    bus.emit('money-changed', this.money);
  }

  breakRisk(product: ShopProduct, hasUpgradedBag: boolean): number {
    if (this.freePlay) return 0;
    const base = product.breakRisk;
    return hasUpgradedBag ? base * 0.25 : base;
  }
}
