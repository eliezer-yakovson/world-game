import * as THREE from 'three';
import type { SituationChoice } from '../core/types';
import { pickClip } from '../characters/emotes';
import { encounterShot } from '../scenes/encounters';
import { takeCharacterModel } from '../world/AssetLoader';

export type ShotMood =
  | 'shout'
  | 'whisper'
  | 'cry'
  | 'hide'
  | 'clean'
  | 'run'
  | 'wait'
  | 'freeze'
  | 'cook'
  | 'play'
  | 'talk'
  | 'phone'
  | 'leave'
  | 'read'
  | 'eat'
  | 'draw'
  | 'water'
  | 'rest'
  | 'jump';

type Ground = 'home' | 'grass' | 'street' | 'class';

export interface ShotRecipe {
  key: string;
  mood: ShotMood;
  prop?: string;
  ground: Ground;
  friend?: string;
}

const CLIP_FOR: Record<ShotMood, string> = {
  shout: 'stomp',
  whisper: 'talk',
  cry: 'sad',
  hide: 'hide',
  clean: 'clean',
  run: 'run',
  wait: 'idle',
  freeze: 'idle',
  cook: 'cook',
  play: 'play',
  talk: 'talk',
  phone: 'phone',
  leave: 'walk',
  read: 'sit',
  eat: 'idle',
  draw: 'idle',
  water: 'clean',
  rest: 'sit',
  jump: 'jump',
};

const GROUND_COLOR: Record<Ground, number> = {
  home: 0xe7d7b8,
  grass: 0x3c8f45,
  street: 0x9aa3ab,
  class: 0xd9d3c6,
};

const WALL_COLOR: Record<Ground, number> = {
  home: 0xf3efe6,
  grass: 0x8ec8ef,
  street: 0xb7c3ce,
  class: 0xf7f4ef,
};

const SITUATION_SHOTS: Record<string, Omit<ShotRecipe, 'key'>> = {
  'spilled_drink/yell': { mood: 'shout', prop: 'puddle', ground: 'home', friend: 'mom' },
  'spilled_drink/freeze': { mood: 'freeze', prop: 'puddle', ground: 'home' },
  'spilled_drink/clean': { mood: 'clean', prop: 'cloth', ground: 'home', friend: 'mom' },
  'spilled_drink/ask_help': { mood: 'whisper', prop: 'puddle', ground: 'home', friend: 'mom' },
  'class_question/hide': { mood: 'hide', prop: 'book', ground: 'class' },
  'class_question/guess_loud': { mood: 'shout', prop: 'book', ground: 'class', friend: 'teacher' },
  'class_question/answer': { mood: 'talk', prop: 'book', ground: 'class', friend: 'teacher' },
  'class_question/ask_friend': { mood: 'whisper', prop: 'book', ground: 'class', friend: 'noam' },
  'park_argument/take_side': { mood: 'shout', prop: 'ball', ground: 'grass', friend: 'dani' },
  'park_argument/walk_away': { mood: 'leave', prop: 'ball', ground: 'grass' },
  'park_argument/mediate': { mood: 'talk', prop: 'cones', ground: 'grass', friend: 'noam' },
  'park_argument/share': { mood: 'talk', prop: 'ball', ground: 'grass', friend: 'dani' },
  'broken_item/kick': { mood: 'shout', prop: 'bag', ground: 'street' },
  'broken_item/cry': { mood: 'cry', prop: 'bag', ground: 'street' },
  'broken_item/breathe_return': { mood: 'talk', prop: 'bag', ground: 'street', friend: 'shopkeeper' },
  'broken_item/call_parent': { mood: 'phone', prop: 'handset', ground: 'street' },
  'tidy_request/refuse': { mood: 'leave', prop: 'blocks', ground: 'home' },
  'tidy_request/argue': { mood: 'shout', prop: 'blocks', ground: 'home', friend: 'dad' },
  'tidy_request/tidy': { mood: 'clean', prop: 'blocks', ground: 'home', friend: 'dad' },
  'tidy_request/game_tidy': { mood: 'play', prop: 'blocks', ground: 'home', friend: 'brother' },
  'rainy_day/sulk': { mood: 'cry', prop: 'pillow', ground: 'home' },
  'rainy_day/force_out': { mood: 'leave', prop: 'rain', ground: 'street' },
  'rainy_day/alt_plan': { mood: 'play', prop: 'fort', ground: 'home', friend: 'brother' },
  'rainy_day/bake': { mood: 'cook', prop: 'cake', ground: 'home', friend: 'mom' },
  'guest_mess/ignore': { mood: 'play', prop: 'blocks', ground: 'home', friend: 'noam' },
  'guest_mess/scold': { mood: 'shout', prop: 'blocks', ground: 'home', friend: 'noam' },
  'guest_mess/invite_tidy': { mood: 'clean', prop: 'blocks', ground: 'home', friend: 'noam' },
  'guest_mess/zones': { mood: 'talk', prop: 'cones', ground: 'home', friend: 'noam' },
  'crosswalk/run': { mood: 'run', prop: 'red', ground: 'street' },
  'crosswalk/wait': { mood: 'wait', prop: 'green', ground: 'street' },
  'crosswalk/call_back': { mood: 'shout', prop: 'green', ground: 'street', friend: 'noam' },
  'lost_cat/grab': { mood: 'run', prop: 'cat', ground: 'grass' },
  'lost_cat/calm': { mood: 'wait', prop: 'cat', ground: 'grass' },
  'bike_theft/shout': { mood: 'shout', prop: 'bike', ground: 'street', friend: 'dani' },
  'bike_theft/ask': { mood: 'whisper', prop: 'bike', ground: 'street', friend: 'dani' },
};

