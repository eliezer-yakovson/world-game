import * as THREE from 'three';
import charactersData from '../../content/characters.json';
import shopData from '../../content/shop.json';
import calendarData from '../../content/calendar.json';
import { bus } from '../core/EventBus';
import { GameClock } from '../core/GameClock';
import { MemoryStore } from '../core/MemoryStore';
import { DEFAULT_SETTINGS, SaveSystem, createEmptySave, unlockZone } from '../core/SaveSystem';
import type {
  AlbumEntry,
  CalendarEvent,
  GameSave,
  GameSettings,
  NpcProfile,
  PlayerProfile,
  ShopProduct,
  StrengthMap,
  ZoneId,
} from '../core/types';
import { PlayerController } from '../characters/PlayerController';
import { NpcManager } from '../characters/NpcManager';
import { ZoneManager } from '../world/ZoneManager';
import type { ZoneBuildResult } from '../world/ZoneBuilder';
import { SituationEngine } from '../situations/SituationEngine';
import { SituationDirector } from '../situations/SituationDirector';
import { NeedsSystem } from '../systems/NeedsSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { StrengthEconomy } from '../systems/StrengthEconomy';
import { FriendshipSystem } from '../systems/FriendshipSystem';
import { TrafficSystem } from '../systems/TrafficSystem';
import { ZooLifeSystem } from '../systems/ZooLifeSystem';
import { HomeLifeSystem } from '../systems/HomeLifeSystem';
import { HomeTaskDirector, PlayerTaskDirector, progressText, taskLine, tasksForPlayer, type TaskChoice } from '../characters/homeTasks';
import { homeVariants, sceneById, yardScene, type SceneScript } from '../scenes/catalog';
import { PerformanceDirector } from '../scenes/PerformanceDirector';
import { AudioDirector } from '../audio/AudioDirector';
import { UIManager } from '../ui/UIManager';
import { setPreviewCharacter } from '../ui/choiceShots';
import { STRENGTH_LABELS } from '../core/types';
import { preloadCharacters } from '../world/AssetLoader';
import { dressZone, preloadProps } from '../world/PropLibrary';
import { CollisionWorld, type CircleObstacle } from '../world/Collision';
import { SchoolDayDirector } from '../characters/schoolDay';

