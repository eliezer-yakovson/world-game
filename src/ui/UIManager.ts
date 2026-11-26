import {
  STRENGTH_LABELS,
  ZONE_LABELS,
  type AlbumEntry,
  type GameSettings,
  type InventoryItem,
  type NpcProfile,
  type PlayerProfile,
  type ShopProduct,
  type StrengthMap,
  type WeeklyGoal,
  type ZoneId,
} from '../core/types';
import type { ActiveSituation } from '../situations/SituationEngine';
import { previewImage, recipeForChoiceKey, recipeForSituation } from './choiceShots';

export class UIManager {
  root: HTMLDivElement;
  private hint: HTMLDivElement;
  private clockEl: HTMLDivElement;
  private moneyEl: HTMLDivElement;
  private needsEl: HTMLDivElement;
  private overlay: HTMLDivElement;
  private inspector: HTMLDivElement;
  private phone: HTMLDivElement;
  private breatheBtn: HTMLButtonElement;
  private breatheOverlay: HTMLDivElement;
  private inventoryBar: HTMLDivElement;
  private caption: HTMLDivElement;
  private sceneDock: HTMLDivElement;
  private poseBar: HTMLDivElement;
  private rain: HTMLDivElement;
  private hudButtons: HTMLDivElement;
  private zoneLabel = 'הבית';
  private captionTimer = 0;

  onChoice?: (choiceId: string) => void;
  onBreathe?: () => void;
  onCharacterSelect?: (id: string, freePlay?: boolean) => void;
  onCloseOverlay?: () => void;
  onPhoneAction?: (action: string, payload?: string) => void;
  onShopBuy?: (productId: string, delivery: boolean) => void;
  onHudAction?: (action: string) => void;
  /** Close a panel that had frozen movement, without cancelling a situation. */
  onUnblock?: () => void;
  onPoseAction?: (action: 'up' | 'sleep') => void;
  onSettingsChange?: (settings: Partial<GameSettings>) => void;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'ui-root';
    parent.appendChild(this.root);

    this.root.innerHTML = `
      <div class="weather-rain" id="rain"></div>
      <div class="hud-top">
        <div class="hud-right-stack">
          <div class="hud-chip" id="clock-chip">יום 1 · 08:00 · בהיר</div>
          <div class="hud-chip" id="needs-chip">
            רעב <div class="needs-bar"><span id="hunger-bar" style="width:30%"></span></div>
            עייפות <div class="needs-bar tired"><span id="fatigue-bar" style="width:20%"></span></div>
          </div>
        </div>
        <div class="hud-left-stack">
          <div class="hud-chip" id="money-chip">כסף: <strong>25</strong> · אזור: הבית</div>
          <div class="hud-chip" id="strength-chip">חוזקות מוכנות</div>
        </div>
      </div>
      <div class="prompt-hint" id="hint"></div>
      <div class="pose-bar" id="pose-bar"></div>
      <div class="caption" id="caption"></div>
      <div class="inventory-bar" id="inventory"></div>
      <div class="inspector panel" id="inspector"></div>
      <div class="phone-panel panel" id="phone"></div>
      <div class="hud-bottom-left" id="hud-buttons">
        <button class="mini-btn" data-action="tasks">משימות</button>
        <button class="mini-btn" data-action="phone">טלפון</button>
        <button class="mini-btn" data-action="map">מפה</button>
        <button class="mini-btn" data-action="goals">יעדים</button>
        <button class="mini-btn" data-action="settings">הגדרות</button>
        <button class="mini-btn" data-action="save">שמירה</button>
        <button class="mini-btn" data-action="time">האץ זמן</button>
        <button class="mini-btn" data-action="view">מבט על</button>
      </div>
      <button class="breathe-btn" id="breathe">לעצור לקחת נשימה</button>
      <div class="breathe-overlay" id="breathe-overlay"><div class="breathe-circle"></div><p style="position:absolute;margin-top:200px">נושמים יחד…</p></div>
      <div class="scene-dock" id="scene-dock"></div>
      <div class="overlay hidden" id="overlay"></div>
    `;