const TASK_SHOTS: Record<string, Omit<ShotRecipe, 'key'>> = {
  sweep: { mood: 'clean', prop: 'broom', ground: 'home' },
  wipe: { mood: 'clean', prop: 'cloth', ground: 'home' },
  eat: { mood: 'eat', prop: 'plate', ground: 'home' },
  cook: { mood: 'cook', prop: 'pot', ground: 'home' },
  draw: { mood: 'draw', prop: 'page-house', ground: 'home' },
  playBlocks: { mood: 'play', prop: 'blocks', ground: 'home' },
  playBall: { mood: 'play', prop: 'ball', ground: 'home' },
  playCastle: { mood: 'play', prop: 'fort', ground: 'home' },
  playRoad: { mood: 'play', prop: 'car', ground: 'home' },
  read: { mood: 'read', prop: 'book', ground: 'home' },
  water: { mood: 'water', prop: 'plant', ground: 'home' },
  laundry: { mood: 'clean', prop: 'shirt', ground: 'home' },
  music: { mood: 'play', prop: 'notes', ground: 'home' },
  phone: { mood: 'phone', prop: 'handset', ground: 'home' },
  rest: { mood: 'rest', prop: 'pillow', ground: 'home' },
};

const RECESS_SHOTS: Record<string, Omit<ShotRecipe, 'key'>> = {
  organizer: { mood: 'talk', prop: 'cones', ground: 'grass' },
  player: { mood: 'run', prop: 'cones', ground: 'grass' },
  watcher: { mood: 'rest', prop: 'cones', ground: 'grass' },
  hide: { mood: 'hide', prop: 'bush', ground: 'grass' },
  ball: { mood: 'play', prop: 'ball', ground: 'grass' },
  rope: { mood: 'jump', prop: 'rope', ground: 'grass' },
  king: { mood: 'play', prop: 'crown', ground: 'grass' },
};

const SCENE_RULES: Array<[RegExp, Omit<ShotRecipe, 'key'>]> = [
  [/^sweep-rug/, { mood: 'clean', prop: 'rug', ground: 'home' }],
  [/^sweep-sofa/, { mood: 'clean', prop: 'sofa', ground: 'home' }],
  [/^sweep/, { mood: 'clean', prop: 'broom', ground: 'home' }],
  [/^wipe-window/, { mood: 'clean', prop: 'window', ground: 'home' }],
  [/^wipe-shelf/, { mood: 'read', prop: 'book', ground: 'home' }],
  [/^wipe/, { mood: 'clean', prop: 'cloth', ground: 'home' }],
  [/^eat-soup/, { mood: 'eat', prop: 'steam', ground: 'home' }],
  [/^eat-fruit/, { mood: 'eat', prop: 'apple', ground: 'home' }],
  [/^eat/, { mood: 'eat', prop: 'plate', ground: 'home' }],
  [/^cook-cake/, { mood: 'cook', prop: 'cake', ground: 'home' }],
  [/^cook-soup/, { mood: 'cook', prop: 'steam', ground: 'home' }],
  [/^cook/, { mood: 'cook', prop: 'pot', ground: 'home' }],
  [/^draw-sun/, { mood: 'draw', prop: 'page-sun', ground: 'home' }],
  [/^draw-animal/, { mood: 'draw', prop: 'page-cat', ground: 'home' }],
  [/^draw/, { mood: 'draw', prop: 'page-house', ground: 'home' }],
  [/^blocks-bridge/, { mood: 'play', prop: 'bridge', ground: 'home' }],
  [/^blocks-castle/, { mood: 'play', prop: 'castle', ground: 'home' }],
  [/^blocks/, { mood: 'play', prop: 'blocks', ground: 'home' }],
  [/^ball-basket/, { mood: 'play', prop: 'basket', ground: 'home' }],
  [/^ball-feet/, { mood: 'run', prop: 'ball', ground: 'home' }],
  [/^ball/, { mood: 'play', prop: 'ball', ground: 'home' }],
  [/^fort-palace/, { mood: 'play', prop: 'crown', ground: 'home' }],
  [/^fort/, { mood: 'play', prop: 'fort', ground: 'home' }],
  [/^road-park/, { mood: 'play', prop: 'car', ground: 'street' }],
  [/^road/, { mood: 'play', prop: 'car', ground: 'home' }],
  [/^read-comic/, { mood: 'read', prop: 'page-sun', ground: 'home' }],
  [/^read/, { mood: 'read', prop: 'book', ground: 'home' }],
  [/^water-flower/, { mood: 'water', prop: 'flower', ground: 'home' }],
  [/^water/, { mood: 'water', prop: 'plant', ground: 'home' }],
  [/^laundry/, { mood: 'clean', prop: 'shirt', ground: 'home' }],
  [/^music-drum/, { mood: 'play', prop: 'notes', ground: 'home' }],
  [/^music/, { mood: 'play', prop: 'notes', ground: 'home' }],
  [/^phone/, { mood: 'phone', prop: 'handset', ground: 'home' }],
  [/^rest/, { mood: 'rest', prop: 'pillow', ground: 'home' }],
  [/^family-meal/, { mood: 'eat', prop: 'plate', ground: 'home', friend: 'mom' }],
  [/^bedtime/, { mood: 'read', prop: 'book', ground: 'home', friend: 'mom' }],
  [/^game-night/, { mood: 'play', prop: 'ball', ground: 'home', friend: 'dad' }],
  [/^build-together/, { mood: 'play', prop: 'blocks', ground: 'home', friend: 'brother' }],
  [/^yard-organizer/, { mood: 'talk', prop: 'cones', ground: 'grass' }],
  [/^yard-player/, { mood: 'run', prop: 'cones', ground: 'grass' }],
  [/^yard-watcher/, { mood: 'rest', prop: 'cones', ground: 'grass' }],
  [/^yard-hide/, { mood: 'hide', prop: 'bush', ground: 'grass' }],
  [/^yard-ball/, { mood: 'play', prop: 'ball', ground: 'grass' }],
  [/^yard-rope/, { mood: 'jump', prop: 'rope', ground: 'grass' }],
  [/^yard-king/, { mood: 'play', prop: 'crown', ground: 'grass' }],
];

