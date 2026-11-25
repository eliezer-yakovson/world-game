import type { GameSave, GameSettings, ZoneId } from './types';
import { emptyStrengths } from './types';

const PREFIX = 'world-game-save-';
const SETTINGS_KEY = 'world-game-settings';

export const DEFAULT_SETTINGS: GameSettings = {
  musicVolume: 0.5,
  sfxVolume: 0.7,
  voVolume: 0.9,
  subtitles: true,
  fontScale: 1,
  cameraSensitivity: 1,
  emotionalDifficulty: 'normal',
  freePlay: false,
};

export function createEmptySave(playerId: string, slot = 1): GameSave {
  return {
    version: 1,
    slot,
    day: 1,
    minutes: 8 * 60,
    zone: 'home',
    playerId,
    money: 25,
    strengths: emptyStrengths(3),
    needs: { hunger: 30, fatigue: 20 },
    inventory: [],
    trust: {},
    friendship: {},
    diary: {},
    album: [],
    unlockedZones: ['neighborhood', 'home'],
    hasBike: false,
    hasScooter: false,
    hasUpgradedBag: false,
    homeLayout: [],
    messLevel: 0,
    weather: 'clear',
    weeklyGoals: [
      { id: 'tidy', title: 'סדר את הבית פעמיים', progress: 0, target: 2, rewardMoney: 10 },
      { id: 'school', title: 'השתתף ב־3 שיעורים', progress: 0, target: 3, rewardMoney: 15, rewardStrength: { courage: 1 } },
      { id: 'friend', title: 'הזמן חבר הביתה', progress: 0, target: 1, rewardMoney: 8, rewardStrength: { friendship: 2 } },
    ],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export class SaveSystem {
  save(slot: number, data: GameSave): void {
    data.slot = slot;
    localStorage.setItem(PREFIX + slot, JSON.stringify(data));
    busNotify(slot);
  }

  load(slot: number): GameSave | null {
    const raw = localStorage.getItem(PREFIX + slot);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as GameSave;
    } catch {
      return null;
    }
  }

  listSlots(): Array<{ slot: number; exists: boolean; summary?: string }> {
    return [1, 2, 3].map((slot) => {
      const data = this.load(slot);
      if (!data) return { slot, exists: false };
      return {
        slot,
        exists: true,
        summary: `יום ${data.day} · ${Math.floor(data.minutes / 60)
          .toString()
          .padStart(2, '0')}:${(data.minutes % 60).toString().padStart(2, '0')}`,
      };
    });
  }

  autosave(data: GameSave): void {
    this.save(0, { ...data, slot: 0 });
  }

  loadAutosave(): GameSave | null {
    return this.load(0);
  }

  saveSettings(settings: GameSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  loadSettings(): GameSettings {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    try {
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as GameSettings) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
}

function busNotify(slot: number): void {
  // deferred import avoided — optional hook
  void slot;
}

export function unlockZone(zones: ZoneId[], zone: ZoneId): ZoneId[] {
  if (zones.includes(zone)) return zones;
  return [...zones, zone];
}
