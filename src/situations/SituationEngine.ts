import situationsData from '../../content/situations.json';
import type { SituationChoice, SituationDef } from '../core/types';
import type { MemoryStore } from '../core/MemoryStore';
import type { NeedsSystem } from '../systems/NeedsSystem';
import type { GameClock } from '../core/GameClock';
import { bus } from '../core/EventBus';

export interface ActiveSituation {
  def: SituationDef;
  breathed: boolean;
  description: string;
  emotion: string;
  availableChoices: SituationChoice[];
}

export class SituationEngine {
  private defs = situationsData as SituationDef[];
  active: ActiveSituation | null = null;

  constructor(
    private memory: MemoryStore,
    private needs: NeedsSystem,
    private clock: GameClock,
  ) {}

  getById(id: string): SituationDef | undefined {
    return this.defs.find((s) => s.id === id);
  }

  start(id: string, difficulty: 'easy' | 'normal' | 'hard' = 'normal'): boolean {
    const def = this.getById(id);
    if (!def || this.active) return false;

    let emotion = def.emotion;
    const description = def.description;
    if (this.needs.isTired && def.fatigueNote) {
      emotion += ` ${def.fatigueNote}`;
    }
    if (this.needs.isHungry && def.hungerNote) {
      emotion += ` ${def.hungerNote}`;
    }

    const easy = difficulty === 'easy';
    this.active = {
      def,
      breathed: easy,
      description,
      emotion,
      availableChoices: easy ? [...def.choices] : def.choices.filter((c) => !c.requiresBreathe),
    };

    bus.emit('situation-started', this.active);
    return true;
  }

  breathe(): void {
    if (!this.active || this.active.breathed) return;
    this.active.breathed = true;
    this.active.availableChoices = [...this.active.def.choices];
    bus.emit('situation-breathed', this.active);
  }

  choose(choiceId: string): void {
    if (!this.active) return;
    const choice = this.active.availableChoices.find((c) => c.id === choiceId);
    if (!choice) return;

    const multiplier = this.needs.strengthMultiplier;
    const gained = this.memory.addStrengths(choice.awards, multiplier);

    if (choice.trustDelta) {
      for (const [npcId, delta] of Object.entries(choice.trustDelta)) {
        this.memory.adjustTrust(npcId, delta);
      }
    }
    if (choice.moodDelta) {
      for (const [npcId, mood] of Object.entries(choice.moodDelta)) {
        this.memory.setMood(npcId, mood);
      }
    }

    this.memory.remember(this.clock.day, this.clock.timeLabel, `${this.active.def.title}: ${choice.label}`);
    this.memory.addDiary('player', this.clock.timeLabel, choice.followUpText);

    const summary = `${this.active.def.summaryTemplate} ${choice.followUpText}`;
    const result = { choice, gained, summary };
    const completedId = this.active.def.id;
    this.active = null;
    bus.emit('situation-completed', { ...result, situationId: completedId });
  }

  cancel(): void {
    this.active = null;
    bus.emit('situation-cancelled', null);
  }
}