let previewCharacterId = 'yael';

export function setPreviewCharacter(id: string): void {
  previewCharacterId = id;
}

export function recipeForSituation(situationId: string, choice: SituationChoice): ShotRecipe {
  const key = `${situationId}/${choice.id}`;
  const known = SITUATION_SHOTS[key];
  if (known) return { key, ...known };
  return fromText(choice.label, key, 'home');
}

export function recipeForChoiceKey(key: string, label: string): ShotRecipe {
  const encounter = encounterShot(key);
  if (encounter) {
    return {
      key,
      mood: encounter.mood as ShotMood,
      prop: encounter.prop,
      ground: encounter.ground,
      friend: encounter.friend,
    };
  }
  if (key.includes('/')) {
    const slash = key.indexOf('/');
    const parent = key.slice(0, slash);
    const child = key.slice(slash + 1);
    const situation = SITUATION_SHOTS[key];
    if (situation) return { key, ...situation };
    return recipeForFollow(parent, child, label);
  }
  if (TASK_SHOTS[key]) return { key, ...TASK_SHOTS[key] };
  if (RECESS_SHOTS[key]) return { key, ...RECESS_SHOTS[key] };
  return recipeForScene(key, label);
}

export function previewImage(recipe: ShotRecipe): string {
  return studio.image(previewCharacterId, recipe);
}

function recipeForScene(sceneId: string, label: string): ShotRecipe {
  const rule = SCENE_RULES.find(([pattern]) => pattern.test(sceneId));
  const base = rule?.[1] ?? fromText(label, sceneId, 'home');
  const fromLabel = fromText(label, sceneId, base.ground);
  return {
    key: sceneId,
    mood: rule ? base.mood : fromLabel.mood,
    prop: rule ? base.prop : (fromLabel.prop ?? base.prop),
    ground: base.ground,
    friend: base.friend,
  };
}

function recipeForFollow(parentId: string, followId: string, label: string): ShotRecipe {
  const base = recipeForScene(parentId, label);
  const spoken = fromText(label, `${parentId}/${followId}`, base.ground);
  return {
    key: `${parentId}/${followId}`,
    mood: spoken.mood === 'talk' ? base.mood : spoken.mood,
    prop: spoken.prop ?? base.prop,
    ground: base.ground,
    friend: base.friend,
  };
}