    this.hint = this.root.querySelector('#hint')!;
    this.clockEl = this.root.querySelector('#clock-chip')!;
    this.moneyEl = this.root.querySelector('#money-chip')!;
    this.needsEl = this.root.querySelector('#needs-chip')!;
    this.overlay = this.root.querySelector('#overlay')!;
    this.inspector = this.root.querySelector('#inspector')!;
    this.phone = this.root.querySelector('#phone')!;
    this.breatheBtn = this.root.querySelector('#breathe')!;
    this.breatheOverlay = this.root.querySelector('#breathe-overlay')!;
    this.inventoryBar = this.root.querySelector('#inventory')!;
    this.caption = this.root.querySelector('#caption')!;
    this.sceneDock = this.root.querySelector('#scene-dock')!;
    this.poseBar = this.root.querySelector('#pose-bar')!;
    this.rain = this.root.querySelector('#rain')!;
    this.hudButtons = this.root.querySelector('#hud-buttons')!;

    this.breatheBtn.addEventListener('click', () => this.onBreathe?.());
    this.hudButtons.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
      if (btn?.dataset.action) this.onHudAction?.(btn.dataset.action);
    });
  }

  setHudVisible(visible: boolean): void {
    this.root.querySelector('.hud-top')!.classList.toggle('hidden', !visible);
    this.hudButtons.style.display = visible ? 'flex' : 'none';
  }

  updateClock(dayLabel: string, time: string, weather: string, zone: ZoneId, money?: number): void {
    const w = weather === 'rain' ? 'גשום' : weather === 'cloudy' ? 'מעונן' : 'בהיר';
    this.clockEl.textContent = `${dayLabel} · ${time} · ${w}`;
    this.rain.classList.toggle('visible', weather === 'rain');
    this.zoneLabel = ZONE_LABELS[zone];
    if (money !== undefined) this.updateMoney(money);
    else {
      const current = this.moneyEl.querySelector('strong')?.textContent ?? '0';
      this.moneyEl.innerHTML = `כסף: <strong>${current}</strong> · אזור: ${this.zoneLabel}`;
    }
  }

  updateMoney(money: number): void {
    this.moneyEl.innerHTML = `כסף: <strong>${money}</strong> · אזור: ${this.zoneLabel}`;
  }

  updateNeeds(hunger: number, fatigue: number): void {
    const h = this.root.querySelector('#hunger-bar') as HTMLElement;
    const f = this.root.querySelector('#fatigue-bar') as HTMLElement;
    h.style.width = `${hunger}%`;
    f.style.width = `${fatigue}%`;
  }

  updateStrengths(s: StrengthMap): void {
    const chip = this.root.querySelector('#strength-chip')!;
    chip.textContent = `אומץ ${s.courage} · דיבור ${s.speech} · אחריות ${s.responsibility} · איפוק ${s.restraint}`;
  }

  showPoseBar(bed: boolean): void {
    this.poseBar.classList.add('visible');
    this.poseBar.innerHTML = bed
      ? `<button data-pose="up">לקום</button><button data-pose="sleep">לישון עד הבוקר</button>`
      : `<button data-pose="up">לקום</button>`;
    this.poseBar.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', () => {
        const action = (button as HTMLElement).dataset.pose === 'sleep' ? 'sleep' : 'up';
        this.onPoseAction?.(action);
      });
    });
  }

  hidePoseBar(): void {
    this.poseBar.classList.remove('visible');
    this.poseBar.innerHTML = '';
  }

  showHint(text: string | null): void {
    if (!text) {
      this.hint.classList.remove('visible');
      return;
    }
    this.hint.textContent = text;
    this.hint.classList.add('visible');
  }

  showCaption(text: string, ms = 3200): void {
    this.caption.textContent = text;
    this.caption.classList.add('visible');
    window.clearTimeout(this.captionTimer);
    this.captionTimer = window.setTimeout(() => this.caption.classList.remove('visible'), ms);
  }

  showTitle(
    players: PlayerProfile[],
    continues: Array<{ slot: number; exists: boolean; summary?: string }>,
    hasAutosave = false,
  ): void {
    this.setHudVisible(false);
    this.overlay.classList.remove('hidden');
    this.overlay.className = 'overlay title-screen';
    this.overlay.innerHTML = `
      <div class="panel">
        <div class="brand">עולם חי</div>
        <p>סימולציית חיים תלת־ממדית בעברית — שכונה, בית ספר, חברים, בחירות וחוזקות.</p>
        <h2>בחרו דמות</h2>
        <div class="character-grid" id="chars"></div>
        <label style="display:flex;gap:8px;align-items:center;margin-top:14px">
          <input type="checkbox" id="free-play" />
          משחק חופשי — כל המקומות פתוחים, בלי מגבלות כסף, חברות או חנות
        </label>
        <div class="btn-row" style="margin-top:18px">
          <button class="primary" id="start-btn" disabled>התחלת משחק</button>
          <button class="ghost" id="continue-btn" ${hasAutosave ? '' : 'disabled'}>המשך שמירה אוטומטית</button>
        </div>
        <p style="margin-top:12px;font-size:0.9rem">שמירות: ${
          [
            hasAutosave ? 'שמירה אוטומטית' : '',
            ...continues.filter((c) => c.exists).map((c) => `סלוט ${c.slot} (${c.summary})`),
          ]
            .filter(Boolean)
            .join(' · ') || 'אין עדיין'
        }</p>
      </div>
    `;
    const grid = this.overlay.querySelector('#chars')!;
    let selected: string | null = null;
    for (const p of players) {
      const card = document.createElement('button');
      card.className = 'character-card';
      card.innerHTML = `<h3>${p.name}</h3><p>${p.description}</p>`;
      card.addEventListener('click', () => {
        selected = p.id;
        grid.querySelectorAll('.character-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        (this.overlay.querySelector('#start-btn') as HTMLButtonElement).disabled = false;
      });
      grid.appendChild(card);
    }
    this.overlay.querySelector('#start-btn')!.addEventListener('click', () => {
      const freePlay = (this.overlay.querySelector('#free-play') as HTMLInputElement).checked;
      if (selected) this.onCharacterSelect?.(selected, freePlay);
    });
    this.overlay.querySelector('#continue-btn')!.addEventListener('click', () => {
      this.onHudAction?.('continue');
    });
  }

  showSituation(active: ActiveSituation, showBreathe: boolean): void {
    this.overlay.className = 'overlay';
    this.overlay.classList.remove('hidden');
    this.breatheBtn.classList.toggle('visible', showBreathe && active.def.tense && !active.breathed);

    const choices = this.choiceCards(
      active.availableChoices.map((choice) => ({
        id: choice.id,
        label: choice.label,
        shot: recipeForSituation(active.def.id, choice).key,
        mark: choice.requiresBreathe && active.breathed ? ' ★' : '',
      })),
      'data-choice',
    );

    this.overlay.innerHTML = `
      <div class="panel">
        <h2>${active.def.title}</h2>
        <p>${active.description}</p>
        <p class="emotion">${active.emotion}</p>
        ${choices}
        <button class="ghost" id="leave-sit" style="margin-top:12px">לקום ולעזוב</button>
      </div>
    `;
    this.overlay.querySelectorAll('[data-choice]').forEach((btn) => {
      btn.addEventListener('click', () => this.onChoice?.((btn as HTMLElement).dataset.choice!));
    });
    this.overlay.querySelector('#leave-sit')?.addEventListener('click', () => this.onCloseOverlay?.());
  }

  showSceneChoices(active: ActiveSituation, showBreathe: boolean): void {
    this.hideOverlay();
    this.sceneDock.classList.add('visible');
    this.breatheBtn.classList.toggle('visible', showBreathe && active.def.tense && !active.breathed);
    const choices = this.choiceCards(
      active.availableChoices.map((choice) => ({
        id: choice.id,
        label: choice.label,
        shot: recipeForSituation(active.def.id, choice).key,
        mark: choice.requiresBreathe && active.breathed ? ' ★' : '',
      })),
      'data-choice',
    );
    this.sceneDock.innerHTML = `
      <div class="panel">
        <h2>${active.def.title}</h2>
        <p class="emotion">${active.emotion}</p>
        ${choices}
        <button class="ghost" id="leave-sit" style="margin-top:10px">לקום ולעזוב</button>
      </div>
    `;
    this.sceneDock.querySelectorAll('[data-choice]').forEach((btn) => {
      btn.addEventListener('click', () => this.onChoice?.((btn as HTMLElement).dataset.choice!));
    });
    this.sceneDock.querySelector('#leave-sit')?.addEventListener('click', () => this.onCloseOverlay?.());
  }

  hideSceneDock(): void {
    this.sceneDock.classList.remove('visible');
    this.sceneDock.innerHTML = '';
    this.breatheBtn.classList.remove('visible');
  }

  /** Choices that stay at the bottom so the scene behind them remains visible. */
  showBranches(
    title: string,
    note: string,
    choices: Array<{ id: string; label: string; shot?: string }>,
    cancelLabel: string,
  ): void {
    this.hideOverlay();
    this.sceneDock.classList.add('visible');
    const buttons = this.choiceCards(
      choices.map((choice) => ({ id: choice.id, label: choice.label, shot: choice.shot ?? choice.id })),
      'data-branch',
    );
    this.sceneDock.innerHTML = `
      <div class="panel">
        <h2>${title}</h2>
        <p>${note}</p>
        ${buttons}
        <button class="ghost" id="branch-cancel" style="margin-top:10px">${cancelLabel}</button>
      </div>
    `;
    this.sceneDock.querySelectorAll('[data-branch]').forEach((button) => {
      button.addEventListener('click', () => this.onHudAction?.(`branch:${(button as HTMLElement).dataset.branch}`));
    });
    this.sceneDock.querySelector('#branch-cancel')?.addEventListener('click', () => this.onHudAction?.('branch:cancel'));
  }

  playBreatheAnimation(): Promise<void> {
    return new Promise((resolve) => {
      this.breatheOverlay.classList.add('visible');
      window.setTimeout(() => {
        this.breatheOverlay.classList.remove('visible');
        resolve();
      }, 3000);
    });
  }

  showSummary(title: string, body: string, gained: StrengthMap): void {
    this.breatheBtn.classList.remove('visible');
    const gains = Object.entries(gained)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `<div class="strength-item">${STRENGTH_LABELS[k as keyof StrengthMap]}: <span>+${v}</span></div>`)
      .join('');
    this.overlay.classList.remove('hidden');
    this.overlay.innerHTML = `
      <div class="panel">
        <h2>${title}</h2>
        <p>${body}</p>
        <div class="strengths">${gains || '<p>לא נצברו נקודות הפעם — גם זה בסדר.</p>'}</div>
        <div class="btn-row"><button class="primary" id="ok">המשך</button></div>
      </div>
    `;
    this.overlay.querySelector('#ok')!.addEventListener('click', () => {
      this.hideOverlay();
      this.onCloseOverlay?.();
    });
  }

  get overlayOpen(): boolean {
    return !this.overlay.classList.contains('hidden');
  }

  private choiceCards(
    choices: Array<{ id: string; label: string; shot?: string; mark?: string; extraClass?: string }>,
    attr: string,
  ): string {
    return `<div class="choice-cards">${choices
      .map((choice) => {
        const recipe = recipeForChoiceKey(choice.shot ?? choice.id, choice.label);
        const src = previewImage(recipe);
        return `<button class="choice-card ${choice.extraClass ?? ''}" ${attr}="${choice.id}">
          <img src="${src}" alt="" />
          <span>${choice.label}${choice.mark ?? ''}</span>
        </button>`;
      })
      .join('')}</div>`;
  }

  showTasks(
    heading: string,
    tasks: Array<{ kind: string; title: string; note: string | null; current: boolean }>,
    canStop: boolean,
  ): void {
    this.overlay.className = 'overlay';
    this.overlay.innerHTML = `
      <div class="panel task-panel">
        <h2>${heading}</h2>
        <p>בחרו משימה. הדמות תמשיך בה עד שתבחרו משימה אחרת. משחקי הבנייה גדלים כל עוד משחקים.</p>
        <div class="task-grid">
          ${this.choiceCards(
            tasks.map((task) => ({
              id: task.kind,
              label: task.note ? `${task.title} · ${task.note}` : task.title,
              shot: task.kind,
              extraClass: task.current ? 'selected' : '',
            })),
            'data-task',
          )}
        </div>
        <div class="btn-row">
          ${canStop ? '<button class="ghost" id="stop-task">להפסיק וללכת</button>' : ''}
          <button class="primary" id="close-tasks">סגור</button>
        </div>
      </div>
    `;
    this.overlay.querySelectorAll('[data-task]').forEach((button) => {
      button.addEventListener('click', () => {
        const kind = (button as HTMLElement).dataset.task;
        if (kind) this.onHudAction?.(`task:${kind}`);
      });
    });
    this.overlay.querySelector('#stop-task')?.addEventListener('click', () => {
      this.onHudAction?.('task:stop');
    });
    this.overlay.querySelector('#close-tasks')!.addEventListener('click', () => {
      this.hideOverlay();
      this.onUnblock?.();
    });
  }

  hideOverlay(): void {
    this.overlay.classList.add('hidden');
    this.overlay.innerHTML = '';
    this.breatheBtn.classList.remove('visible');
    this.setHudVisible(true);
  }

  showInspector(profile: NpcProfile, trust: number, friendship: number, diary: Array<{ timeLabel: string; text: string }>): void {
    this.inspector.classList.add('visible');
    this.inspector.innerHTML = `
      <h3>${profile.name}</h3>
      <p><strong>${profile.role}</strong></p>
      <p>גר/ה: ${profile.home}</p>
      <p>לומד/עובד: ${profile.workOrSchool}</p>
      <p>תכונות: ${profile.traits.join(', ')}</p>
      <p>אמון: ${trust} · חברות: ${friendship} · מצב רוח: ${profile.mood}</p>
      <h4>מה עבר עליו היום</h4>
      <ul class="diary">${diary.map((d) => `<li><strong>${d.timeLabel}</strong> — ${d.text}</li>`).join('') || '<li>עדיין אין רשומות</li>'}</ul>
      <button class="ghost" id="close-insp">סגור</button>
    `;
    this.inspector.querySelector('#close-insp')!.addEventListener('click', () => this.hideInspector());
  }

  hideInspector(): void {
    this.inspector.classList.remove('visible');
  }

  showPhone(friends: Array<{ id: string; name: string; friendship: number; canInvite: boolean }>, messages: string[]): void {
    this.phone.classList.add('visible');
    this.phone.innerHTML = `
      <h3>טלפון</h3>
      <p>הודעות:</p>
      <ul>${messages.map((m) => `<li>${m}</li>`).join('') || '<li>אין הודעות חדשות</li>'}</ul>
      <h4>חברים</h4>
      <div class="btn-row">
        ${friends
          .map(
            (f) =>
              `<button data-invite="${f.id}" ${f.canInvite ? '' : 'disabled'}>הזמן את ${f.name} הביתה (${f.friendship})</button>
               <button data-out="${f.id}">צא עם ${f.name}</button>`,
          )
          .join('')}
      </div>
      <button class="ghost" id="emotions">מילון רגשות</button>
      <button class="ghost" id="close-phone">סגור</button>
    `;
    this.phone.querySelectorAll('[data-invite]').forEach((b) =>
      b.addEventListener('click', () => this.onPhoneAction?.('invite', (b as HTMLElement).dataset.invite)),
    );
    this.phone.querySelectorAll('[data-out]').forEach((b) =>
      b.addEventListener('click', () => this.onPhoneAction?.('outing', (b as HTMLElement).dataset.out)),
    );
    this.phone.querySelector('#emotions')!.addEventListener('click', () => this.onPhoneAction?.('emotions'));
    this.phone.querySelector('#close-phone')!.addEventListener('click', () => this.phone.classList.remove('visible'));
  }

  showShop(products: ShopProduct[], money: number, strengths: StrengthMap): void {
    this.overlay.classList.remove('hidden');
    this.overlay.innerHTML = `
      <div class="panel">
        <h2>המכולת</h2>
        <p>כסף: <strong>${money}</strong></p>
        <div class="shop-grid">
          ${products
            .map((p) => {
              const sc = Object.entries(p.strengthCost)
                .filter(([, v]) => (v ?? 0) > 0)
                .map(([k, v]) => `${STRENGTH_LABELS[k as keyof StrengthMap]} ${v}`)
                .join(' + ');
              return `<div class="shop-item">
                <div>
                  <strong>${p.name}</strong>
                  <p>${p.description}</p>
                  <p>${p.moneyCost}₪${sc ? ' + ' + sc : ''} · הובלה ${p.deliveryCost}₪ · סיכון שבירה ${Math.round(p.breakRisk * 100)}%</p>
                </div>
                <div class="btn-row">
                  <button data-buy="${p.id}" data-delivery="1">קנה + הובלה</button>
                  <button data-buy="${p.id}" data-delivery="0">קנה + סחיבה</button>
                </div>
              </div>`;
            })
            .join('')}
        </div>
        <button class="ghost" id="close-shop" style="margin-top:12px">סגור</button>
      </div>
    `;
    this.overlay.querySelectorAll('[data-buy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const el = btn as HTMLElement;
        this.onShopBuy?.(el.dataset.buy!, el.dataset.delivery === '1');
      });
    });
    this.overlay.querySelector('#close-shop')!.addEventListener('click', () => {
      this.hideOverlay();
      this.onUnblock?.();
    });
    void strengths;
  }

  showAlbum(entries: AlbumEntry[]): void {
    this.overlay.classList.remove('hidden');
    this.overlay.innerHTML = `
      <div class="panel">
        <h2>אלבום הצלחות</h2>
        <div class="album-grid">
          ${
            entries
              .map(
                (e) =>
                  `<div class="album-card"><div>${e.icon}</div><strong>${e.title}</strong><p>יום ${e.day} · ${e.timeLabel}</p></div>`,
              )
              .join('') || '<p>עדיין אין רגעים — צאו להרפתקאות!</p>'
          }
        </div>
        <button class="primary" id="close-album" style="margin-top:12px">סגור</button>
      </div>
    `;
    this.overlay.querySelector('#close-album')!.addEventListener('click', () => this.hideOverlay());
  }

  showMap(unlocked: ZoneId[], all: ZoneId[]): void {
    this.overlay.classList.remove('hidden');
    this.overlay.innerHTML = `
      <div class="panel">
        <h2>מפת העיר</h2>
        <div class="map-list">
          ${all
            .map((z) => {
              const open = unlocked.includes(z);
              return `<button data-zone="${z}" ${open ? '' : 'disabled'}>
                <span>${ZONE_LABELS[z]}</span><span>${open ? 'פתוח' : 'עדיין לא ביקרתם'}</span>
              </button>`;
            })
            .join('')}
        </div>
        <button class="ghost" id="close-map" style="margin-top:12px">סגור</button>
      </div>
    `;
    this.overlay.querySelectorAll('[data-zone]').forEach((b) =>
      b.addEventListener('click', () => this.onHudAction?.(`goto:${(b as HTMLElement).dataset.zone}`)),
    );
    this.overlay.querySelector('#close-map')!.addEventListener('click', () => this.hideOverlay());
  }

  showGoals(goals: WeeklyGoal[]): void {
    this.overlay.classList.remove('hidden');
    this.overlay.innerHTML = `
      <div class="panel">
        <h2>יעדי השבוע</h2>
        <ul>${goals
          .map((g) => `<li><strong>${g.title}</strong> — ${g.progress}/${g.target} (פרס: ${g.rewardMoney}₪)</li>`)
          .join('')}</ul>
        <button class="primary" id="close-goals">סגור</button>
      </div>
    `;
    this.overlay.querySelector('#close-goals')!.addEventListener('click', () => this.hideOverlay());
  }

  showSettings(settings: GameSettings): void {
    this.overlay.classList.remove('hidden');
    this.overlay.innerHTML = `
      <div class="panel">
        <h2>הגדרות</h2>
        <label>מוזיקה <input type="range" id="music" min="0" max="1" step="0.05" value="${settings.musicVolume}" /></label><br/><br/>
        <label>אפקטים <input type="range" id="sfx" min="0" max="1" step="0.05" value="${settings.sfxVolume}" /></label><br/><br/>
        <label>דיבוב <input type="range" id="vo" min="0" max="1" step="0.05" value="${settings.voVolume}" /></label><br/><br/>
        <label>גודל גופן <input type="range" id="font" min="0.85" max="1.3" step="0.05" value="${settings.fontScale}" /></label><br/><br/>
        <label>רגישות מצלמה <input type="range" id="cam" min="0.5" max="2" step="0.1" value="${settings.cameraSensitivity}" /></label><br/><br/>
        <label>כתוביות <input type="checkbox" id="subs" ${settings.subtitles ? 'checked' : ''} /></label><br/><br/>
        <label>משחק חופשי — הכל פתוח <input type="checkbox" id="free-play" ${settings.freePlay ? 'checked' : ''} /></label><br/><br/>
        <label>קושי רגשי
          <select id="emo">
            <option value="easy" ${settings.emotionalDifficulty === 'easy' ? 'selected' : ''}>קל (יותר זמן לנשום)</option>
            <option value="normal" ${settings.emotionalDifficulty === 'normal' ? 'selected' : ''}>רגיל</option>
            <option value="hard" ${settings.emotionalDifficulty === 'hard' ? 'selected' : ''}>מאתגר</option>
          </select>
        </label>
        <div class="btn-row"><button class="primary" id="save-set">שמור</button></div>
      </div>
    `;
    this.overlay.querySelector('#save-set')!.addEventListener('click', () => {
      this.onSettingsChange?.({
        musicVolume: Number((this.overlay.querySelector('#music') as HTMLInputElement).value),
        sfxVolume: Number((this.overlay.querySelector('#sfx') as HTMLInputElement).value),
        voVolume: Number((this.overlay.querySelector('#vo') as HTMLInputElement).value),
        fontScale: Number((this.overlay.querySelector('#font') as HTMLInputElement).value),
        cameraSensitivity: Number((this.overlay.querySelector('#cam') as HTMLInputElement).value),
        subtitles: (this.overlay.querySelector('#subs') as HTMLInputElement).checked,
        emotionalDifficulty: (this.overlay.querySelector('#emo') as HTMLSelectElement).value as GameSettings['emotionalDifficulty'],
        freePlay: (this.overlay.querySelector('#free-play') as HTMLInputElement).checked,
      });
      this.hideOverlay();
    });
  }

  showEmotionsDict(): void {
    this.overlay.classList.remove('hidden');
    this.overlay.innerHTML = `
      <div class="panel">
        <h2>מילון רגשות</h2>
        <ul>
          <li><strong>תסכול</strong> — כשדברים לא הולכים כמו שרצינו.</li>
          <li><strong>בושה</strong> — כשמרגישים חשופים מול אחרים.</li>
          <li><strong>גאווה</strong> — כשעשינו משהו שחשוב לנו.</li>
          <li><strong>כעס</strong> — אנרגיה חזקה; אפשר לעצור ולנשום לפני בחירה.</li>
        </ul>
        <button class="primary" id="close-emo">סגור</button>
      </div>
    `;
    this.overlay.querySelector('#close-emo')!.addEventListener('click', () => this.hideOverlay());
  }

  updateInventory(items: InventoryItem[]): void {
    if (!items.length) {
      this.inventoryBar.classList.remove('visible');
      return;
    }
    this.inventoryBar.classList.add('visible');
    this.inventoryBar.innerHTML = items.map((i) => `<div class="inv-slot">${i.name}</div>`).join('');
  }

  showSaveSlots(slots: Array<{ slot: number; exists: boolean; summary?: string }>): void {
    this.overlay.classList.remove('hidden');
    this.overlay.innerHTML = `
      <div class="panel">
        <h2>שמירה / טעינה</h2>
        <div class="btn-row">
          ${slots
            .filter((s) => s.slot > 0)
            .map(
              (s) =>
                `<button data-save="${s.slot}">שמור בסלוט ${s.slot}</button>
                 <button data-load="${s.slot}" ${s.exists ? '' : 'disabled'}>טען סלוט ${s.slot}${s.summary ? ' — ' + s.summary : ''}</button>`,
            )
            .join('')}
        </div>
        <button class="ghost" id="close-save">סגור</button>
      </div>
    `;
    this.overlay.querySelectorAll('[data-save]').forEach((b) =>
      b.addEventListener('click', () => this.onHudAction?.(`save:${(b as HTMLElement).dataset.save}`)),
    );
    this.overlay.querySelectorAll('[data-load]').forEach((b) =>
      b.addEventListener('click', () => this.onHudAction?.(`load:${(b as HTMLElement).dataset.load}`)),
    );
    this.overlay.querySelector('#close-save')!.addEventListener('click', () => this.hideOverlay());
  }

  showTravelMenu(onPick: (zone: ZoneId) => void, onCancel: () => void): void {
    this.overlay.classList.remove('hidden');
    this.overlay.innerHTML = `
      <div class="panel">
        <h2>הסעת הורים</h2>
        <p>לאן תרצו שאמא/אבא יסיעו אתכם?</p>
        <div class="btn-row">
          <button data-z="school">לבית הספר</button>
          <button data-z="shop">למכולת</button>
          <button data-z="zoo">לגן החיות</button>
          <button data-z="park">לפארק</button>
        </div>
        <button class="ghost" id="cancel-car">ביטול</button>
      </div>`;
    this.overlay.querySelectorAll('[data-z]').forEach((b) =>
      b.addEventListener('click', () => onPick((b as HTMLElement).dataset.z as ZoneId)),
    );
    this.overlay.querySelector('#cancel-car')!.addEventListener('click', () => onCancel());
  }

  showRecessMenu(): void {
    this.overlay.classList.remove('hidden');
    this.overlay.innerHTML = `
      <div class="panel">
        <h2>משחקי חצר</h2>
        <p>בחרו משחק ותפקיד.</p>
        ${this.choiceCards(
          [
            ['organizer', 'תופסת — מארגן/ת'],
            ['player', 'תופסת — משתתף/ת'],
            ['watcher', 'תופסת — צופה'],
            ['hide', 'מחבואים'],
            ['ball', 'כדור'],
            ['rope', 'חבל'],
            ['king', 'מלך ההר'],
          ].map(([id, label]) => ({ id, label, shot: id })),
          'data-role',
        )}
        <button class="ghost" id="close-recess">ביטול</button>
      </div>
    `;
    this.overlay.querySelectorAll('[data-role]').forEach((b) =>
      b.addEventListener('click', () => this.onHudAction?.(`recess:${(b as HTMLElement).dataset.role}`)),
    );
    this.overlay.querySelector('#close-recess')!.addEventListener('click', () => {
      this.hideOverlay();
      this.onUnblock?.();
    });
  }

  setBreatheVisible(visible: boolean): void {
    this.breatheBtn.classList.toggle('visible', visible);
  }
}