const ALL_ZONES: ZoneId[] = [
  'neighborhood',
  'home',
  'home_blue',
  'home_yellow',
  'school',
  'shop',
  'park',
  'zoo',
];

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private gameClock = new GameClock();
  private memory = new MemoryStore();
  private needs = new NeedsSystem();
  private inventory = new InventorySystem();
  private economy: StrengthEconomy;
  private friendship: FriendshipSystem;
  private situations: SituationEngine;
  private scenes!: SituationDirector;
  private zones = new ZoneManager();
  private npcs = new NpcManager();
  private traffic = new TrafficSystem();
  private zooLife = new ZooLifeSystem();
  private colliders = new CollisionWorld();
  private lastLanes: THREE.Vector3[][] | undefined;
  private lastLights: ZoneBuildResult['trafficLights'];
  private npcLastPos = new Map<string, THREE.Vector3>();
  private zoneReady = false;
  private homeLife = new HomeLifeSystem();
  private homeTasks = new HomeTaskDirector(this.npcs, () => this.homeLife.decreaseMess(1));
  private schoolDay = new SchoolDayDirector(this.npcs, {
    add: (object) => this.zones.group.add(object),
    remove: (object) => this.zones.group.remove(object),
  });
  private playerTasks = new PlayerTaskDirector({
    onSweep: () => this.homeLife.decreaseMess(1),
    onEat: () => this.needs.eat(12),
  });
  private taskMenu = false;
  private performances!: PerformanceDirector;
  private sceneLock = false;
  private homePaused = false;
  private pendingTask: TaskChoice | null = null;
  private audio = new AudioDirector();
  private saves = new SaveSystem();
  private ui: UIManager;
  private player: PlayerController;
  private hemiLight: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private lampMats: THREE.MeshStandardMaterial[] = [];

  private players: PlayerProfile[];
  private npcProfiles: NpcProfile[];
  private products: ShopProduct[];
  private calendar: CalendarEvent[];

  private running = false;
  private blocked = false;
  private poseMode: 'seat' | 'bed' | null = null;
  private interactCooldown = 0;
  private album: AlbumEntry[] = [];
  private unlockedZones: ZoneId[] = ['neighborhood', 'home'];
  private hasUpgradedBag = false;
  private weeklyGoals = createEmptySave('tmp').weeklyGoals;
  private settings: GameSettings;
  private phoneMessages: string[] = ['אמא: אל תשכח/י מעיל אם ירד גשם.', 'נועם: נשחק בהפסקה?'];
  private timeAccel = 1;
  private selectedPlayerId = 'yael';
  private sunTarget = new THREE.Object3D();
  private pendingGuestId: string | null = null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private readonly titleCam = new THREE.Vector3(8, 12, 18);
  private readonly skyColor = new THREE.Color();
  private readonly circlePool: CircleObstacle[] = [];
  private readonly playerCircles: CircleObstacle[] = [];
  private readonly npcCircles: CircleObstacle[] = [];
  private hudStamp = '';
  private skyHex = -1;
  private lampsOn: boolean | null = null;
  private homeLayout: Array<{ id: string; x: number; z: number }> = [];
  private canReturnBroken = false;
  private bikeLocked = true;

  constructor(private container: HTMLElement) {
    this.settings = this.saves.loadSettings();
    this.economy = new StrengthEconomy(this.memory);
    this.friendship = new FriendshipSystem(this.memory);
    this.situations = new SituationEngine(this.memory, this.needs, this.gameClock);

    this.players = charactersData.players as PlayerProfile[];
    this.npcProfiles = (charactersData.npcs as NpcProfile[]).map((n) => ({ ...n, diary: [] }));
    this.products = shopData.products as ShopProduct[];
    this.calendar = calendarData.events as CalendarEvent[];

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.renderer.domElement.id = 'game-canvas';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 8, 12);

    this.scene.background = new THREE.Color(0x87b7e0);
    this.scene.fog = new THREE.Fog(0x87b7e0, 40, 110);

    this.hemiLight = new THREE.HemisphereLight(0xbcd6ff, 0x4a5a3a, 0.85);
    this.scene.add(this.hemiLight);
    this.sun = new THREE.DirectionalLight(0xfff2d6, 1.1);
    this.sun.position.set(20, 30, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 80;
    this.sun.shadow.camera.left = -40;
    this.sun.shadow.camera.right = 40;
    this.sun.shadow.camera.top = 40;
    this.sun.shadow.camera.bottom = -40;
    this.scene.add(this.sun);
    this.scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;

    this.player = new PlayerController();
    this.scene.add(this.player.mesh);

    this.ui = new UIManager(container);
    this.scenes = new SituationDirector(this.scene, this.camera, this.player, this.npcs, this.ui);
    this.performances = new PerformanceDirector({
      caption: (text, ms) => this.ui.showCaption(text, ms),
      choices: (title, note, options, cancel) => this.ui.showBranches(title, note, options, cancel),
      clearChoices: () => this.ui.hideSceneDock(),
      playerAt: () => ({ x: this.player.position.x, z: this.player.position.z, yaw: this.player.cameraYaw }),
      placePlayer: (x, z) => {
        this.player.position.set(x, 0, z);
        this.player.mesh.rotation.y = this.player.cameraYaw;
      },
      emote: (kind) => {
        if (this.playerTasks.active) return;
        this.player.playEmote(kind, true);
      },
      hold: (id, x, z, yaw, clip) => {
        this.npcs.holdAt(id, x, z, yaw);
        this.npcs.playClip(id, clip, true);
      },
      release: (ids) => {
        for (const id of ids) this.npcs.releaseActor(id);
      },
      add: (object) => this.zones.group.add(object),
      remove: (object) => this.zones.group.remove(object),
    });
    this.performances.onFinished = (awards, title) => this.finishPerformance(awards, title);
    this.bindUI();
    this.npcs.setProfiles(this.npcProfiles);

    window.addEventListener('resize', this.onResize);
    document.documentElement.style.setProperty('--font-size', `${16 * this.settings.fontScale}px`);
  }

  start(): void {
    void Promise.all([
      preloadCharacters([
        'yael',
        'ori',
        'tala',
        'roni',
        'mom',
        'dad',
        'brother',
        'sister',
        'teacher',
        'shopkeeper',
        'noam',
        'maya',
        'dani',
        'neighbor',
        'zookeeper',
      ]),
      preloadProps(),
    ]).then(() => {
      this.player.setCharacterModel(this.selectedPlayerId);
      if (!this.zoneReady) return;
      dressZone(this.zones.group);
      this.traffic.setup(this.lastLanes ?? this.zones.carLanes, this.lastLights ?? this.zones.trafficLights, this.zones.group);
      this.colliders.rebuild(this.zones.group);
    });
    this.ui.showTitle(this.players, this.saves.listSlots(), Boolean(this.saves.loadAutosave()));
    this.loop();
  }

  private bindUI(): void {
    this.ui.onCharacterSelect = (id, freePlay) => this.beginNewGame(id, Boolean(freePlay));
    this.ui.onChoice = (id) => this.resolveChoice(id);
    this.ui.onBreathe = () => void this.handleBreathe();
    this.ui.onUnblock = () => {
      this.blocked = false;
      this.taskMenu = false;
    };
    this.ui.onCloseOverlay = () => {
      this.scenes.clear();
      this.npcs.setHeld(false);
      this.ui.hideSceneDock();
      this.blocked = false;
      this.situations.cancel();
    };
    this.ui.onShopBuy = (productId, delivery) => this.handlePurchase(productId, delivery);
    this.ui.onPhoneAction = (action, payload) => this.handlePhone(action, payload);
    this.ui.onSettingsChange = (partial) => {
      this.settings = { ...this.settings, ...partial };
      this.economy.freePlay = this.settings.freePlay;
      this.saves.saveSettings(this.settings);
      this.audio.applySettings(this.settings);
      this.player.applySettings(this.settings);
      document.documentElement.style.setProperty('--font-size', `${16 * this.settings.fontScale}px`);
      if (this.settings.freePlay) this.applyFreePlay();
      this.refreshHud();
      this.ui.showCaption(this.settings.freePlay ? 'משחק חופשי: הכל פתוח' : 'ההגדרות נשמרו');
    };
    this.ui.onHudAction = (action) => this.handleHud(action);
    this.ui.onPoseAction = (action) => this.endSeat(action === 'sleep');

    bus.on('subtitle', ({ text }: { text: string }) => {
      if (this.settings.subtitles) this.ui.showCaption(text, 2800);
    });
    bus.on('money-changed', (m: number) => this.ui.updateMoney(m));
    bus.on('strengths-changed', () => this.ui.updateStrengths(this.memory.strengths));
    bus.on('needs-changed', () => this.ui.updateNeeds(this.needs.hunger, this.needs.fatigue));
    bus.on('inventory-changed', () => this.ui.updateInventory(this.inventory.items));
    bus.on('weather-changed', () => this.refreshHud());
    bus.on('friend-invited', ({ npcId }: { npcId: string }) => {
      this.pendingGuestId = npcId;
      this.ui.showCaption(`${this.npcName(npcId)} בדרך אליכם הביתה!`);
      this.addAlbum('הזמנתי חבר הביתה', '🏠');
      this.progressGoal('friend', 1);
      this.goToZone('home');
    });

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private beginNewGame(playerId: string, freePlay = false): void {
    const profile = this.players.find((p) => p.id === playerId);
    if (!profile) return;
    this.selectedPlayerId = playerId;
    setPreviewCharacter(playerId);
    this.settings = { ...this.settings, freePlay };
    const save = createEmptySave(playerId);
    save.strengths = { ...profile.strengths };
    save.settings = { ...this.settings };
    if (freePlay) {
      save.money = 500;
      save.hasBike = true;
      save.hasScooter = true;
      save.hasUpgradedBag = true;
      save.unlockedZones = [...ALL_ZONES];
    }
    this.applySave(save);
    this.applyFreePlay();
    this.player.setColor(profile.color);
    this.player.setCharacterModel(playerId);
    this.ui.hideOverlay();
    this.ui.setHudVisible(true);
    this.running = true;
    this.audio.applySettings(this.settings);
    this.audio.startMusic();
    this.goToZone('home');
    this.ui.showCaption(
      freePlay
        ? `שלום ${profile.name}! משחק חופשי: הכל פתוח. WASD לנוע, C למבט מלמעלה, E לאינטראקציה.`
        : `שלום ${profile.name}! WASD לנוע, C למבט מלמעלה, E לאינטראקציה, לחצו על אנשים לכרטיסייה.`,
    );
    this.audio.playSfx('success');
  }

  private applySave(save: GameSave): void {
    this.gameClock.setTime(save.day, save.minutes);
    this.gameClock.weather = save.weather;
    this.memory.strengths = { ...save.strengths };
    this.memory.trust = { ...save.trust };
    this.memory.friendship = { ...save.friendship };
    this.memory.diaries = { ...save.diary };
    this.needs.set(save.needs);
    this.economy.money = save.money;
    this.inventory.set(save.inventory);
    this.album = [...save.album];
    this.unlockedZones = [...save.unlockedZones];
    this.player.hasBike = save.hasBike;
    this.player.hasScooter = save.hasScooter;
    this.hasUpgradedBag = save.hasUpgradedBag;
    this.homeLayout = [...(save.homeLayout ?? [])];
    this.homeLife.messLevel = save.messLevel;
    this.weeklyGoals = save.weeklyGoals;
    this.settings = { ...DEFAULT_SETTINGS, ...save.settings };
    this.economy.freePlay = this.settings.freePlay;
    this.selectedPlayerId = save.playerId;
    setPreviewCharacter(save.playerId);
    const profile = this.players.find((p) => p.id === save.playerId);
    if (profile) {
      this.player.setColor(profile.color);
      this.player.setCharacterModel(save.playerId);
    }
    this.ui.updateStrengths(this.memory.strengths);
    this.ui.updateMoney(this.economy.money);
    this.ui.updateNeeds(this.needs.hunger, this.needs.fatigue);
    this.ui.updateInventory(this.inventory.items);
    this.running = true;
    this.ui.hideOverlay();
    this.ui.setHudVisible(true);
    this.goToZone(save.zone);
    this.applyFreePlay();
  }

  private applyFreePlay(): void {
    this.economy.freePlay = this.settings.freePlay;
    if (!this.settings.freePlay) return;
    this.unlockedZones = [...ALL_ZONES];
    if (this.economy.money < 500) this.economy.money = 500;
    const keys = ['speech', 'courage', 'flexibility', 'responsibility', 'restraint', 'friendship', 'creativity'] as const;
    for (const key of keys) {
      if (this.memory.strengths[key] < 8) this.memory.strengths[key] = 8;
    }
    for (const npc of this.npcProfiles) {
      this.memory.ensureNpc(npc.id, {
        trust: npc.trustTowardPlayer,
        friendship: npc.friendship ?? 20,
        mood: npc.mood,
      });
      if ((this.memory.friendship[npc.id] ?? 0) < 80) this.memory.friendship[npc.id] = 80;
    }
    this.player.hasBike = true;
    this.player.hasScooter = true;
    this.hasUpgradedBag = true;
    this.ui.updateMoney(this.economy.money);
    this.ui.updateStrengths(this.memory.strengths);
  }

  private fillCircles(target: CircleObstacle[], exceptNpcId?: string): CircleObstacle[] {
    let n = 0;
    const take = (x: number, z: number, radius: number) => {
      let circle = this.circlePool[n];
      if (!circle) {
        circle = { x, z, radius };
        this.circlePool[n] = circle;
      } else {
        circle.x = x;
        circle.z = z;
        circle.radius = radius;
      }
      target[n] = circle;
      n++;
    };
    this.traffic.forEachObstacle(take);
    if (exceptNpcId !== 'player') take(this.player.position.x, this.player.position.z, 0.46);
    for (const actor of this.npcs.actors) {
      if (actor.id === exceptNpcId) continue;
      take(actor.mesh.position.x, actor.mesh.position.z, 0.5);
    }
    target.length = n;
    return target;
  }

  private keepApart(): void {
    const seen = new Set<string>();
    for (const actor of this.npcs.actors) {
      seen.add(actor.id);
      const desired = actor.mesh.position;
      let stored = this.npcLastPos.get(actor.id);
      if (actor.anchored) {
        if (!stored) {
          stored = desired.clone();
          this.npcLastPos.set(actor.id, stored);
        } else stored.copy(desired);
        continue;
      }
      if (stored && Math.abs(stored.x - desired.x) < 0.001 && Math.abs(stored.z - desired.z) < 0.001) continue;
      const resolved = this.colliders.slide(stored ?? desired, desired, 0.5, this.fillCircles(this.npcCircles, actor.id));
      actor.mesh.position.x = resolved.x;
      actor.mesh.position.z = resolved.z;
      actor.vehicle.position.x = resolved.x;
      actor.vehicle.position.z = resolved.z;
      if (!stored) this.npcLastPos.set(actor.id, resolved.clone());
      else stored.copy(resolved);
    }
    for (const id of this.npcLastPos.keys()) {
      if (!seen.has(id)) this.npcLastPos.delete(id);
    }
  }

  private snapshot(): GameSave {
    return {
      version: 1,
      slot: 1,
      day: this.gameClock.day,
      minutes: Math.floor(this.gameClock.minutes),
      zone: this.zones.current,
      playerId: this.selectedPlayerId,
      money: this.economy.money,
      strengths: { ...this.memory.strengths },
      needs: this.needs.state,
      inventory: [...this.inventory.items],
      trust: { ...this.memory.trust },
      friendship: { ...this.memory.friendship },
      diary: { ...this.memory.diaries },
      album: [...this.album],
      unlockedZones: [...this.unlockedZones],
      hasBike: this.player.hasBike,
      hasScooter: this.player.hasScooter,
      hasUpgradedBag: this.hasUpgradedBag,
      homeLayout: this.captureHomeLayout(),
      messLevel: this.homeLife.messLevel,
      weather: this.gameClock.weather,
      weeklyGoals: this.weeklyGoals,
      settings: this.settings,
    };
  }

  private goToZone(zone: ZoneId): void {
    this.schoolDay.stop();
    this.endPerformance(false);
    if (this.player.posing) this.endSeat(false);
    const pausedTask = this.playerTasks.yield(this.player);
    this.homeTasks.end();
    this.unlockedZones = unlockZone(this.unlockedZones, zone);
    const built = this.zones.load(zone, this.scene);
    this.player.position.copy(built.spawn);
    const spawns = [...built.npcSpawns];
    if (zone === 'home' && this.pendingGuestId) {
      spawns.push({ id: this.pendingGuestId, position: new THREE.Vector3(1, 0, 2) });
      this.memory.addDiary(this.pendingGuestId, this.gameClock.timeLabel, 'הגיע לבקר בבית השחקן');
    }
    this.npcs.spawn(this.zones.group, spawns, this.memory);
    this.lastLanes = built.carLanes;
    this.lastLights = built.trafficLights;
    this.zoneReady = true;
    dressZone(this.zones.group);
    this.traffic.setup(built.carLanes, built.trafficLights, this.zones.group);
    if (zone === 'zoo') this.zooLife.bind(this.zones.group);
    else this.zooLife.clear();
    if (zone === 'home') {
      this.homeLife.bindToys(this.zones.group);
      this.applyHomeLayout();
    }
    if (zone === 'home' || zone === 'home_blue' || zone === 'home_yellow') this.homeTasks.begin();
    const homeZone = zone === 'home' || zone === 'home_blue' || zone === 'home_yellow';
    const indoor = homeZone || zone === 'shop';
    this.player.cameraDistance = homeZone ? 7 : indoor ? 6.2 : zone === 'school' ? 8 : 9;
    this.player.cameraHeight = homeZone ? 4.3 : indoor ? 3.6 : zone === 'school' ? 4.6 : 5.5;
    this.colliders.rebuild(this.zones.group);
    this.audio.setZone(zone);
    this.collectLamps();
    this.refreshHud();
    this.audio.playSfx('door');
    if (pausedTask) this.ui.showCaption('המשימה נעצרה. מה שכבר נבנה נשמר, ואפשר לבחור אותה שוב.');
  }

  private openInspectorFor(npcId: string): void {
    const actor = this.npcs.actors.find((a) => a.id === npcId);
    const profile = actor?.profile ?? this.npcProfiles.find((n) => n.id === npcId);
    if (!profile) return;
    this.ui.showInspector(
      {
        ...profile,
        mood: this.memory.moods[npcId] ?? profile.mood,
      },
      this.memory.trust[npcId] ?? 50,
      this.memory.friendship[npcId] ?? 0,
      this.memory.diaries[npcId] ?? [],
    );
  }

  private orbiting = false;
  private orbitMoved = false;
  private orbitTravel = 0;
  private orbitX = 0;
  private orbitY = 0;
  private orbitPointer = -1;

  private onPointerDown = (ev: PointerEvent): void => {
    if (!this.running || ev.button !== 0) return;
    if ((ev.target as HTMLElement)?.closest?.('#ui-root .panel, #ui-root button, #overlay')) return;
    this.orbiting = true;
    this.orbitMoved = false;
    this.orbitTravel = 0;
    this.orbitX = ev.clientX;
    this.orbitY = ev.clientY;
    this.orbitPointer = ev.pointerId;
    try {
      this.renderer.domElement.setPointerCapture(ev.pointerId);
    } catch {
      // The pointer may already have been released. Move and up still orbit.
    }
    this.renderer.domElement.classList.add('dragging');
  };

  private onPointerMove = (ev: PointerEvent): void => {
    if (!this.orbiting || ev.pointerId !== this.orbitPointer) return;
    const dx = ev.clientX - this.orbitX;
    const dy = ev.clientY - this.orbitY;
    this.orbitX = ev.clientX;
    this.orbitY = ev.clientY;
    this.orbitTravel += Math.hypot(dx, dy);
    if (this.orbitTravel > 5) this.orbitMoved = true;
    this.player.orbit(dx, dy);
  };

  private onPointerUp = (ev: PointerEvent): void => {
    if (!this.orbiting || ev.pointerId !== this.orbitPointer) return;
    this.orbiting = false;
    this.renderer.domElement.classList.remove('dragging');
    try {
      if (this.renderer.domElement.hasPointerCapture(ev.pointerId)) {
        this.renderer.domElement.releasePointerCapture(ev.pointerId);
      }
    } catch {
      // Already released.
    }
    if (this.orbitMoved || this.blocked) return;
    this.pickNpc(ev);
  };

  private onWheel = (ev: WheelEvent): void => {
    if (!this.running) return;
    if ((ev.target as HTMLElement)?.closest?.('#ui-root .panel, #overlay')) return;
    ev.preventDefault();
    let delta = ev.deltaY;
    if (ev.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
    else if (ev.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= 400;
    this.player.zoomBy(delta);
  };

  private pickNpc(ev: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const meshes = this.npcs.actors.map((a) => a.mesh);
    const hits = this.raycaster.intersectObjects(meshes, true);
    if (!hits.length) return;

    let obj: THREE.Object3D | null = hits[0].object;
    while (obj && !obj.userData.npcId) obj = obj.parent;
    const npcId = obj?.userData.npcId as string | undefined;
    if (!npcId) return;
    this.openInspectorFor(npcId);
    this.audio.playSfx('click');
  };

  private collectLamps(): void {
    this.lampMats = [];
    this.lampsOn = null;
    this.zones.group.traverse((obj) => {
      if (obj.name === 'streetlamp' && (obj as THREE.Mesh).material) {
        this.lampMats.push((obj as THREE.Mesh).material as THREE.MeshStandardMaterial);
      }
    });
  }

  private refreshHud(): void {
    const stamp = `${this.gameClock.day}|${this.gameClock.hour}|${this.gameClock.minuteOfHour}|${this.gameClock.weather}|${this.zones.current}`;
    const same = stamp === this.hudStamp;
    this.hudStamp = stamp;
    if (!same) this.ui.updateClock(this.gameClock.dayLabel, this.gameClock.timeLabel, this.gameClock.weather, this.zones.current);
    if (!same || this.lampsOn === null) this.updateDayNight();
  }

  private updateDayNight(): void {
    const h = this.gameClock.hour + this.gameClock.minuteOfHour / 60;
    const night = h < 6 || h >= 20;
    const t = night ? 0.25 : h < 8 || h > 18 ? 0.55 : 1;
    const season = this.gameClock.day % 4;
    this.sun.intensity = 0.35 + t * 0.9;
    this.hemiLight.intensity = 0.4 + t * 0.5;
    let sky = night ? 0x0f1a2e : h > 17 ? 0xe0a070 : 0x87b7e0;
    if (!night && season === 2) sky = 0xc9865a;
    if (!night && season === 3) sky = 0xb7c6d6;
    if (!night && season === 1) sky = 0x7ec8e8;
    if (sky !== this.skyHex) {
      this.skyHex = sky;
      this.skyColor.setHex(sky);
      this.scene.background = this.skyColor;
      (this.scene.fog as THREE.Fog).color.copy(this.skyColor);
    }
    if (night !== this.lampsOn) {
      this.lampsOn = night;
      const hex = night ? 0xffcc66 : 0x000000;
      const intensity = night ? 1.2 : 0;
      for (const mat of this.lampMats) {
        mat.emissive.setHex(hex);
        mat.emissiveIntensity = intensity;
      }
    }
  }

  private captureHomeLayout(): Array<{ id: string; x: number; z: number }> {
    if (this.zones.current !== 'home') return this.homeLayout;
    const layout = this.zones.interactables
      .filter((i) => i.type === 'furniture' && i.mesh)
      .map((i) => ({ id: i.id, x: i.mesh!.position.x, z: i.mesh!.position.z }));
    this.homeLayout = layout;
    return layout;
  }

  private applyHomeLayout(): void {
    for (const item of this.homeLayout) {
      const it = this.zones.interactables.find((i) => i.id === item.id);
      if (!it?.mesh) continue;
      it.mesh.position.x = item.x;
      it.mesh.position.z = item.z;
      it.position.set(item.x, 0, item.z);
    }
  }

  private keysStep(): { x: number; z: number } {
    return { x: Math.random() > 0.5 ? 0.8 : -0.8, z: Math.random() > 0.5 ? 0.8 : -0.8 };
  }

  private loop = (): void => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.running) {
      this.gameClock.setSpeed(this.timeAccel);
      this.gameClock.update(dt);
      const gameMinutesDelta = dt * (this.gameClock.speed / 60);
      this.needs.update(gameMinutesDelta);
      const circles = this.fillCircles(this.playerCircles, 'player');
      this.player.update(dt, this.camera, this.blocked, (next, radius) => this.colliders.resolve(next, radius, circles));
      const grew = this.playerTasks.update(dt, this.player);
      if (grew && !this.taskMenu && !this.sceneLock) this.ui.showCaption(grew, 1800);
      this.npcs.update(dt, this.gameClock, this.memory);
      this.homeTasks.update(dt);
      this.performances.update(dt);
      if (!this.npcs.isHeld) this.keepApart();
      if (this.zones.current === 'school') {
        this.schoolDay.setPaused(this.performances.active || this.sceneLock);
        const bell = this.schoolDay.update(dt, this.gameClock);
        if (bell && !this.sceneLock) this.ui.showCaption(bell, 2600);
      } else {
        this.schoolDay.stop();
      }
      this.traffic.update(dt);
      if (this.zones.current === 'zoo') this.zooLife.update(dt);
      if (this.zones.current === 'home') this.homeLife.maybePlayMess(0.0008 * this.timeAccel);

      this.interactCooldown = Math.max(0, this.interactCooldown - dt);
      if (this.poseMode && !this.player.posing) {
        this.poseMode = null;
        this.ui.hidePoseBar();
      }
      if (this.sceneLock) {
        this.ui.showHint(this.performances.active ? 'הסצנה על המסך. כשהיא נעצרת, הבחירה למטה ממשיכה אותה.' : 'בחרו למטה איך הסצנה תיראה');
        this.player.consumeInteract();
      } else if (this.player.posing) {
        this.ui.showHint('[E] לקום');
        if (this.interactCooldown <= 0 && this.player.consumeInteract()) {
          this.endSeat(false);
          this.interactCooldown = 0.45;
        }
      } else if (this.player.taskHold) {
        this.ui.showHint('[T] משימות — להחליף או להפסיק');
        this.player.consumeInteract();
      } else {
        this.handleProximity();
        if (!this.blocked && this.interactCooldown <= 0 && this.player.consumeInteract()) {
          this.tryInteract();
          this.interactCooldown = 0.35;
        }
      }

      this.refreshHud();
      this.checkCalendarBeats();
      this.checkScriptedMoments();

      if (this.gameClock.minuteOfHour === 0 && this.oncePer(`auto-${this.gameClock.day}-${this.gameClock.hour}`)) {
        this.saves.autosave(this.snapshot());
      }
    } else {
      this.camera.position.lerp(this.titleCam, 0.02);
      this.camera.lookAt(0, 0, 0);
    }

    this.sunTarget.position.copy(this.player.position);
    this.renderer.render(this.scene, this.camera);
  };

  private handleProximity(): void {
    if (this.blocked) {
      this.ui.showHint(null);
      return;
    }
    const item = this.zones.nearestInteractable(this.player.position);
    const npc = this.npcs.getNearest(this.player.position);
    if (item) {
      this.ui.showHint(`[E] ${item.label}`);
    } else if (npc) {
      this.ui.showHint(`[E] לדבר עם ${npc.profile.name} · לחצו עליו / F לכרטיסייה`);
    } else {
      this.ui.showHint(null);
    }
  }

  private tryInteract(): void {
    const npc = this.npcs.getNearest(this.player.position);
    const item = this.zones.nearestInteractable(this.player.position);

    if (item) {
      this.activateInteractable(item.id);
      return;
    }
    if (npc) {
      const line = this.npcs.talkTo(npc, this.memory, this.gameClock);
      const mood = this.memory.moods[npc.id] ?? 'neutral';
      const clip =
        mood === 'happy' || mood === 'angry' || mood === 'sad' ? `talk-${npc.id}-${mood}` : `talk-${npc.id}`;
      this.audio.playVo(clip, line);
      this.ui.showCaption(line);
    }
  }

  private activateInteractable(id: string): void {
    const it = this.zones.interactables.find((i) => i.id === id);
    if (!it) return;
    this.audio.playSfx('click');

    if (it.type === 'door' && it.data?.target) {
      this.goToZone(it.data.target as ZoneId);
      return;
    }
    if (it.type === 'shop') {
      const list = it.data?.zooOnly
        ? this.products.filter((p) => p.id === 'zoo_plush' || p.kind === 'gift')
        : this.products;
      this.blocked = true;
      this.ui.showShop(list, this.economy.money, this.memory.strengths);
      return;
    }
    if (it.type === 'album') {
      this.ui.showAlbum(this.album);
      return;
    }
    if (it.type === 'bus') {
      this.ui.showCaption('האוטובוס מגיע... לאן לנסוע?');
      this.ui.showMap(this.unlockedZones, ALL_ZONES);
      return;
    }
    if (it.type === 'parent_car') {
      this.blocked = true;
      this.ui.showTravelMenu(
        (zone) => {
          this.ui.hideOverlay();
          this.blocked = false;
          this.goToZone(zone);
          this.ui.showCaption('הגעתם עם ההסעה');
        },
        () => {
          this.ui.hideOverlay();
          this.blocked = false;
        },
      );
      return;
    }
    if (it.type === 'furniture' && it.mesh) {
      const step = this.keysStep();
      it.mesh.position.x += step.x;
      it.mesh.position.z += step.z;
      it.position.copy(it.mesh.position);
      this.homeLayout = this.captureHomeLayout();
      this.ui.showCaption('הזזתם את החפץ. המיקום נשמר.');
      return;
    }
    if (it.data?.situation) {
      this.startSituation(String(it.data.situation));
      return;
    }
    if (it.data?.action) {
      this.runAction(String(it.data.action), it.data);
    }
  }

  private beginSeat(options: {
    x: number;
    y?: number;
    z: number;
    yaw: number;
    pitch?: number;
    bob?: number;
    bobSpeed?: number;
    standX?: number;
    standZ?: number;
    caption: string;
    bed?: boolean;
  }): void {
    if (this.player.posing) this.endSeat(false);
    this.playerTasks.yield(this.player);
    this.player.startPose({
      x: options.x,
      y: options.y,
      z: options.z,
      yaw: options.yaw,
      pitch: options.pitch,
      bob: options.bob,
      bobSpeed: options.bobSpeed,
      standX: options.standX,
      standZ: options.standZ,
      emote: 'sit',
    });
    this.poseMode = options.bed ? 'bed' : 'seat';
    this.ui.showPoseBar(Boolean(options.bed));
    this.ui.showCaption(options.caption);
  }

  private endSeat(sleep: boolean): void {
    const bed = this.poseMode === 'bed';
    this.player.endPose();
    this.poseMode = null;
    this.ui.hidePoseBar();
    if (sleep && bed) {
      this.needs.sleep(70);
      this.gameClock.minutes = 7 * 60;
      this.gameClock.day += 1;
      this.ui.showCaption('לילה טוב... בוקר חדש!');
      this.audio.playSfx('success');
    }
  }

  private runAction(action: string, data: Record<string, unknown> = {}): void {
    switch (action) {
      case 'toggleMusic':
        this.ui.showCaption(this.audio.toggleMusic() ? 'המוזיקה פועלת' : 'המוזיקה כבויה');
        break;
      case 'sitSofa':
        this.beginSeat({
          x: -2.2,
          z: 5.3,
          yaw: Math.PI,
          standX: -2.2,
          standZ: 4.4,
          caption: 'ישבתם על הספה. אפשר לקום עם E או עם מקשי התנועה.',
        });
        this.needs.sleep(8);
        break;
      case 'lieBed':
        this.beginSeat({
          x: -10,
          y: 0.55,
          z: -8.2,
          yaw: 0,
          pitch: Math.PI / 2,
          standX: -10,
          standZ: -6.4,
          caption: 'נשכבתם על המיטה.',
          bed: true,
        });
        this.needs.sleep(18);
        break;
      case 'sitDesk':
        this.beginSeat({
          x: Number(data.x),
          z: Number(data.z),
          yaw: Number(data.yaw),
          standX: Number(data.x),
          standZ: Number(data.standZ),
          caption: 'ישבתם ליד השולחן.',
        });
        break;
      case 'swing':
        this.beginSeat({
          x: 10.5,
          y: 0.2,
          z: -1,
          yaw: 0,
          bob: 0.32,
          caption: 'נדנדה. E או תנועה כדי לרדת.',
        });
        this.memory.addStrengths({ friendship: 1, flexibility: 1 });
        break;
      case 'slide':
        this.playerTasks.yield(this.player);
        this.player.startPose({
          x: 13.3,
          y: 1.05,
          z: -1.45,
          yaw: 0,
          emote: 'jump',
          slideTo: new THREE.Vector3(13.3, 0.05, 0.55),
          duration: 1.15,
          lock: true,
        });
        this.poseMode = 'seat';
        this.ui.hidePoseBar();
        this.ui.showCaption('ירידה במגלשה!');
        this.memory.addStrengths({ courage: 1 });
        break;
      case 'seesaw':
        this.beginSeat({
          x: 15.7,
          y: 0.15,
          z: -2.05,
          yaw: Math.PI / 2,
          bob: 0.28,
          bobSpeed: 2.1,
          caption: 'נדנדת איזון. E או תנועה כדי לרדת.',
        });
        this.memory.addStrengths({ flexibility: 1 });
        break;
      case 'climb':
        this.playerTasks.yield(this.player);
        this.player.startPose({
          x: 9.9,
          z: -3.8,
          yaw: Math.PI,
          emote: 'jump',
          climb: true,
          duration: 1.45,
          lock: true,
        });
        this.poseMode = 'seat';
        this.ui.hidePoseBar();
        this.ui.showCaption('טיפוס על המתקן!');
        this.memory.addStrengths({ courage: 1 });
        break;
      case 'sandbox':
        this.beginSeat({
          x: 13.2,
          z: -4.1,
          yaw: 0.4,
          caption: 'משחק בארגז החול.',
        });
        this.memory.addStrengths({ creativity: 1 });
        break;
      case 'sleep':
        this.needs.sleep(70);
        this.gameClock.minutes = 7 * 60;
        this.gameClock.day += 1;
        this.ui.showCaption('לילה טוב... בוקר חדש!');
        this.audio.playSfx('success');
        break;
      case 'eat':
        this.needs.eat(40);
        this.ui.showCaption('אכלתם משהו מהמקרר. הרעב ירד.');
        break;
      case 'stockJob':
        this.economy.addMoney(5);
        this.memory.addStrengths({ responsibility: 1 });
        this.ui.showCaption('סידרתם מדפים וקיבלתם 5₪');
        this.audio.playSfx('buy');
        break;
      case 'recessTag':
        this.blocked = true;
        this.ui.showRecessMenu();
        break;
      case 'playScene': {
        const script = sceneById(String(data.scene ?? ''));
        const task = tasksForPlayer().find((item) => item.kind === data.task);
        if (this.player.posing) this.endSeat(false);
        if (task) this.playerTasks.start(task, this.player);
        if (script) this.beginPerformance(script, false, true);
        break;
      }
      case 'petDog':
        this.memory.addStrengths({ friendship: 1, restraint: 1 });
        this.ui.showCaption('הכלב כשכש בזנב. הרגשתם רגועים יותר.');
        break;
      case 'watchAnimal':
        this.ui.showCaption(`אתם מסתכלים על ${data.animal}. ${data.doing ?? 'מרשים!'}`);
        this.audio.playSfx('success');
        break;
      case 'zooShow':
        if (this.gameClock.hour >= 11 && this.gameClock.hour <= 15) {
          this.memory.addStrengths({ friendship: 2, creativity: 1 });
          this.addAlbum('צפיתי במופע בגן החיות', '🦭');
          this.ui.showCaption('מופע מדהים! הידכם מחאות כפיים.');
        } else {
          this.ui.showCaption('המופע מתקיים בין 11:00 ל־15:00');
        }
        break;
      case 'takePhoto':
        this.addAlbum('תמונה מגן החיות', '📷');
        this.ui.showCaption('התמונה נשמרה באלבום ההצלחות');
        break;
      case 'visitNoamRoom':
        this.memory.adjustFriendship('noam', 2);
        this.ui.showCaption('החדר של נועם מלא בכדורים ובפוסטרים. הוא גאה להראות לכם.');
        break;
      case 'visitMayaWindow':
        this.memory.adjustFriendship('maya', 2);
        this.ui.showCaption('מהחלון רואים את הגינה של דודה רחל. מאיה מחייכת.');
        break;
      case 'guestSnack':
        this.needs.eat(15);
        this.memory.addStrengths({ friendship: 1 });
        this.ui.showCaption('קיבלתם חטיף קטן. נעים להתארח!');
        break;
      case 'class':
        if (this.settings.freePlay || (this.gameClock.isSchoolTime && !this.gameClock.isRecess)) {
          this.startSituation('class_question');
          this.progressGoal('school', 1);
        } else if (this.gameClock.isRecess) {
          this.ui.showCaption('עכשיו הפסקה — צאו לחצר!');
        } else {
          this.ui.showCaption('אין שיעור עכשיו. בית הספר פעיל בבוקר.');
        }
        break;
      case 'library':
        this.memory.addStrengths({ responsibility: 1, creativity: 1 });
        this.needs.fatigue = Math.max(0, this.needs.fatigue - 8);
        this.ui.showCaption('שקט בספרייה. קראתם קצת ונרגעתם.');
        this.addAlbum('ישבתי בספרייה', '📚');
        break;
      case 'bikeRack':
        if (!this.player.hasBike && !this.player.hasScooter) {
          this.ui.showCaption('אין לכם אופניים או קורקינט עדיין. אפשר לחסוך בחנות.');
          break;
        }
        if (this.bikeLocked) {
          this.bikeLocked = false;
          this.ui.showCaption('השארתם את האופניים לא נעולות...');
          if (Math.random() < 0.55) this.startSituation('bike_theft');
        } else {
          this.bikeLocked = true;
          this.memory.addStrengths({ responsibility: 2 });
          this.ui.showCaption('נעלתם את האופניים. אחראי.');
        }
        break;
      case 'taxi':
        if (!this.settings.freePlay && this.economy.money < 4) {
          this.ui.showCaption('למונית צריך 4₪');
          break;
        }
        if (!this.settings.freePlay) this.economy.addMoney(-4);
        this.blocked = true;
        this.ui.showTravelMenu(
          (zone) => {
            this.ui.hideOverlay();
            this.blocked = false;
            this.goToZone(zone);
            this.ui.showCaption('המונית הורידה אתכם');
          },
          () => {
            if (!this.settings.freePlay) this.economy.addMoney(4);
            this.ui.hideOverlay();
            this.blocked = false;
          },
        );
        break;
      case 'lostCat':
        this.startSituation('lost_cat');
        break;
      case 'streetFair': {
        const bonus = this.calendar.some((e) => e.id === 'street_fair' && e.day === this.gameClock.day);
        this.memory.addStrengths({ friendship: bonus ? 2 : 1, creativity: 1 });
        if (bonus) this.economy.addMoney(3);
        this.ui.showCaption(bonus ? 'יום היריד! קיבלתם מדבקה ו־3₪' : 'דוכן קטן בפארק. שוחחתם עם אנשים.');
        this.addAlbum('ביקרתי ביריד', '🎪');
        break;
      }
      case 'returnBroken':
        if (!this.canReturnBroken) {
          this.ui.showCaption('אין מוצר שבור להחזרה כרגע.');
          break;
        }
        this.canReturnBroken = false;
        this.economy.addMoney(4);
        this.memory.addStrengths({ speech: 2, responsibility: 1 });
        this.memory.adjustTrust('shopkeeper', 6);
        this.ui.showCaption('מוטי החליף חלק מהנזק והחזיר 4₪.');
        break;
      default:
        break;
    }
  }

  private async startSituation(id: string): Promise<void> {
    const diff = this.settings.freePlay ? 'easy' : this.settings.emotionalDifficulty;
    const ok = this.situations.start(id, diff);
    if (!ok || !this.situations.active) return;
    this.taskMenu = false;
    if (this.player.posing) this.endSeat(false);
    this.playerTasks.yield(this.player);
    this.blocked = true;
    this.npcs.setHeld(true);
    this.ui.hideOverlay();
    const active = this.situations.active;
    this.audio.playVo(`sit-${id}`, active.description);
    await this.scenes.playOpening(active.def);
    if (!this.situations.active) return;
    const tense = !!active.def.tense && diff !== 'easy';
    this.ui.showSceneChoices(this.situations.active, diff === 'hard' ? false : tense);
    if (diff === 'hard' && this.situations.active.def.tense) {
      window.setTimeout(() => {
        if (this.situations.active && !this.situations.active.breathed) {
          this.ui.setBreatheVisible(true);
          this.ui.showCaption('עכשיו אפשר לעצור ולנשום');
        }
      }, 2500);
    }
  }

  private async handleBreathe(): Promise<void> {
    await this.ui.playBreatheAnimation();
    this.situations.breathe();
    if (this.situations.active) {
      this.ui.showSceneChoices(this.situations.active, false);
      this.ui.showCaption('אחרי הנשימה נפתחו אפשרויות בוגרות יותר');
    }
  }

  private choiceBusy = false;

  private async resolveChoice(choiceId: string): Promise<void> {
    if (this.choiceBusy || !this.situations.active) return;
    const active = this.situations.active;
    const choice = active.availableChoices.find((item) => item.id === choiceId);
    if (!choice) return;
    this.choiceBusy = true;
    this.ui.hideSceneDock();
    await this.scenes.playChoice(active.def, choice);
    this.choiceBusy = false;
    if (!this.situations.active) return;
    this.situations.choose(choiceId);
  }

  // Listen to situation completion via bus in constructor... add here
  private setupSituationCompletion(): void {
    bus.on(
      'situation-completed',
      (payload: {
        choice: { label: string; followUpText: string; animation?: string };
        gained: import('../core/types').StrengthMap;
        summary: string;
        situationId: string;
      }) => {
        this.ui.showSummary('סיכום הסיטואציה', payload.summary, payload.gained);
        this.addAlbum(payload.choice.label, '⭐');
        if (payload.situationId === 'tidy_request') {
          this.homeLife.tidy();
          this.progressGoal('tidy', 1);
        }
        if (payload.situationId === 'broken_item') this.canReturnBroken = true;
        if (payload.situationId === 'lost_cat') this.addAlbum('עזרתי למצוא חתול', '🐱');
        this.audio.playSfx('success');
      },
    );
  }

  private handlePurchase(productId: string, delivery: boolean): void {
    const product = this.products.find((p) => p.id === productId);
    if (!product) return;
    if (!this.economy.canBuy(product)) {
      this.ui.showCaption('אין מספיק כסף או נקודות חוזקה');
      this.audio.playSfx('fail');
      return;
    }
    this.economy.buy(product);

    if (product.id === 'bike') {
      this.player.hasBike = true;
      this.ui.showCaption('קיבלתם אופניים! התנועה מהירה יותר.');
      this.addAlbum('רכשתי אופניים', '🚲');
      this.ui.hideOverlay();
      this.blocked = false;
      return;
    }
    if (product.id === 'scooter') {
      this.player.hasScooter = true;
      this.ui.showCaption('קיבלתם קורקינט!');
      this.addAlbum('רכשתי קורקינט', '🛴');
      this.ui.hideOverlay();
      this.blocked = false;
      return;
    }
    if (product.id === 'backpack') {
      this.hasUpgradedBag = true;
      this.ui.showCaption('תיק משודרג — סיכון שבירה ירד מאוד');
      this.addAlbum('שדרגתי תיק גב', '🎒');
      this.ui.hideOverlay();
      this.blocked = false;
      return;
    }

    if (delivery) {
      if (!this.economy.payDelivery(product.deliveryCost)) {
        this.economy.addMoney(product.moneyCost);
        this.ui.showCaption('אין מספיק להובלה');
        return;
      }
      this.inventory.add({ id: product.id, name: product.name, kind: product.kind });
      this.ui.showCaption(`${product.name} בדרך הביתה בבטחה`);
      this.audio.playSfx('buy');
    } else {
      const risk = this.economy.breakRisk(product, this.hasUpgradedBag);
      if (Math.random() < risk) {
        this.ui.hideOverlay();
        this.ui.showCaption('אוי לא... המוצר נשבר בדרך!');
        this.startSituation('broken_item');
        return;
      }
      this.inventory.add({ id: product.id, name: product.name, kind: product.kind });
      this.ui.showCaption(`סחבתם את ${product.name} בשלום`);
      this.audio.playSfx('buy');
    }

    if (product.kind === 'food') {
      /* can eat later from inventory — instant snack for foods */
    }
    this.ui.hideOverlay();
    this.blocked = false;
  }

  private handlePhone(action: string, payload?: string): void {
    if (action === 'emotions') {
      this.ui.showEmotionsDict();
      return;
    }
    if (!payload) return;
    if (action === 'invite') {
      if (this.settings.freePlay) {
        this.memory.ensureNpc(payload);
        this.memory.friendship[payload] = Math.max(this.memory.friendship[payload] ?? 0, 80);
      }
      if (this.friendship.inviteHome(payload)) {
        /* event handled */
      } else {
        this.ui.showCaption('עדיין לא מספיק חברות להזמנה הביתה');
      }
    }
    if (action === 'outing') {
      this.friendship.goOutTogether(payload, 'הפארק');
      this.goToZone('park');
      this.ui.showCaption(`יצאתם עם ${this.npcName(payload)} לפארק`);
    }
  }

  private openTaskMenu(): void {
    if (!this.running) return;
    const id = this.selectedPlayerId;
    const name = this.players.find((player) => player.id === id)?.name ?? 'הדמות';
    const female = id === 'yael' || id === 'tala';
    this.taskMenu = true;
    this.blocked = true;
    this.ui.showTasks(
      female ? `מה ${name} תעשה?` : `מה ${name} יעשה?`,
      tasksForPlayer().map((task) => ({
        kind: task.kind,
        title: task.title,
        note: progressText(task.kind, this.playerTasks.seconds(task.kind)),
        current: this.playerTasks.kind === task.kind,
      })),
      this.playerTasks.active,
    );
  }

  private handleHud(action: string): void {
    if (action === 'continue') {
      const auto = this.saves.loadAutosave();
      if (auto) {
        this.applySave(auto);
        this.audio.startMusic();
        this.ui.showCaption('המשכתם מהשמירה האוטומטית');
      } else {
        this.ui.showCaption('אין שמירה אוטומטית עדיין');
      }
      return;
    }
    if (action === 'tasks') {
      this.openTaskMenu();
      return;
    }
    if (action === 'task:stop') {
      this.taskMenu = false;
      this.pendingTask = null;
      this.ui.hideOverlay();
      this.endPerformance(false);
      this.blocked = false;
      this.playerTasks.yield(this.player);
      this.ui.showCaption('הדמות חזרה ללכת');
      return;
    }
    if (action.startsWith('branch:')) {
      const id = action.slice(7);
      if (this.pendingTask) {
        const choice = this.pendingTask;
        this.pendingTask = null;
        this.ui.hideSceneDock();
        this.sceneLock = false;
        if (this.player.posing) this.endSeat(false);
        if (id === 'cancel') {
          this.blocked = false;
          this.playerTasks.start(choice, this.player);
          return;
        }
        const script = sceneById(id);
        this.playerTasks.start(choice, this.player);
        if (script) this.beginPerformance(script, false, false);
        else this.blocked = false;
        return;
      }
      this.performances.choose(id);
      return;
    }
    if (action.startsWith('task:')) {
      const kind = action.slice(5);
      const choice = tasksForPlayer().find((task) => task.kind === kind);
      this.taskMenu = false;
      this.ui.hideOverlay();
      if (!choice) {
        this.blocked = false;
        return;
      }
      const variants = homeVariants(choice.kind);
      if (!variants.length) {
        this.blocked = false;
        if (this.player.posing) this.endSeat(false);
        this.playerTasks.start(choice, this.player);
        const name = this.players.find((player) => player.id === this.selectedPlayerId)?.name ?? 'הדמות';
        this.ui.showCaption(taskLine(this.selectedPlayerId, name, choice.kind));
        return;
      }
      this.pendingTask = choice;
      this.sceneLock = true;
      this.blocked = false;
      this.ui.showBranches(
        choice.title,
        'בחרו מה בדיוק קורה. זה נשאר על המסך, עם חפצים, ולא נגמר במשפט אחד.',
        variants.map((variant) => ({ id: variant.id, label: variant.title, shot: variant.id })),
        'רק להתחיל, בלי סיפור',
      );
      return;
    }
    if (action === 'phone') {
      const friends = this.npcProfiles
        .filter((n) => n.role.includes('חבר'))
        .map((n) => ({
          id: n.id,
          name: n.name,
          friendship: this.memory.friendship[n.id] ?? n.friendship ?? 0,
          canInvite: this.settings.freePlay || this.friendship.canInviteHome(n.id),
        }));
      this.ui.showPhone(friends, this.phoneMessages);
      return;
    }
    if (action === 'map') {
      this.ui.showMap(this.unlockedZones, ALL_ZONES);
      return;
    }
    if (action === 'goals') {
      this.ui.showGoals(this.weeklyGoals);
      return;
    }
    if (action === 'settings') {
      this.ui.showSettings(this.settings);
      return;
    }
    if (action === 'save') {
      this.ui.showSaveSlots(this.saves.listSlots());
      return;
    }
    if (action === 'time') {
      this.timeAccel = this.timeAccel >= 8 ? 1 : this.timeAccel * 2;
      this.ui.showCaption(`מהירות זמן ×${this.timeAccel}`);
      return;
    }
    if (action === 'view') {
      const top = this.player.toggleTopDown();
      this.ui.showCaption(top ? 'מבט מלמעלה. Q ו־R מסובבים את המבט.' : 'מבט רגיל מאחורי הדמות.');
      return;
    }
    if (action.startsWith('goto:')) {
      const zone = action.slice(5) as ZoneId;
      this.ui.hideOverlay();
      this.blocked = false;
      this.goToZone(zone);
      return;
    }
    if (action.startsWith('save:')) {
      const slot = Number(action.slice(5));
      this.saves.save(slot, this.snapshot());
      this.ui.showCaption(`נשמר בסלוט ${slot}`);
      this.ui.hideOverlay();
      return;
    }
    if (action.startsWith('load:')) {
      const slot = Number(action.slice(5));
      const data = this.saves.load(slot);
      if (data) {
        this.applySave(data);
        this.ui.showCaption(`נטען סלוט ${slot}`);
      }
      return;
    }
    if (action.startsWith('recess:')) {
      const role = action.slice(7);
      this.ui.hideOverlay();
      const script = yardScene(role);
      if (script) {
        this.playerTasks.yield(this.player);
        if (this.player.posing) this.endSeat(false);
        this.beginPerformance(script, true, true);
        return;
      }
      this.blocked = false;
      const games: Record<string, { text: string; speech?: number; courage?: number; friendship?: number; flexibility?: number; restraint?: number; creativity?: number }> = {
        organizer: { text: 'ארגנתם תופסת בחצר.', speech: 2, courage: 1, friendship: 1 },
        player: { text: 'רצתם בתופסת.', friendship: 2, flexibility: 1 },
        watcher: { text: 'צפיתם מהצד.', restraint: 2 },
        hide: { text: 'שיחקתם מחבואים.', flexibility: 2, restraint: 1 },
        ball: { text: 'שיחקתם כדור.', friendship: 2, courage: 1 },
        rope: { text: 'קפצתם בחבל.', creativity: 1, flexibility: 2 },
        king: { text: 'שיחקתם מלך ההר.', courage: 2, restraint: 1 },
      };
      const g = games[role] ?? games.player;
      this.memory.addStrengths({
        speech: g.speech ?? 0,
        courage: g.courage ?? 0,
        friendship: g.friendship ?? 0,
        flexibility: g.flexibility ?? 0,
        restraint: g.restraint ?? 0,
        creativity: g.creativity ?? 0,
      });
      this.ui.showCaption(g.text);
      this.audio.playSfx('bell');
      this.memory.adjustFriendship('noam', 2);
      this.memory.adjustFriendship('dani', 2);
      if (Math.random() < 0.28) this.startSituation('park_argument');
      return;
    }
  }

  private checkCalendarBeats(): void {
    const ev = this.calendar.find((e) => e.day === this.gameClock.day);
    if (ev && this.gameClock.hour === 8 && this.gameClock.minuteOfHour < 2 && this.oncePer(`cal-${this.gameClock.day}`)) {
      this.phoneMessages.unshift(`תזכורת: ${ev.title} — ${ev.description}`);
      this.ui.showCaption(`היום בלוח השנה: ${ev.title}`);
    }
    if (
      ev?.id === 'mom_birthday' &&
      this.gameClock.hour === 18 &&
      this.inventory.has('mom_gift') &&
      this.oncePer(`gift-${this.gameClock.day}`)
    ) {
      this.inventory.remove('mom_gift');
      this.memory.adjustTrust('mom', 15);
      this.memory.addStrengths({ friendship: 2, responsibility: 2 });
      this.addAlbum('נתתי מתנה לאמא', '🎁');
      this.ui.showCaption('אמא התרגשה מהמתנה!');
    }
    if (ev?.id === 'zoo_trip' && this.zones.current === 'school' && this.gameClock.isSchoolTime && this.oncePer(`zoo-go-${this.gameClock.day}`) && !this.blocked) {
      this.ui.showCaption('הכיתה יוצאת לטיול בגן החיות');
      this.goToZone('zoo');
      this.addAlbum('טיול כיתתי לגן החיות', '🦁');
    }
    if (
      this.gameClock.weather === 'rain' &&
      this.zones.current === 'park' &&
      this.oncePer(`rain-${this.gameClock.day}`)
    ) {
      this.goToZone('home');
      this.startSituation('rainy_day');
    }
  }

  private firedBeats = new Set<string>();

  private oncePer(key: string): boolean {
    if (this.firedBeats.has(key)) return false;
    this.firedBeats.add(key);
    return true;
  }

  private lastMessPromptDay = -1;
  private checkScriptedMoments(): void {
    if (this.zones.current === 'home' && this.homeLife.messLevel >= 3 && this.gameClock.isBedtime) {
      if (this.lastMessPromptDay !== this.gameClock.day && !this.blocked) {
        this.lastMessPromptDay = this.gameClock.day;
        this.startSituation('tidy_request');
      }
    }
    if (
      this.zones.current === 'home' &&
      this.homeLife.messLevel >= 2 &&
      this.gameClock.hour === 16 &&
      this.gameClock.minuteOfHour < 2 &&
      !this.blocked &&
      this.oncePer(`mess16-${this.gameClock.day}`)
    ) {
      this.homeLife.increaseMess(1);
      this.ui.showCaption('האח הקטן הוציא צעצועים... הבלגן גדל');
    }
    if (
      this.zones.current === 'home' &&
      this.gameClock.hour === 17 &&
      this.gameClock.minuteOfHour < 2 &&
      (this.memory.friendship['noam'] ?? 0) > 40 &&
      !this.blocked &&
      this.oncePer(`guest-${this.gameClock.day}`)
    ) {
      this.startSituation('guest_mess');
    }
  }

  private addAlbum(title: string, icon: string): void {
    this.album.unshift({
      id: `a-${Date.now()}`,
      title,
      icon,
      day: this.gameClock.day,
      timeLabel: this.gameClock.timeLabel,
    });
  }

  private progressGoal(id: string, amount: number): void {
    const g = this.weeklyGoals.find((x) => x.id === id);
    if (!g || g.progress >= g.target) return;
    g.progress = Math.min(g.target, g.progress + amount);
    if (g.progress >= g.target) {
      this.economy.addMoney(g.rewardMoney);
      if (g.rewardStrength) this.memory.addStrengths(g.rewardStrength);
      this.ui.showCaption(`יעד הושלם: ${g.title}!`);
      this.addAlbum(g.title, '🏆');
    }
  }

  private atHome(): boolean {
    return this.zones.current === 'home' || this.zones.current === 'home_blue' || this.zones.current === 'home_yellow';
  }

  private beginPerformance(script: SceneScript, movePlayer: boolean, gather: boolean): void {
    if (this.atHome() && gather) {
      this.homeTasks.end();
      this.homePaused = true;
    }
    this.sceneLock = true;
    this.blocked = false;
    this.player.taskHold = true;
    this.performances.start(script, movePlayer, gather);
  }

  private finishPerformance(awards: Partial<StrengthMap> | undefined, title: string): void {
    this.sceneLock = false;
    this.blocked = false;
    if (!this.playerTasks.active) this.player.releaseHold();
    if (this.homePaused) {
      this.homePaused = false;
      if (this.atHome()) this.homeTasks.begin();
    }
    if (!title && !awards) return;
    if (awards) {
      const gained = this.memory.addStrengths(awards);
      const bits = (Object.entries(gained) as Array<[keyof StrengthMap, number]>)
        .filter(([, value]) => value > 0)
        .map(([key, value]) => `${STRENGTH_LABELS[key]} +${value}`);
      this.ui.showCaption(bits.length ? `${title}. ${bits.join(' · ')}` : `${title} נגמרה.`);
      this.audio.playSfx('success');
      return;
    }
    this.ui.showCaption(`${title} נגמרה.`);
  }

  /** Leaves a scene without the closing caption. Used when the zone changes. */
  private endPerformance(resumeHome: boolean): void {
    this.performances.stop(false);
    this.sceneLock = false;
    this.pendingTask = null;
    this.ui.hideSceneDock();
    if (!this.playerTasks.active) this.player.releaseHold();
    if (this.homePaused) {
      this.homePaused = false;
      if (resumeHome && this.atHome()) this.homeTasks.begin();
    }
  }

  private npcName(id: string): string {
    return this.npcProfiles.find((n) => n.id === id)?.name ?? id;
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  init(): void {
    this.setupSituationCompletion();
    // F key for inspector (also: click on a person)
    window.addEventListener('keydown', (e) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      if (e.code === 'KeyT' && this.running && !typing) {
        if (this.sceneLock) {
          if (this.pendingTask) {
            this.pendingTask = null;
            this.sceneLock = false;
            this.ui.hideSceneDock();
          }
          return;
        }
        if (this.taskMenu) {
          this.taskMenu = false;
          this.ui.hideOverlay();
          this.blocked = false;
        } else if (!this.blocked && !this.ui.overlayOpen) {
          this.openTaskMenu();
        }
      }
      if (e.code === 'KeyC' && this.running && !this.blocked && !typing) {
        const top = this.player.toggleTopDown();
        this.ui.showCaption(top ? 'מבט מלמעלה. Q ו־R מסובבים את המבט.' : 'מבט רגיל מאחורי הדמות.');
      }
      if (e.code === 'KeyF' && this.running && !this.blocked && !typing) {
        const npc = this.npcs.getNearest(this.player.position, 3);
        if (npc) this.openInspectorFor(npc.id);
      }
      // Eat food from inventory with G
      if (e.code === 'KeyG' && this.running && !typing) {
        const food = this.inventory.items.find((i) => i.kind === 'food');
        if (food) {
          this.inventory.remove(food.id);
          this.needs.eat(45);
          this.ui.showCaption(`אכלתם ${food.name}`);
        }
      }
    });

    // Load a lightweight neighborhood preview behind title
    this.zones.load('neighborhood', this.scene);
    this.traffic.setup(this.zones.carLanes, this.zones.trafficLights, this.zones.group);
  }
}

// silence unused import warning helper
void STRENGTH_LABELS;
