export type StrengthId =
  | 'speech'
  | 'courage'
  | 'flexibility'
  | 'responsibility'
  | 'restraint'
  | 'friendship'
  | 'creativity';

export type ZoneId =
  | 'neighborhood'
  | 'home'
  | 'home_blue'
  | 'home_yellow'
  | 'school'
  | 'shop'
  | 'park'
  | 'zoo';

export type Weather = 'clear' | 'rain' | 'cloudy';

export type Mood = 'happy' | 'neutral' | 'sad' | 'angry' | 'tired' | 'excited' | 'anxious';

export interface StrengthMap {
  speech: number;
  courage: number;
  flexibility: number;
  responsibility: number;
  restraint: number;
  friendship: number;
  creativity: number;
}

export interface NeedsState {
  hunger: number;
  fatigue: number;
}

export interface DiaryEntry {
  timeLabel: string;
  text: string;
}

export interface NpcProfile {
  id: string;
  name: string;
  role: string;
  home: string;
  workOrSchool: string;
  traits: string[];
  strengths: Partial<StrengthMap>;
  color: number;
  mood: Mood;
  trustTowardPlayer: number;
  friendship?: number;
  diary: DiaryEntry[];
}

export interface PlayerProfile {
  id: string;
  name: string;
  description: string;
  homeId: string;
  schoolClass: string;
  familyIds: string[];
  friendIds: string[];
  strengths: StrengthMap;
  color: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  kind: 'food' | 'toy' | 'furniture' | 'tool' | 'gift' | 'misc';
  stack?: number;
}

export interface ShopProduct {
  id: string;
  name: string;
  kind: InventoryItem['kind'];
  moneyCost: number;
  strengthCost: Partial<StrengthMap>;
  deliveryCost: number;
  breakRisk: number;
  description: string;
}

export interface SituationChoice {
  id: string;
  label: string;
  impulsive?: boolean;
  requiresBreathe?: boolean;
  unlockStrength?: Partial<StrengthMap>;
  awards: Partial<StrengthMap>;
  trustDelta?: Record<string, number>;
  moodDelta?: Record<string, Mood>;
  followUpText: string;
  animation?: string;
}

export interface SituationDef {
  id: string;
  title: string;
  location: ZoneId | string;
  description: string;
  emotion: string;
  tense?: boolean;
  hungerNote?: string;
  fatigueNote?: string;
  choices: SituationChoice[];
  summaryTemplate: string;
}

export interface CalendarEvent {
  day: number;
  id: string;
  title: string;
  description: string;
  zone?: ZoneId;
}

export interface AlbumEntry {
  id: string;
  title: string;
  icon: string;
  day: number;
  timeLabel: string;
}

export interface WeeklyGoal {
  id: string;
  title: string;
  progress: number;
  target: number;
  rewardMoney: number;
  rewardStrength?: Partial<StrengthMap>;
}

export interface GameSave {
  version: number;
  slot: number;
  day: number;
  minutes: number;
  zone: ZoneId;
  playerId: string;
  money: number;
  strengths: StrengthMap;
  needs: NeedsState;
  inventory: InventoryItem[];
  trust: Record<string, number>;
  friendship: Record<string, number>;
  diary: Record<string, DiaryEntry[]>;
  album: AlbumEntry[];
  unlockedZones: ZoneId[];
  hasBike: boolean;
  hasScooter: boolean;
  hasUpgradedBag: boolean;
  homeLayout: Array<{ id: string; x: number; z: number }>;
  messLevel: number;
  weather: Weather;
  weeklyGoals: WeeklyGoal[];
  settings: GameSettings;
}

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  voVolume: number;
  subtitles: boolean;
  fontScale: number;
  cameraSensitivity: number;
  emotionalDifficulty: 'easy' | 'normal' | 'hard';
  /** Sandbox: every place, purchase, and invitation is available. */
  freePlay: boolean;
}

export const STRENGTH_LABELS: Record<StrengthId, string> = {
  speech: 'דיבור',
  courage: 'אומץ',
  flexibility: 'גמישות',
  responsibility: 'אחריות',
  restraint: 'איפוק',
  friendship: 'חברות',
  creativity: 'יצירתיות',
};

export const ZONE_LABELS: Record<ZoneId, string> = {
  neighborhood: 'השכונה',
  home: 'הבית שלי',
  home_blue: 'הבית הכחול',
  home_yellow: 'הבית הצהוב',
  school: 'בית הספר',
  shop: 'המכולת',
  park: 'הפארק',
  zoo: 'גן החיות',
};

export function emptyStrengths(base = 0): StrengthMap {
  return {
    speech: base,
    courage: base,
    flexibility: base,
    responsibility: base,
    restraint: base,
    friendship: base,
    creativity: base,
  };
}
