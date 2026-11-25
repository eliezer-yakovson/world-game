import type { DiaryEntry, Mood, StrengthMap } from './types';
import { emptyStrengths } from './types';
import { bus } from './EventBus';

export class MemoryStore {
  strengths: StrengthMap = emptyStrengths(2);
  trust: Record<string, number> = {};
  friendship: Record<string, number> = {};
  moods: Record<string, Mood> = {};
  diaries: Record<string, DiaryEntry[]> = {};
  eventHistory: Array<{ day: number; time: string; text: string }> = [];

  ensureNpc(id: string, defaults?: { trust?: number; friendship?: number; mood?: Mood }): void {
    if (this.trust[id] === undefined) this.trust[id] = defaults?.trust ?? 50;
    if (this.friendship[id] === undefined) this.friendship[id] = defaults?.friendship ?? 20;
    if (!this.moods[id]) this.moods[id] = defaults?.mood ?? 'neutral';
    if (!this.diaries[id]) this.diaries[id] = [];
  }

  addStrengths(awards: Partial<StrengthMap>, multiplier = 1): StrengthMap {
    const gained = emptyStrengths(0);
    for (const key of Object.keys(awards) as (keyof StrengthMap)[]) {
      const amount = Math.round((awards[key] ?? 0) * multiplier);
      this.strengths[key] += amount;
      gained[key] = amount;
    }
    bus.emit('strengths-changed', this.strengths);
    return gained;
  }

  canAfford(cost: Partial<StrengthMap>): boolean {
    for (const key of Object.keys(cost) as (keyof StrengthMap)[]) {
      if (this.strengths[key] < (cost[key] ?? 0)) return false;
    }
    return true;
  }

  spendStrengths(cost: Partial<StrengthMap>): boolean {
    if (!this.canAfford(cost)) return false;
    for (const key of Object.keys(cost) as (keyof StrengthMap)[]) {
      this.strengths[key] -= cost[key] ?? 0;
    }
    bus.emit('strengths-changed', this.strengths);
    return true;
  }

  adjustTrust(npcId: string, delta: number): void {
    this.ensureNpc(npcId);
    this.trust[npcId] = Math.max(0, Math.min(100, this.trust[npcId] + delta));
    bus.emit('trust-changed', { npcId, trust: this.trust[npcId] });
  }

  adjustFriendship(npcId: string, delta: number): void {
    this.ensureNpc(npcId);
    this.friendship[npcId] = Math.max(0, Math.min(100, this.friendship[npcId] + delta));
    bus.emit('friendship-changed', { npcId, friendship: this.friendship[npcId] });
  }

  setMood(npcId: string, mood: Mood): void {
    this.ensureNpc(npcId);
    this.moods[npcId] = mood;
    bus.emit('mood-changed', { npcId, mood });
  }

  addDiary(npcId: string, timeLabel: string, text: string): void {
    this.ensureNpc(npcId);
    this.diaries[npcId].unshift({ timeLabel, text });
    if (this.diaries[npcId].length > 40) this.diaries[npcId].pop();
    bus.emit('diary-updated', { npcId, diary: this.diaries[npcId] });
  }

  remember(day: number, time: string, text: string): void {
    this.eventHistory.unshift({ day, time, text });
    if (this.eventHistory.length > 100) this.eventHistory.pop();
  }
}