function fromText(text: string, key: string, ground: Ground): ShotRecipe {
  let mood: ShotMood = 'talk';
  let prop: string | undefined;
  if (/לצעוק|בכעס|להתעצבן|להתלונן|לכעוס|לבעוט|קול רם|להאשים/.test(text)) mood = 'shout';
  else if (/ללחוש|בשקט/.test(text)) mood = 'whisper';
  else if (/לבכות|בפינה|לקפוא|להתכעס ולשבת/.test(text)) mood = 'cry';
  else if (/להסתיר|מחבוא/.test(text)) {
    mood = 'hide';
    prop = /מחבוא/.test(text) ? 'bush' : 'book';
  } else if (/לטאטא|מטאטא/.test(text)) {
    mood = 'clean';
    prop = 'broom';
  } else if (/לנגב|מטלית/.test(text)) {
    mood = 'clean';
    prop = 'cloth';
  } else if (/לאסוף|לנקות|לסדר|לפנות|לקפל/.test(text)) {
    mood = 'clean';
    if (/פח/.test(text)) prop = 'bin';
    else if (/קובי/.test(text)) prop = 'blocks';
  } else if (/לרוץ|לתפוס/.test(text)) mood = 'run';
  else if (/לחכות|ירוק/.test(text)) {
    mood = 'wait';
    prop = 'green';
  } else if (/אדום/.test(text)) {
    mood = 'run';
    prop = 'red';
  } else if (/לאפות|לבשל|מרק|עוגה|פסטה/.test(text)) {
    mood = 'cook';
    prop = /עוגה/.test(text) ? 'cake' : 'pot';
  } else if (/להתקשר|טלפון/.test(text)) {
    mood = 'phone';
    prop = 'handset';
  } else if (/כדור/.test(text)) {
    mood = 'play';
    prop = 'ball';
  } else if (/קובי|מגדל|גשר|טירה|מבצר|קומות/.test(text)) {
    mood = 'play';
    prop = /גשר/.test(text) ? 'bridge' : /טירה|מבצר/.test(text) ? 'castle' : 'blocks';
  } else if (/לצייר|ציור/.test(text)) {
    mood = 'draw';
    prop = 'page-house';
  } else if (/ספר|לקרוא|סיפור|קומיקס/.test(text)) {
    mood = 'read';
    prop = 'book';
  } else if (/להשקות|עציץ|פרח/.test(text)) {
    mood = 'water';
    prop = /פרח/.test(text) ? 'flower' : 'plant';
  } else if (/כביסה|חולצה|גרב|מגבת/.test(text)) {
    mood = 'clean';
    prop = 'shirt';
  } else if (/לרקוד|שיר|תופ/.test(text)) {
    mood = 'play';
    prop = 'notes';
  } else if (/לנוח|כרית|נשימ|שכיבה/.test(text)) {
    mood = 'rest';
    prop = 'pillow';
  } else if (/חבל|לקפוץ/.test(text)) {
    mood = 'jump';
    prop = 'rope';
  } else if (/מכונית|חניה|מסלול/.test(text)) {
    mood = 'play';
    prop = 'car';
  } else if (/לאכול|כריך|פירות|ארוחה/.test(text)) {
    mood = 'eat';
    prop = /פירות/.test(text) ? 'apple' : 'plate';
  } else if (/משחק|תחרות/.test(text)) {
    mood = 'play';
    prop = 'blocks';
  } else if (/לעזוב|ללכת|בלי מעיל/.test(text)) mood = 'leave';
  return { key, mood, prop, ground };
}

class PreviewStudio {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private floor: THREE.Mesh;
  private wall: THREE.Mesh;
  private heroRoot = new THREE.Group();
  private propRoot = new THREE.Group();
  private friendRoot = new THREE.Group();
  private hero?: THREE.Group;
  private heroId = '';
  private heroMixer?: THREE.AnimationMixer;
  private heroClips: THREE.AnimationClip[] = [];
  private friend?: THREE.Group;
  private friendId = '';
  private friendMixer?: THREE.AnimationMixer;
  private cache = new Map<string, string>();

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setSize(360, 220, false);
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(0xc5d8ee);
    this.hemi = new THREE.HemisphereLight(0xbcd6ff, 0x6a7a55, 1.05);
    this.sun = new THREE.DirectionalLight(0xfff2d6, 1.15);
    this.sun.position.set(2.4, 4.2, 3.2);
    this.floor = new THREE.Mesh(
      new THREE.CircleGeometry(4.2, 28),
      new THREE.MeshStandardMaterial({ color: GROUND_COLOR.home, roughness: 0.9 }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.wall = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 4.2),
      new THREE.MeshStandardMaterial({ color: WALL_COLOR.home, roughness: 0.95 }),
    );
    this.wall.position.set(0, 2, -1.6);
    this.scene.add(this.hemi, this.sun, this.floor, this.wall, this.heroRoot, this.propRoot, this.friendRoot);
    this.camera = new THREE.PerspectiveCamera(34, 360 / 220, 0.1, 30);
  }

  image(characterId: string, recipe: ShotRecipe): string {
    const cacheKey = `${characterId}|${recipe.key}|${recipe.mood}|${recipe.prop ?? ''}|${recipe.friend ?? ''}|${recipe.ground}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    if (!this.ensureHero(characterId)) return '';
    this.paint(recipe);
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/jpeg', 0.8);
    this.cache.set(cacheKey, url);
    return url;
  }

  private ensureHero(id: string): boolean {
    if (this.hero && this.heroId === id) return true;
    const loaded = takeCharacterModel(id) ?? takeCharacterModel('yael');
    if (!loaded) return false;
    this.heroRoot.clear();
    this.hero = loaded.mesh;
    this.heroClips = loaded.clips;
    this.heroMixer = new THREE.AnimationMixer(loaded.mesh);
    this.heroRoot.add(loaded.mesh);
    this.heroId = id;
    return true;
  }

  private paint(recipe: ShotRecipe): void {
    const floorMat = this.floor.material as THREE.MeshStandardMaterial;
    const wallMat = this.wall.material as THREE.MeshStandardMaterial;
    floorMat.color.setHex(GROUND_COLOR[recipe.ground]);
    wallMat.color.setHex(WALL_COLOR[recipe.ground]);
    this.scene.background = new THREE.Color(recipe.ground === 'grass' ? 0x8ec8ef : 0xd5e4f2);
    this.wall.visible = recipe.ground !== 'grass';

    const clipKind = uprightProp(recipe) ? 'idle' : CLIP_FOR[recipe.mood];
    this.pose(this.hero!, this.heroMixer!, this.heroClips, clipKind);
    this.hero!.rotation.y = recipe.mood === 'leave' || recipe.mood === 'run' ? 0.55 : 0;
    this.hero!.position.set(0, 0, 0);
    this.dressFace(this.hero!, recipe.mood);
    const aim = Math.atan2(1.15, 3.3);
    if (recipe.mood !== 'leave' && recipe.mood !== 'run') this.turnToward(this.hero!, aim);
    this.plant(this.hero!, recipe.friend ? -0.42 : 0);

    this.propRoot.clear();
    if (recipe.prop) {
      const prop = buildProp(recipe.prop);
      placeProp(prop, recipe, this.hero!);
      this.propRoot.add(prop);
    }
    const marks =
      recipe.mood === 'shout' ? shoutBursts() : recipe.mood === 'cry' ? tears() : recipe.mood === 'whisper' ? whisperMarks() : null;
    if (marks) {
      const mouth = this.hero!.getObjectByName('face-mouth');
      const head = this.hero!.getObjectByName('Head');
      const at = mouth ? mouth.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 1.5, 0.3);
      const from = head ? head.getWorldPosition(new THREE.Vector3()) : at.clone().setZ(at.z - 0.2);
      const outward = at.clone().sub(from);
      outward.y = 0;
      if (outward.lengthSq() < 0.0008) outward.set(0, 0, 1);
      outward.normalize();
      marks.position.copy(at).addScaledVector(outward, recipe.mood === 'shout' ? 0.2 : 0.05);
      marks.lookAt(marks.position.clone().add(outward));
      this.propRoot.add(marks);
    }

    this.friendRoot.clear();
    if (recipe.friend) this.addFriend(recipe.friend, aim);

    this.camera.fov = 36;
    const frame = posedBounds(this.heroRoot, frameBounds);
    if (recipe.friend && this.friend) frame.union(posedBounds(this.friendRoot, scratchBounds));
    frame.union(scratchBounds.setFromObject(this.propRoot));
    const center = frame.getCenter(scratchCenter);
    const size = frame.getSize(scratchSize);
    const dist = THREE.MathUtils.clamp(Math.max(size.y, size.x) * 1.55, 3.05, 4.8);
    this.camera.position.set(center.x + dist * 0.34, center.y * 0.92 + 0.35, center.z + dist);
    this.camera.lookAt(center.x, Math.max(0.9, center.y * 0.72), center.z);
    this.camera.updateProjectionMatrix();
  }

  private turnToward(root: THREE.Object3D, aim: number): void {
    root.updateMatrixWorld(true);
    const mouth = root.getObjectByName('face-mouth');
    const head = root.getObjectByName('Head');
    if (!mouth || !head) return;
    const face = mouth.getWorldPosition(new THREE.Vector3()).sub(head.getWorldPosition(new THREE.Vector3()));
    face.y = 0;
    if (face.lengthSq() < 0.0008) return;
    root.rotation.y += aim - Math.atan2(face.x, face.z);
  }

  private plant(root: THREE.Object3D, anchorX: number): void {
    const box = posedBounds(root, scratchBounds);
    if (box.isEmpty()) return;
    const center = box.getCenter(scratchCenter);
    root.position.x += anchorX - center.x;
    root.position.z -= center.z;
    root.position.y -= box.min.y;
  }

  private pose(root: THREE.Group, mixer: THREE.AnimationMixer, clips: THREE.AnimationClip[], kind: string): void {
    mixer.stopAllAction();
    const clip = pickClip(clips, kind);
    if (!clip) return;
    const action = mixer.clipAction(clip);
    action.enabled = true;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.reset().play();
    const early = kind === 'clean' || kind === 'cook';
    const sample = early ? Math.min(clip.duration * 0.2, 0.32) : Math.min(Math.max(clip.duration * 0.42, 0.25), 0.75);
    mixer.setTime(0);
    const hips = root.getObjectByName('Hips');
    const parked = hips ? hips.position.clone() : null;
    mixer.setTime(sample);
    if (hips && parked) {
      hips.position.x = parked.x;
      hips.position.z = parked.z;
    }
    root.position.set(0, 0, 0);
  }

  private dressFace(root: THREE.Object3D, mood: ShotMood): void {
    root.traverse((obj) => {
      if (obj.name !== 'face-mouth') return;
      if (mood === 'shout') obj.scale.set(1.7, 1.05, 0.7);
      else if (mood === 'cry') obj.scale.set(1.15, 0.7, 0.5);
      else if (mood === 'whisper') obj.scale.set(0.9, 0.22, 0.35);
      else obj.scale.set(1.35, 0.42, 0.55);
    });
  }

  private addFriend(id: string, aim: number): void {
    if (this.friendId !== id) {
      const loaded = takeCharacterModel(id);
      if (!loaded) return;
      this.friend = loaded.mesh;
      this.friendMixer = new THREE.AnimationMixer(loaded.mesh);
      this.pose(loaded.mesh, this.friendMixer, loaded.clips, 'idle');
      this.friendId = id;
    }
    if (!this.friend) return;
    this.friend.rotation.y = 0;
    this.friend.position.set(0, 0, 0);
    this.turnToward(this.friend, aim + 0.35);
    this.plant(this.friend, 0.72);
    this.friendRoot.add(this.friend);
  }
}

const frameBounds = new THREE.Box3();
const scratchBounds = new THREE.Box3();
const scratchCenter = new THREE.Vector3();
const scratchSize = new THREE.Vector3();
const scratchPoint = new THREE.Vector3();
const seenBones = new Set<THREE.Bone>();

/** Bounds from the posed bones, not every skinned vertex. */
function posedBounds(root: THREE.Object3D, target: THREE.Box3): THREE.Box3 {
  target.makeEmpty();
  seenBones.clear();
  root.updateWorldMatrix(true, true);
  root.traverse((obj) => {
    const skinned = obj as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh) {
      for (const bone of skinned.skeleton.bones) {
        if (seenBones.has(bone)) continue;
        seenBones.add(bone);
        bone.getWorldPosition(scratchPoint);
        target.expandByPoint(scratchPoint);
      }
      return;
    }
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.getWorldPosition(scratchPoint);
    target.expandByPoint(scratchPoint);
  });
  if (!target.isEmpty()) target.min.y -= 0.06;
  return target;
}

function uprightProp(recipe: ShotRecipe): boolean {
  return recipe.prop === 'cloth' || recipe.prop === 'window' || recipe.prop === 'pot' || recipe.prop === 'cake' || recipe.prop === 'steam' || recipe.prop === 'handset' || recipe.prop === 'plate' || recipe.prop === 'apple';
}

function placeProp(prop: THREE.Group, recipe: ShotRecipe, hero: THREE.Object3D): void {
  hero.updateMatrixWorld(true);
  const mouth = hero.getObjectByName('face-mouth');
  const head = hero.getObjectByName('Head');
  const mouthPos = mouth ? mouth.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(0, 1.45, 0.25);
  const headPos = head ? head.getWorldPosition(new THREE.Vector3()) : mouthPos.clone();
  const box = posedBounds(hero, scratchBounds);
  const center = box.getCenter(new THREE.Vector3());
  const face = mouthPos.clone().sub(headPos);
  face.y = 0;
  if (face.lengthSq() < 0.0008) face.set(0, 0, 1);
  face.normalize();
  if (recipe.mood === 'hide' && recipe.prop === 'book') {
    prop.scale.set(3.6, 1, 3.4);
    prop.position.set(mouthPos.x, mouthPos.y + 0.18, mouthPos.z + 0.32);
    prop.rotation.x = Math.PI / 2;
    return;
  }
  if (recipe.mood === 'phone') {
    prop.scale.set(1.15, 2.3, 1.15);
    prop.rotation.z = 0.55;
    prop.position.set(mouthPos.x + 0.7, mouthPos.y - 0.34, mouthPos.z + 0.16);
    return;
  }
  if (recipe.mood === 'read' || recipe.mood === 'draw') {
    prop.position.set(center.x + 0.12, box.min.y + (center.y - box.min.y) * 0.55, center.z + 0.38);
    prop.rotation.x = -0.65;
    return;
  }
  if (recipe.prop === 'cloth' || recipe.prop === 'plate' || recipe.prop === 'apple') {
    prop.scale.setScalar(1.55);
    prop.position.set(center.x + 0.22, box.min.y + (center.y - box.min.y) * 0.62, center.z + 0.42);
    return;
  }
  if (recipe.prop === 'pot' || recipe.prop === 'cake' || recipe.prop === 'steam') {
    prop.scale.setScalar(2.1);
    prop.position.set(center.x + 0.62, 0.42, center.z + 0.22);
    return;
  }
  prop.position.set(center.x + 0.55, 0, center.z + 0.28);
  prop.scale.multiplyScalar(1.25);
}

function shoutBursts(): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0xe24b3a, roughness: 0.5 });
  for (let i = 0; i < 3; i++) {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.16 + i * 0.1, 0.025, 8, 14, Math.PI * 0.7), material);
    arc.position.set(0.02, 0.02, -(0.04 + i * 0.1));
    arc.rotation.z = -0.15;
    group.add(arc);
  }
  return group;
}

function tears(): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0x7eb6e8, roughness: 0.3 });
  for (const x of [-0.08, 0.08]) {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), material);
    drop.scale.set(0.7, 1.4, 0.7);
    drop.position.set(x, -0.02, 0.02);
    group.add(drop);
  }
  return group;
}

function whisperMarks(): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: 0xd7e4f2, roughness: 0.4 });
  for (let i = 0; i < 3; i++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.03 + i * 0.01, 8, 6), material);
    dot.position.set(0.14 + i * 0.09, 0.05, -(0.02 + i * 0.04));
    group.add(dot);
  }
  return group;
}

function mat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72 });
}

function buildProp(kind: string): THREE.Group {
  const group = new THREE.Group();
  const add = (mesh: THREE.Mesh, x = 0, y = 0, z = 0) => {
    mesh.position.set(x, y, z);
    group.add(mesh);
  };
  if (kind === 'puddle') {
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), mat(0x6aa4c8));
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.y = 0.02;
    group.add(puddle);
  } else if (kind === 'cloth') {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.22), mat(0x3d9b8f)), 0, 0.04, 0);
  } else if (kind === 'broom') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.15, 8), mat(0x8a5a32));
    handle.position.y = 0.58;
    handle.rotation.z = 0.35;
    group.add(handle);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.12), mat(0xc4a574)), 0.18, 0.08, 0);
  } else if (kind === 'book') {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.36), mat(0x2c4460)), 0, 0.04, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.32), mat(0xf7f4ef)), 0, 0.07, 0);
  } else if (kind === 'ball') {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), mat(0xe24b3a)), 0, 0.18, 0);
  } else if (kind === 'pot' || kind === 'steam') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.18, 12), mat(0xb7bcc6)), 0, 0.12, 0);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 10), mat(0xd4552a)), 0, 0.2, 0);
    if (kind === 'steam') {
      add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(0xf4f7fb)), 0, 0.28, 0);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat(0xf4f7fb)), 0.06, 0.38, 0);
    }
  } else if (kind === 'plate') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.04, 16), mat(0xf4f1ea)), 0, 0.04, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(0xe2b143)), 0, 0.1, 0);
  } else if (kind === 'handset') {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.06), mat(0x1c1c1c)), 0, 0.16, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.02), mat(0x7fd0ea)), 0, 0.18, 0.035);
  } else if (kind === 'blocks') {
    [0xc4473a, 0xe2b143, 0x3d7a9a].forEach((color, i) => {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.22), mat(color)), 0, 0.1 + i * 0.16, 0);
    });
  } else if (kind === 'bridge') {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, 0.16), mat(0xc4473a)), -0.22, 0.16, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, 0.16), mat(0x3d7a9a)), 0.22, 0.16, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.16), mat(0xe2b143)), 0, 0.34, 0);
  } else if (kind === 'castle') {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.28, 0.28), mat(0xc2b48a)), 0, 0.16, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.12), mat(0x8a5a32)), -0.16, 0.32, 0);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 4), mat(0xc4473a)), -0.16, 0.56, 0);
  } else if (kind === 'car') {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.22), mat(0x2a2a2a)), 0, 0.03, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.16), mat(0x1d4e89)), 0, 0.12, 0);
  } else if (kind === 'plant' || kind === 'flower') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.12, 10), mat(0x6e4b32)), 0, 0.08, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(kind === 'flower' ? 0xe56b93 : 0x3e7a45)), 0, 0.24, 0);
  } else if (kind === 'shirt') {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.26), mat(0xd7e4f2)), 0, 0.05, 0);
  } else if (kind === 'notes') {
    [0, 1, 2].forEach((i) => add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(0xe2b143)), (i - 1) * 0.12, 0.45 + i * 0.08, 0));
  } else if (kind === 'pillow') {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.24), mat(0xf2d6de)), 0, 0.08, 0);
  } else if (kind === 'rope') {
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 8, 18), mat(0xd8a15a));
    rope.rotation.x = Math.PI / 2;
    rope.position.y = 0.04;
    group.add(rope);
  } else if (kind === 'bush') {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), mat(0x2f6b3a)), 0, 0.22, 0);
  } else if (kind === 'cones') {
    add(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 10), mat(0xf08a24)), -0.16, 0.16, 0);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 10), mat(0xf08a24)), 0.16, 0.16, 0);
  } else if (kind === 'crown') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.14, 6), mat(0xe2b143)), 0, 0.16, 0);
  } else if (kind === 'rug') {
    const rug = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.4), mat(0xb85c38));
    rug.position.y = 0.02;
    group.add(rug);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.05, 8), mat(0x8a5a32)), 0.2, 0.5, 0);
  } else if (kind === 'sofa') {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 0.28), mat(0xd07a8a)), 0, 0.16, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.08), mat(0xc45b7a)), 0, 0.32, -0.1);
  } else if (kind === 'window') {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.36, 0.04), mat(0xb9d7ea)), 0, 0.4, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.05), mat(0xf7f4ef)), 0, 0.58, 0);
  } else if (kind === 'cake') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 12), mat(0xf2c1d0)), 0, 0.1, 0);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 6), mat(0xe2b143)), 0, 0.2, 0);
  } else if (kind === 'apple') {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), mat(0xc4473a)), 0, 0.12, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), mat(0xe2b143)), 0.16, 0.1, 0);
  } else if (kind === 'basket') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.16, 10), mat(0xc2b48a)), 0, 0.1, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mat(0xe24b3a)), 0, 0.22, 0);
  } else if (kind === 'green' || kind === 'red') {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.36, 0.08), mat(0x2a2a2a)), 0, 0.28, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat(kind === 'green' ? 0x3caf4a : 0xd23b32)), 0, kind === 'green' ? 0.16 : 0.4, 0.05);
  } else if (kind === 'bag') {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.16), mat(0xe4d2ae)), 0, 0.12, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.08), mat(0xc4473a)), 0.16, 0.04, 0.08);
  } else if (kind === 'bin') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.32, 10), mat(0x3a6b45)), 0, 0.18, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.04), mat(0x2a2a2a)), 0, 0.36, 0);
  } else if (kind === 'cat') {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), mat(0xd8a15a)), 0, 0.14, 0);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 4), mat(0xd8a15a)), -0.05, 0.26, 0.04);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 4), mat(0xd8a15a)), 0.05, 0.26, 0.04);
  } else if (kind === 'puppy') {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), mat(0x8b5a2b)), 0, 0.16, 0);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mat(0x8b5a2b)), 0.16, 0.24, 0);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4), mat(0x6b3f1d)), 0.12, 0.32, 0);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4), mat(0x6b3f1d)), 0.2, 0.32, 0);
  } else if (kind === 'bike') {
    const wheel = (x: number) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 6, 12), mat(0x222222));
      ring.position.set(x, 0.1, 0);
      group.add(ring);
    };
    wheel(-0.16);
    wheel(0.16);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.03, 0.03), mat(0x1d4e89)), 0, 0.16, 0);
  } else if (kind === 'fort') {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.16), mat(0x6b4228)), -0.2, 0.22, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.16), mat(0x6b4228)), 0.2, 0.22, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.4), mat(0xf2d6de)), 0, 0.42, 0);
  } else if (kind === 'rain') {
    for (let i = 0; i < 6; i++) {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.02), mat(0x7eb6e8)), (i - 2.5) * 0.08, 0.4 + (i % 2) * 0.1, 0);
    }
  } else if (kind.startsWith('page')) {
    const draw = kind.endsWith('sun') ? 'sun' : kind.endsWith('cat') ? 'cat' : 'house';
    const page = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.02, 0.32),
      new THREE.MeshStandardMaterial({ map: pageTexture(draw), roughness: 0.8 }),
    );
    page.position.y = 0.02;
    group.add(page);
  } else {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), mat(0xc2b48a)), 0, 0.12, 0);
  }
  return group;
}

const pageCache = new Map<string, THREE.CanvasTexture>();

function pageTexture(draw: 'house' | 'sun' | 'cat'): THREE.CanvasTexture {
  const cached = pageCache.get(draw);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f7f4ef';
  ctx.fillRect(0, 0, 128, 96);
  ctx.strokeStyle = '#2c4460';
  ctx.fillStyle = '#2c4460';
  ctx.lineWidth = 4;
  if (draw === 'house') {
    ctx.strokeRect(34, 40, 60, 40);
    ctx.beginPath();
    ctx.moveTo(28, 42);
    ctx.lineTo(64, 16);
    ctx.lineTo(100, 42);
    ctx.stroke();
    ctx.strokeRect(56, 58, 16, 22);
  } else if (draw === 'sun') {
    ctx.beginPath();
    ctx.arc(64, 48, 16, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(64 + Math.cos(a) * 22, 48 + Math.sin(a) * 22);
      ctx.lineTo(64 + Math.cos(a) * 32, 48 + Math.sin(a) * 32);
      ctx.stroke();
    }
  } else {
    ctx.beginPath();
    ctx.arc(64, 52, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(50, 38);
    ctx.lineTo(46, 22);
    ctx.lineTo(60, 36);
    ctx.moveTo(78, 38);
    ctx.lineTo(84, 22);
    ctx.lineTo(70, 36);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  pageCache.set(draw, texture);
  return texture;
}

const studio = new PreviewStudio();
