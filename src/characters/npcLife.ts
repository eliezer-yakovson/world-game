import * as THREE from 'three';
import type { GameClock } from '../core/GameClock';
import type { MemoryStore } from '../core/MemoryStore';
import type { NpcManager } from './NpcManager';
import { STRENGTH_LABELS, ZONE_LABELS, emptyStrengths, type StrengthId, type StrengthMap, type ZoneId } from '../core/types';
import { allRides, approachOf, rideById, sampleRide, type RidePose } from '../world/playground';
import { allLunaRides, approachLuna, lunaLine, lunaRideById, lunaRoute, sampleLuna } from '../world/lunaPark';

function anyRide(id: string) {
  return rideById(id) ?? lunaRideById(id);
}

function anySample(id: string, slot: number, t: number): RidePose {
  return rideById(id) ? sampleRide(id, slot, t) : sampleLuna(id, slot, t);
}

function anyApproach(id: string, slot: number): { x: number; z: number } {
  return rideById(id) ? approachOf(id, slot) : approachLuna(id, slot);
}

function ridesHere(zone: ZoneId) {
  return zone === 'luna' ? allLunaRides() : allRides();
}

/**
 * Each person gets a route when their story starts, then walks it.
 * The activity is chosen only on arrival, and the outcome is a random
 * choice that can raise or lower a strength and unlock the next event.
 */

export interface LifeCard {
  zone: string;
  place: string;
  step: string;
  doing: string;
  strengths: StrengthMap;
  achievements: Array<{ title: string; detail: string; timeLabel: string }>;
}

interface Choice {
  label: string;
  text: string;
  awards: Partial<StrengthMap>;
  emote: string;
  /** Later events with this id become available. */
  unlocks?: string;
}

interface LifeEvent {
  id: string;
  title: string;
  line: string;
  emote: string;
  seconds: number;
  requires?: string;
  needs?: Partial<StrengthMap>;
  choices: Choice[];
}

type Kind = 'play' | 'learn' | 'shop' | 'animals' | 'home' | 'street' | 'yard';

interface Place {
  id: string;
  zone: ZoneId;
  name: string;
  x: number;
  z: number;
  yaw: number;
  kind: Kind;
}

interface Stop {
  zone: ZoneId;
  placeId: string;
}

interface Life {
  id: string;
  route: Stop[];
  index: number;
  zone: ZoneId;
  placeId: string;
  x: number;
  z: number;
  yaw: number;
  phase: 'walk' | 'act' | 'talk' | 'leave' | 'ride' | 'queue';
  goalX: number;
  goalZ: number;
  viaX: number | null;
  viaZ: number | null;
  trail: Array<{ x: number; z: number }>;
  /** Set while walking from a park arrival to the chosen playground piece. */
  headingToRide: boolean;
  /** Standing in line, or walking to a queue mark. */
  queuing: boolean;
  /** Queue index last used to choose the walking goal. */
  lined: number;
  rideId: string | null;
  rideSlot: number;
  rideTries: number;
  rideLine: string;
  eventId: string | null;
  seconds: number;
  actFor: number;
  partnerId: string | null;
  talkCooldown: number;
  stuck: number;
  hops: number;
  progress: number;
  strengths: StrengthMap;
  achievements: LifeCard['achievements'];
  unlocked: Set<string>;
}

const STUDENTS = new Set(['noam', 'maya', 'dani', 'lior', 'shira', 'eitan', 'hila', 'aviv', 'yosef', 'rut']);
const KIDS = new Set([...STUDENTS, 'brother', 'sister']);

const EVENTS: Record<Kind, LifeEvent[]> = {
  play: [
    {
      id: 'pass',
      title: 'מוסר כדור',
      line: 'מוסר כדור לחברים',
      emote: 'play',
      seconds: 8,
      choices: [
        { label: 'מסירה רכה', text: 'מסר בעדינות וכולם נשארו במשחק', awards: { friendship: 1, restraint: 1 }, emote: 'play', unlocks: 'fair' },
        { label: 'זריקה חזקה', text: 'זרק חזק. מישהו נבהל והתרחק', awards: { courage: 1, friendship: -1 }, emote: 'stomp' },
      ],
    },
    {
      id: 'rope',
      title: 'קופץ בחבל',
      line: 'קופץ בחבל עם החבורה',
      emote: 'jump',
      seconds: 8,
      choices: [
        { label: 'מחכה לתור', text: 'חיכה לתור וסובב לאחרים', awards: { restraint: 1, friendship: 1 }, emote: 'idle' },
        { label: 'קופץ באמצע', text: 'קפץ לתוך החבל בלי לשאול', awards: { courage: 1, friendship: -1 }, emote: 'jump' },
      ],
    },
    {
      id: 'board',
      title: 'משחק קופסה',
      line: 'משחק משחק קופסה',
      emote: 'sit',
      seconds: 9,
      choices: [
        { label: 'מציע חוק', text: 'הציע חוק חדש והמשחק נהיה מעניין', awards: { creativity: 1, speech: 1 }, emote: 'talk' },
        { label: 'מוותר', text: 'ויתר כדי שכולם יישארו', awards: { friendship: 1, restraint: 1 }, emote: 'idle', unlocks: 'fair' },
      ],
    },
    {
      id: 'fair',
      title: 'משחק הוגן',
      line: 'שומר שהמשחק יישאר הוגן',
      emote: 'talk',
      seconds: 7,
      requires: 'fair',
      choices: [
        { label: 'מחלק תורות', text: 'חילק תורות וקיבל תודה', awards: { responsibility: 1, friendship: 1 }, emote: 'talk' },
        { label: 'מוותר על ניצחון', text: 'ויתר על ניצחון כדי לסיים בכיף', awards: { restraint: 2 }, emote: 'idle' },
      ],
    },
  ],
  learn: [
    {
      id: 'listen',
      title: 'מקשיב לשיעור',
      line: 'יושב ומקשיב לשיעור',
      emote: 'sit',
      seconds: 9,
      choices: [
        { label: 'רושם', text: 'רשם לעצמו את מה שנאמר', awards: { responsibility: 1 }, emote: 'sit' },
        { label: 'חולם', text: 'חלם בהקיץ והפסיד חלק מהשיעור', awards: { creativity: 1, responsibility: -1 }, emote: 'idle' },
      ],
    },
    {
      id: 'ask',
      title: 'שואל שאלה',
      line: 'מרים יד ושואל',
      emote: 'talk',
      seconds: 7,
      choices: [
        { label: 'שואל בפשטות', text: 'שאל בפשטות וקיבל תשובה', awards: { speech: 1, courage: 1 }, emote: 'talk', unlocks: 'explain' },
        { label: 'צועק את השאלה', text: 'צעק את השאלה והכיתה נבהלה', awards: { courage: 1, restraint: -1 }, emote: 'stomp' },
      ],
    },
    {
      id: 'help-note',
      title: 'עוזר במחברת',
      line: 'עוזר לחבר להשלים מחברת',
      emote: 'talk',
      seconds: 8,
      choices: [
        { label: 'מסביר לאט', text: 'הסביר לאט והחבר הבין', awards: { friendship: 1, speech: 1 }, emote: 'talk' },
        { label: 'כותב במקומו', text: 'כתב במקומו, והחבר לא למד', awards: { friendship: 1, responsibility: -1 }, emote: 'idle' },
      ],
    },
    {
      id: 'explain',
      title: 'מסביר לכיתה',
      line: 'מסביר משהו לכיתה',
      emote: 'talk',
      seconds: 8,
      requires: 'explain',
      needs: { speech: 3 },
      choices: [
        { label: 'מסביר בדוגמה', text: 'הסביר עם דוגמה וכולם הבינו', awards: { speech: 2, creativity: 1 }, emote: 'talk' },
        { label: 'ממהר', text: 'מיהר והתבלבל באמצע', awards: { courage: 1, speech: -1 }, emote: 'idle' },
      ],
    },
  ],
  shop: [
    {
      id: 'fruit',
      title: 'בוחר פרי',
      line: 'בוחר פרי במכולת',
      emote: 'idle',
      seconds: 7,
      choices: [
        { label: 'מחכה בתור', text: 'חיכה בתור ושילם יפה', awards: { restraint: 1, responsibility: 1 }, emote: 'idle' },
        { label: 'נדחף', text: 'נדחף בתור ומישהו התעצבן', awards: { courage: 1, friendship: -1 }, emote: 'stomp' },
      ],
    },
    {
      id: 'shelf',
      title: 'מסדר מדף',
      line: 'עוזר לסדר מדף',
      emote: 'clean',
      seconds: 8,
      choices: [
        { label: 'מחזיר למקום', text: 'החזיר מוצר למדף', awards: { responsibility: 1 }, emote: 'clean', unlocks: 'gift' },
        { label: 'מפיל קופסה', text: 'הפיל קופסה והתבייש', awards: { courage: -1, responsibility: 1 }, emote: 'sad' },
      ],
    },
    {
      id: 'gift',
      title: 'קונה מתנה',
      line: 'מחפש מתנה קטנה',
      emote: 'idle',
      seconds: 8,
      requires: 'gift',
      needs: { friendship: 2 },
      choices: [
        { label: 'בוחר לחבר', text: 'בחר מתנה שמתאימה לחבר', awards: { friendship: 2, creativity: 1 }, emote: 'play' },
        { label: 'שוכח את הכסף', text: 'שכח את הכסף וחזר בידיים ריקות', awards: { responsibility: -1 }, emote: 'sad' },
      ],
    },
  ],
  animals: [
    {
      id: 'watch',
      title: 'מסתכל על חיה',
      line: 'עומד ומתבונן בחיה',
      emote: 'idle',
      seconds: 8,
      choices: [
        { label: 'שומר מרחק', text: 'שמר מרחק וקרא את השלט', awards: { responsibility: 1, restraint: 1 }, emote: 'idle' },
        { label: 'מתקרב מדי', text: 'התקרב מדי והחיה ברחה', awards: { courage: 1, responsibility: -1 }, emote: 'stomp' },
      ],
    },
    {
      id: 'copy',
      title: 'מחקה חיה',
      line: 'מחקה את תנועת החיה',
      emote: 'play',
      seconds: 7,
      choices: [
        { label: 'מחקה בשקט', text: 'חיקה בשקט ומישהו צחק איתו', awards: { creativity: 1, friendship: 1 }, emote: 'play', unlocks: 'guide' },
        { label: 'צועק כמו החיה', text: 'צעק והבהיל ילד קטן', awards: { creativity: 1, friendship: -1 }, emote: 'stomp' },
      ],
    },
    {
      id: 'guide',
      title: 'מסביר על החיה',
      line: 'מסביר לילד מה רואים',
      emote: 'talk',
      seconds: 8,
      requires: 'guide',
      needs: { speech: 3 },
      choices: [
        { label: 'מסביר לאט', text: 'הסביר לאט והילד חייך', awards: { speech: 1, friendship: 1 }, emote: 'talk' },
        { label: 'מתבלבל בשם', text: 'התבלבל בשם החיה ותיקן את עצמו', awards: { flexibility: 1, speech: -1 }, emote: 'idle' },
      ],
    },
  ],
  home: [
    {
      id: 'toy',
      title: 'מסדר צעצועים',
      line: 'מסדר צעצועים',
      emote: 'clean',
      seconds: 8,
      choices: [
        { label: 'מחזיר לקופסה', text: 'החזיר צעצועים לקופסה', awards: { responsibility: 1 }, emote: 'clean' },
        { label: 'בונה במקום', text: 'בנה משהו חדש במקום לסדר', awards: { creativity: 1, responsibility: -1 }, emote: 'play' },
      ],
    },
    {
      id: 'read',
      title: 'קורא',
      line: 'קורא במקום שקט',
      emote: 'sit',
      seconds: 9,
      choices: [
        { label: 'קורא עד הסוף', text: 'קרא עד הסוף של העמוד', awards: { responsibility: 1, creativity: 1 }, emote: 'sit', unlocks: 'surprise' },
        { label: 'מדלג', text: 'דילג עמודים ואיבד את הסיפור', awards: { flexibility: 1, responsibility: -1 }, emote: 'idle' },
      ],
    },
    {
      id: 'kitchen',
      title: 'עוזר במטבח',
      line: 'עוזר במטבח',
      emote: 'cook',
      seconds: 8,
      choices: [
        { label: 'מביא צלחת', text: 'הביא צלחת בלי שנשפך', awards: { responsibility: 1, restraint: 1 }, emote: 'cook' },
        { label: 'נשפך', text: 'נשפך לו וניגב', awards: { responsibility: 1, flexibility: -1 }, emote: 'clean' },
      ],
    },
    {
      id: 'surprise',
      title: 'מכין הפתעה',
      line: 'מכין הפתעה קטנה',
      emote: 'play',
      seconds: 8,
      requires: 'surprise',
      needs: { creativity: 3 },
      choices: [
        { label: 'ציור', text: 'צייר משהו ונתן אותו', awards: { creativity: 2, friendship: 1 }, emote: 'play' },
        { label: 'מתחרט', text: 'התחיל וויתר באמצע', awards: { creativity: -1 }, emote: 'sad' },
      ],
    },
  ],
  street: [
    {
      id: 'wander',
      title: 'מטייל ברחוב',
      line: 'מטייל לאט ברחוב',
      emote: 'idle',
      seconds: 7,
      choices: [
        { label: 'מסתכל לצדדים', text: 'הסתכל לצדדים לפני שחצה', awards: { responsibility: 1, restraint: 1 }, emote: 'idle' },
        { label: 'רץ לכביש', text: 'רץ בלי להסתכל ונעצר בזמן', awards: { courage: 1, responsibility: -1 }, emote: 'stomp' },
      ],
    },
    {
      id: 'wait-friend',
      title: 'מחכה לחבר',
      line: 'מחכה לחבר בפינה',
      emote: 'idle',
      seconds: 8,
      choices: [
        { label: 'מחכה', text: 'חיכה עד שהחבר הגיע', awards: { friendship: 1, restraint: 1 }, emote: 'idle', unlocks: 'gather' },
        { label: 'הולך', text: 'התייאש והלך', awards: { flexibility: 1, friendship: -1 }, emote: 'sad' },
      ],
    },
    {
      id: 'gather',
      title: 'מארגן משחק',
      line: 'מארגן משחק ברחוב',
      emote: 'talk',
      seconds: 8,
      requires: 'gather',
      needs: { friendship: 2 },
      choices: [
        { label: 'מזמין את כולם', text: 'הזמין את כולם והמשחק יצא לדרך', awards: { speech: 1, friendship: 1 }, emote: 'talk' },
        { label: 'בוחר רק אחד', text: 'בחר רק חבר אחד והשאר נעלבו', awards: { friendship: -1 }, emote: 'sad' },
      ],
    },
  ],
  yard: [
    {
      id: 'run',
      title: 'רץ בחצר',
      line: 'רץ בחצר',
      emote: 'play',
      seconds: 7,
      choices: [
        { label: 'רץ מסביב', text: 'רץ מסביב בלי להתנגש', awards: { flexibility: 1, restraint: 1 }, emote: 'play' },
        { label: 'נתקע', text: 'נתקע במישהו והתנצל', awards: { friendship: 1, flexibility: -1 }, emote: 'sad' },
      ],
    },
    {
      id: 'tower',
      title: 'בונה מגדל',
      line: 'בונה מגדל קטן',
      emote: 'clean',
      seconds: 8,
      choices: [
        { label: 'בונה לאט', text: 'בנה לאט והמגדל נשאר', awards: { creativity: 1, restraint: 1 }, emote: 'clean', unlocks: 'invite-play' },
        { label: 'הורס', text: 'הרס את המגדל וצחק', awards: { courage: 1, friendship: -1 }, emote: 'stomp' },
      ],
    },
    {
      id: 'invite-play',
      title: 'מזמין לשחק',
      line: 'מזמין מישהו לשחק',
      emote: 'talk',
      seconds: 7,
      requires: 'invite-play',
      needs: { friendship: 2 },
      choices: [
        { label: 'מזמין בשמחה', text: 'הזמין בשמחה ושיחקו יחד', awards: { friendship: 2, speech: 1 }, emote: 'play' },
        { label: 'מתחרט', text: 'הזמין ואז התחרט', awards: { friendship: -1, flexibility: 1 }, emote: 'sad' },
      ],
    },
  ],
};

const PLACES: Place[] = [
  { id: 'school-rope', zone: 'school', name: 'חבל בחצר', x: 7.6, z: 3.4, yaw: 0, kind: 'play' },
  { id: 'school-ball', zone: 'school', name: 'מגרש הכדור', x: 14.4, z: 3.6, yaw: 0.4, kind: 'play' },
  { id: 'school-board', zone: 'school', name: 'שולחן המשחק', x: 11.2, z: 8.6, yaw: 1.2, kind: 'play' },
  { id: 'school-class', zone: 'school', name: 'כניסה לכיתות', x: -8, z: 2.4, yaw: Math.PI, kind: 'learn' },
  { id: 'school-library', zone: 'school', name: 'ליד הספרייה', x: -4, z: 4.4, yaw: Math.PI, kind: 'learn' },
  { id: 'school-gate', zone: 'school', name: 'שער בית הספר', x: 2.2, z: 7.2, yaw: Math.PI, kind: 'yard' },
  { id: 'park-center', zone: 'park', name: 'מרכז הפארק', x: 1, z: 1.2, yaw: 0.2, kind: 'yard' },
  { id: 'park-shade', zone: 'park', name: 'הצל בפארק', x: 8, z: 4, yaw: -0.4, kind: 'play' },
  { id: 'park-dog', zone: 'park', name: 'ליד הכלב', x: -5.2, z: 5.4, yaw: 0.6, kind: 'animals' },
  { id: 'park-fair', zone: 'park', name: 'דוכן היריד', x: 5.2, z: -4.6, yaw: 1, kind: 'street' },
  { id: 'street-a', zone: 'neighborhood', name: 'הרחוב', x: -2, z: 6, yaw: 0.3, kind: 'street' },
  { id: 'street-b', zone: 'neighborhood', name: 'הפינה', x: 6, z: 7, yaw: -0.2, kind: 'street' },
  { id: 'street-c', zone: 'neighborhood', name: 'ליד הבתים', x: 2, z: 8.2, yaw: Math.PI, kind: 'yard' },
  { id: 'street-d', zone: 'neighborhood', name: 'מול השכן', x: 8, z: -6.5, yaw: 0.8, kind: 'street' },
  { id: 'shop-counter', zone: 'shop', name: 'הדלפק', x: 1.4, z: 2.6, yaw: Math.PI, kind: 'shop' },
  { id: 'shop-aisle', zone: 'shop', name: 'המעבר', x: -2.4, z: -1.2, yaw: 0.4, kind: 'shop' },
  { id: 'shop-fruit', zone: 'shop', name: 'ארגז הפירות', x: 3.2, z: -1.4, yaw: -0.6, kind: 'shop' },
  { id: 'zoo-path', zone: 'zoo', name: 'השביל', x: 0.4, z: 17.2, yaw: Math.PI, kind: 'animals' },
  { id: 'zoo-pen', zone: 'zoo', name: 'מול הכלוב', x: 3.4, z: 14.6, yaw: 0.5, kind: 'animals' },
  { id: 'zoo-bench', zone: 'zoo', name: 'הספסל בגן', x: -3.2, z: 16.2, yaw: 0.2, kind: 'yard' },
  { id: 'home-living', zone: 'home', name: 'הסלון', x: 1.6, z: 6.2, yaw: 0.4, kind: 'home' },
  { id: 'home-kitchen', zone: 'home', name: 'המטבח', x: 8.2, z: -6.4, yaw: Math.PI, kind: 'home' },
  { id: 'home-kids', zone: 'home', name: 'חדר הילדים', x: -10.2, z: 5.8, yaw: 0.5, kind: 'home' },
  { id: 'blue-living', zone: 'home_blue', name: 'הסלון הכחול', x: 4, z: 2, yaw: 0.4, kind: 'home' },
  { id: 'blue-kids', zone: 'home_blue', name: 'החדר של נועם', x: -8, z: 1.2, yaw: 0.2, kind: 'home' },
  { id: 'blue-music', zone: 'home_blue', name: 'פינת הנגינה', x: 12, z: 2.2, yaw: -0.6, kind: 'home' },
  { id: 'yellow-living', zone: 'home_yellow', name: 'הסלון הצהוב', x: 6, z: 6.4, yaw: 0.2, kind: 'home' },
  { id: 'yellow-kids', zone: 'home_yellow', name: 'החדר של מאיה', x: 8.2, z: -4.2, yaw: Math.PI, kind: 'home' },
  { id: 'yellow-window', zone: 'home_yellow', name: 'החלון לגינה', x: 8.2, z: 8.4, yaw: 0, kind: 'home' },
  { id: 'luna-gate', zone: 'luna', name: 'הכניסה ללונה פארק', x: 0, z: 16.2, yaw: Math.PI, kind: 'street' },
  { id: 'luna-mid', zone: 'luna', name: 'השביל המרכזי', x: 0, z: 8, yaw: Math.PI, kind: 'play' },
  { id: 'luna-west', zone: 'luna', name: 'השביל המערבי', x: -10.5, z: 2, yaw: 0.4, kind: 'play' },
  { id: 'luna-east', zone: 'luna', name: 'השביל המזרחי', x: 10.5, z: 2, yaw: -0.4, kind: 'play' },
];

const EXIT: Record<ZoneId, { x: number; z: number }> = {
  neighborhood: { x: -6, z: -2 },
  home: { x: 0, z: 9 },
  home_blue: { x: 0, z: 9 },
  home_yellow: { x: 0, z: 9 },
  school: { x: -8, z: 7.2 },
  shop: { x: 0, z: 6 },
  park: { x: 0, z: 13 },
  zoo: { x: 0, z: 22 },
  luna: { x: 0, z: 22 },
};

const placeById = new Map(PLACES.map((place) => [place.id, place]));

function allowedZones(id: string): ZoneId[] {
  if (id === 'mom' || id === 'dad') return ['home', 'neighborhood'];
  if (id === 'brother') return ['home', 'park', 'neighborhood', 'luna'];
  if (id === 'sister') return ['home', 'school', 'park', 'shop', 'neighborhood', 'luna'];
  if (id === 'teacher' || id === 'teacher_david') return ['school', 'neighborhood'];
  if (id === 'shopkeeper') return ['shop', 'neighborhood'];
  if (id === 'zookeeper') return ['zoo', 'neighborhood'];
  if (id === 'neighbor') return ['neighborhood', 'home_yellow', 'park'];
  if (id === 'noam') return ['school', 'park', 'neighborhood', 'shop', 'zoo', 'home_blue', 'luna'];
  if (id === 'maya') return ['school', 'park', 'neighborhood', 'shop', 'zoo', 'home_yellow', 'luna'];
  if (STUDENTS.has(id)) return ['school', 'park', 'neighborhood', 'shop', 'zoo', 'luna'];
  return ['neighborhood', 'park', 'luna'];
}

function zoneWeight(id: string, zone: ZoneId, hour: number): number {
  const school = hour >= 8 && hour < 14;
  if (STUDENTS.has(id) || id === 'sister' || id === 'teacher' || id === 'teacher_david') {
    if (zone === 'school') return school ? 6 : 1;
  }
  if (id === 'mom' || id === 'dad') return zone === 'home' ? 7 : 1;
  if (id === 'brother') return zone === 'home' ? 4 : zone === 'park' || zone === 'luna' ? 3 : 2;
  if (id === 'shopkeeper') return zone === 'shop' ? 8 : 1;
  if (id === 'zookeeper') return zone === 'zoo' ? 8 : 1;
  if (id === 'neighbor') return zone === 'neighborhood' ? 5 : 2;
  if (KIDS.has(id)) {
    if (zone === 'park' || zone === 'neighborhood' || zone === 'luna') return school ? 1 : 3;
    if (zone === 'home' || zone === 'home_blue' || zone === 'home_yellow') return school ? 1 : 3;
    return 1;
  }
  return 1;
}

function pickWeighted<T>(items: T[], weights: number[]): T {
  const sum = weights.reduce((total, weight) => total + weight, 0);
  let roll = Math.random() * (sum || 1);
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i] ?? 0;
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

function placesIn(zone: ZoneId): Place[] {
  return PLACES.filter((place) => place.zone === zone);
}

function rollRoute(id: string, hour: number): Stop[] {
  const stops: Stop[] = [];
  let previous: string | null = null;
  for (let n = 0; n < 4; n++) {
    const zone = pickWeighted(allowedZones(id), allowedZones(id).map((item) => zoneWeight(id, item, hour)));
    const options = placesIn(zone).filter((place) => place.id !== previous);
    const place = (options.length ? options : placesIn(zone))[Math.floor(Math.random() * (options.length || placesIn(zone).length))];
    stops.push({ zone, placeId: place.id });
    previous = place.id;
  }
  return stops;
}

function openEvents(kind: Kind, life: Life): LifeEvent[] {
  const open = EVENTS[kind].filter((event) => {
    if (event.requires && !life.unlocked.has(event.requires)) return false;
    if (!event.needs) return true;
    return (Object.keys(event.needs) as StrengthId[]).every((key) => life.strengths[key] >= (event.needs?.[key] ?? 0));
  });
  return open.length ? open : EVENTS[kind].filter((event) => !event.requires);
}

function awardText(awards: Partial<StrengthMap>): string {
  const parts: string[] = [];
  for (const key of Object.keys(awards) as StrengthId[]) {
    const amount = awards[key] ?? 0;
    if (!amount) continue;
    parts.push(`${STRENGTH_LABELS[key]} ${amount > 0 ? '+' : ''}${amount}`);
  }
  return parts.join(', ');
}

function applyAwards(strengths: StrengthMap, awards: Partial<StrengthMap>): void {
  for (const key of Object.keys(awards) as StrengthId[]) {
    strengths[key] = Math.max(0, Math.min(12, strengths[key] + (awards[key] ?? 0)));
  }
}

export class NpcLifeDirector {
  private readonly people = new Map<string, Life>();
  private captionCooldown = 0;
  private paused = false;
  private playerClaim: { id: string; slot: number } | null = null;
  private readonly lines = new Map<string, string[]>();
  seeded = false;

  constructor(
    private readonly npcs: NpcManager,
    private readonly memory: MemoryStore,
    private readonly enterView?: (id: string, x: number, z: number) => void,
  ) {}

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  /** The player sat on this seat, so other people leave it free. */
  claimRide(id: string, slot: number): void {
    this.playerClaim = { id, slot };
  }

  releaseClaim(): void {
    this.playerClaim = null;
  }

  slotTaken(id: string, slot: number): boolean {
    if (this.playerClaim?.id === id && this.playerClaim.slot === slot) return true;
    for (const life of this.people.values()) {
      if (life.rideId !== id || life.rideSlot !== slot || life.queuing) continue;
      if (life.phase === 'ride' || life.headingToRide) return true;
    }
    return false;
  }

  freeSlot(id: string): number {
    const ride = anyRide(id);
    if (!ride) return -1;
    for (let slot = 0; slot < ride.slots; slot++) {
      if (!this.slotTaken(id, slot)) return slot;
    }
    return -1;
  }

  joinQueue(rideId: string, personId: string): number {
    this.leaveQueue(personId);
    const spots = lunaLine(rideId);
    if (!spots.length) return -1;
    const line = this.lineFor(rideId);
    if (line.length >= spots.length) return -1;
    line.push(personId);
    return line.length - 1;
  }

  leaveQueue(personId: string): void {
    for (const line of this.lines.values()) {
      const index = line.indexOf(personId);
      if (index >= 0) line.splice(index, 1);
    }
  }

  queuePose(rideId: string, personId: string): { x: number; z: number; yaw: number } | null {
    const index = this.queueIndex(rideId, personId);
    if (index < 0) return null;
    return this.queueSpot(rideId, index);
  }

  queuePlace(rideId: string, personId: string): number {
    const index = this.queueIndex(rideId, personId);
    return index < 0 ? 0 : index + 1;
  }

  isQueueFront(rideId: string, personId: string): boolean {
    return this.lineFor(rideId)[0] === personId;
  }

  private lineFor(rideId: string): string[] {
    let line = this.lines.get(rideId);
    if (!line) {
      line = [];
      this.lines.set(rideId, line);
    }
    return line;
  }

  private queueIndex(rideId: string, personId: string): number {
    return this.lineFor(rideId).indexOf(personId);
  }

  private queueSpot(rideId: string, index: number): { x: number; z: number; yaw: number } | null {
    return lunaLine(rideId)[index] ?? null;
  }

  seed(profiles: Array<{ id: string; strengths?: Partial<StrengthMap> }>, hour: number): void {
    if (this.seeded) return;
    this.seeded = true;
    for (const profile of profiles) this.ensure(profile.id, hour, profile.strengths);
  }

  zoneOf(id: string): ZoneId | null {
    return this.people.get(id)?.zone ?? null;
  }

  bring(id: string, zone: ZoneId, hour: number): void {
    const life = this.ensure(id, hour);
    const places = placesIn(zone);
    const place = places[Math.floor(Math.random() * places.length)];
    life.route = [{ zone, placeId: place.id }, ...life.route.slice(life.index + 1)];
    life.index = 0;
    life.zone = zone;
    life.placeId = place.id;
    const door = EXIT[zone];
    life.x = door.x;
    life.z = door.z;
    life.phase = 'walk';
    this.aim(life, place, 0);
  }

  spawnsFor(zone: ZoneId): Array<{ id: string; position: THREE.Vector3 }> {
    const spawns: Array<{ id: string; position: THREE.Vector3 }> = [];
    for (const life of this.people.values()) {
      if (life.zone !== zone) continue;
      spawns.push({ id: life.id, position: new THREE.Vector3(life.x, 0, life.z) });
    }
    return spawns;
  }

  card(id: string): LifeCard | null {
    const life = this.people.get(id);
    if (!life) return null;
    const place = placeById.get(life.placeId);
    const event = this.currentEvent(life);
    const ride = life.rideId ? anyRide(life.rideId) : undefined;
    const queuePlace = life.rideId ? this.queueIndex(life.rideId, life.id) + 1 : 1;
    const doing =
      life.phase === 'queue'
        ? `בתור ל${ride?.name ?? 'מתקן'}, מקום ${queuePlace}`
        : life.phase === 'ride'
        ? life.rideLine || `על ${ride?.name ?? 'מתקן'}`
        : life.queuing && life.phase === 'walk'
          ? `הולך לתור של ${ride?.name ?? 'מתקן'}`
          : life.headingToRide && life.phase === 'walk'
          ? `הולך אל ${ride?.name ?? 'מתקן'}`
          : life.phase === 'walk'
            ? `הולך ברגל אל ${place?.name ?? 'המקום הבא'}`
            : life.phase === 'leave'
              ? `הולך ברגל אל ${ZONE_LABELS[life.route[Math.min(life.index + 1, life.route.length - 1)]?.zone ?? life.zone] ?? ''}`
              : life.phase === 'talk'
                ? `מדבר עם ${this.nameOf(life.partnerId)}`
                : (event?.line ?? 'נח לרגע');
    return {
      zone: ZONE_LABELS[life.zone],
      place: ride && (life.phase === 'ride' || life.phase === 'queue' || life.headingToRide) ? ride.name : (place?.name ?? ''),
      step: `תחנה ${life.index + 1} מתוך ${life.route.length}`,
      doing,
      strengths: { ...life.strengths },
      achievements: [...life.achievements],
    };
  }

  update(dt: number, zone: ZoneId, clock: GameClock, playerX: number, playerZ: number): string | null {
    this.captionCooldown = Math.max(0, this.captionCooldown - dt);
    let caption: string | null = null;
    const here = new Set(this.npcs.actors.map((actor) => actor.id));
    if (!this.paused) {
      for (const life of this.people.values()) {
        if (life.zone !== zone || !here.has(life.id)) continue;
        const note = this.stepVisible(life, dt, clock, playerX, playerZ);
        if (note && !caption && this.captionCooldown <= 0) {
          caption = note;
          this.captionCooldown = 7;
        }
      }
      const talked = this.maybeTalk(zone, clock);
      if (talked && !caption && this.captionCooldown <= 0) {
        caption = talked;
        this.captionCooldown = 7;
      }
    }
    for (const life of this.people.values()) {
      if (this.paused && life.zone === zone) continue;
      if (life.zone === zone && here.has(life.id)) continue;
      this.stepAbstract(life, dt, clock);
    }
    if (!this.paused) {
      for (const life of this.people.values()) {
        if (life.zone !== zone) continue;
        if (this.npcs.actors.some((actor) => actor.id === life.id)) continue;
        this.enterView?.(life.id, life.x, life.z);
      }
    }
    return caption;
  }

  private ensure(id: string, hour: number, base?: Partial<StrengthMap>): Life {
    const existing = this.people.get(id);
    if (existing) return existing;
    const route = rollRoute(id, hour);
    const first = route[0];
    const place = placeById.get(first.placeId) ?? PLACES[0];
    const start = placesIn(place.zone).find((item) => item.id !== place.id) ?? place;
    const walking = Math.random() < 0.65;
    const life: Life = {
      id,
      route,
      index: 0,
      zone: place.zone,
      placeId: place.id,
      x: walking ? start.x : place.x,
      z: walking ? start.z : place.z,
      yaw: place.yaw,
      phase: walking ? 'walk' : 'act',
      goalX: place.x,
      goalZ: place.z,
      viaX: null,
      viaZ: null,
      trail: [],
      headingToRide: false,
      queuing: false,
      lined: -1,
      rideId: null,
      rideSlot: 0,
      rideTries: 0,
      rideLine: '',
      eventId: null,
      seconds: 0,
      actFor: 8,
      partnerId: null,
      talkCooldown: 2 + Math.random() * 4,
      stuck: 0,
      hops: 0,
      progress: 999,
      strengths: emptyStrengths(2),
      achievements: [],
      unlocked: new Set(),
    };
    if (base) {
      for (const key of Object.keys(base) as StrengthId[]) {
        const amount = base[key];
        if (amount !== undefined) life.strengths[key] = amount;
      }
    }
    if (!walking) this.beginAct(life);
    else this.aim(life, place, this.crowdIndex(place.id, id));
    this.people.set(id, life);
    return life;
  }

  private stepVisible(life: Life, dt: number, clock: GameClock, playerX: number, playerZ: number): string | null {
    const actor = this.npcs.actors.find((item) => item.id === life.id);
    if (!actor) return null;
    life.x = actor.mesh.position.x;
    life.z = actor.mesh.position.z;
    life.talkCooldown = Math.max(0, life.talkCooldown - dt);
    if (life.phase === 'talk') return this.stepTalk(life, dt, clock, true);
    if (life.phase === 'ride') return this.stepRide(life, dt, clock, true);
    if (life.phase === 'queue') return this.stepQueue(life, dt, clock, true);
    if (life.phase === 'walk' || life.phase === 'leave') return this.stepWalk(life, dt, clock, playerX, playerZ, true);
    return this.stepAct(life, dt, clock, true, playerX, playerZ);
  }

  private stepAbstract(life: Life, dt: number, clock: GameClock): void {
    life.talkCooldown = Math.max(0, life.talkCooldown - dt);
    if (life.phase === 'talk') this.stepTalk(life, dt, clock, false);
    else if (life.phase === 'ride') this.stepRide(life, dt, clock, false);
    else if (life.phase === 'queue') this.stepQueue(life, dt, clock, false);
    else if (life.phase === 'walk' || life.phase === 'leave') this.stepWalk(life, dt, clock, life.x, life.z, false);
    else this.stepAct(life, dt, clock, false, 999, 999);
  }

  private stepWalk(life: Life, dt: number, clock: GameClock, playerX: number, playerZ: number, visible: boolean): string | null {
    if (life.queuing && life.rideId && life.phase === 'walk') {
      const index = this.queueIndex(life.rideId, life.id);
      if (index >= 0 && index !== life.lined) {
        life.lined = index;
        const spot = this.queueSpot(life.rideId, index);
        if (spot) this.plan(life, spot.x, spot.z);
      }
    }
    const tx = life.viaX ?? life.goalX;
    const tz = life.viaZ ?? life.goalZ;
    const dx = tx - life.x;
    const dz = tz - life.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.45) {
      if (life.viaX !== null) {
        if (life.trail.length) {
          const next = life.trail.shift();
          if (next) {
            life.viaX = next.x;
            life.viaZ = next.z;
          }
        } else {
          life.viaX = null;
          life.viaZ = null;
        }
        life.stuck = 0;
        life.progress = 999;
        return null;
      }
      return this.arrive(life, clock);
    }
    const nx = dx / dist;
    const nz = dz / dist;
    if (dist < life.progress - 0.08) {
      life.progress = dist;
      life.stuck = 0;
    } else {
      life.stuck += dt;
    }
    if (life.stuck > 2.4) {
      life.hops += 1;
      life.stuck = 0;
      life.progress = 999;
      if (life.hops >= 3) {
        life.viaX = null;
        life.viaZ = null;
        life.goalX = life.x;
        life.goalZ = life.z;
        life.hops = 0;
        return this.arrive(life, clock);
      }
      const side = life.hops % 2 === 0 ? 1 : -1;
      life.viaX = life.x + nz * 1.8 * side;
      life.viaZ = life.z - nx * 1.8 * side;
    }
    let steerX = nx;
    let steerZ = nz;
    let blocked = false;
    const bodies = this.bodies(life.id, visible, playerX, playerZ);
    for (const body of bodies) {
      const ox = body.x - life.x;
      const oz = body.z - life.z;
      const gap = Math.hypot(ox, oz);
      if (gap > 1.45 || gap < 0.001) continue;
      const ahead = ox * nx + oz * nz;
      const push = (1.45 - gap) / 1.45;
      if (gap < 1.15 && ahead > -0.25) blocked = true;
      if (gap < 1.15 || (ahead > -0.15 && ahead < 1.5)) {
        const sign = ox * nz - oz * nx >= 0 ? -1 : 1;
        steerX += nz * sign * push * 2.4;
        steerZ += -nx * sign * push * 2.4;
      }
    }
    if (blocked) {
      steerX -= nx;
      steerZ -= nz;
    }
    const steer = Math.hypot(steerX, steerZ) || 1;
    const step = Math.min(dist, 2.35 * dt);
    life.x += (steerX / steer) * step;
    life.z += (steerZ / steer) * step;
    life.yaw = Math.atan2(steerX, steerZ);
    if (visible) {
      this.npcs.moveBusy(life.id, life.x, life.z, life.yaw);
      this.npcs.playClip(life.id, 'walk', true);
      const place = placeById.get(life.placeId);
      const ride = life.headingToRide && life.rideId ? anyRide(life.rideId) : undefined;
      const status = life.queuing && ride
        ? `הולך לתור של ${ride.name}`
        : ride
          ? `הולך אל ${ride.name}`
          : life.phase === 'leave'
          ? 'הולך למקום הבא'
          : `הולך אל ${place?.name ?? 'המקום'}`;
      this.npcs.setStatus(life.id, status);
    }
    return null;
  }

  private stepAct(life: Life, dt: number, clock: GameClock, visible: boolean, playerX: number, playerZ: number): string | null {
    life.seconds += dt;
    const place = placeById.get(life.placeId);
    const event = this.currentEvent(life);
    let x = life.goalX;
    let z = life.goalZ;
    if (visible) {
      for (const body of this.bodies(life.id, true, playerX, playerZ)) {
        const ox = x - body.x;
        const oz = z - body.z;
        const gap = Math.hypot(ox, oz);
        if (gap < 1.15 && gap > 0.001) {
          x += (ox / gap) * (1.15 - gap);
          z += (oz / gap) * (1.15 - gap);
        }
      }
      life.x = x;
      life.z = z;
      this.npcs.holdAt(life.id, x, z, life.yaw);
      this.npcs.playClip(life.id, event?.emote ?? 'idle', event?.emote !== 'sit');
      this.npcs.setStatus(life.id, event?.line ?? 'נח');
    } else {
      life.x = x;
      life.z = z;
    }
    if (life.seconds < life.actFor) return null;
    return this.finishAct(life, clock, place);
  }

  private stepTalk(life: Life, dt: number, clock: GameClock, visible: boolean): string | null {
    life.seconds += dt;
    const partner = this.people.get(life.partnerId ?? '');
    if (visible && partner) {
      const yaw = Math.atan2(partner.x - life.x, partner.z - life.z);
      this.npcs.holdAt(life.id, life.x, life.z, yaw);
      this.npcs.playClip(life.id, 'talk', true);
      this.npcs.setStatus(life.id, `מדבר עם ${this.nameOf(partner.id)}`);
    }
    if (life.seconds < 4.2) return null;
    life.phase = 'act';
    life.partnerId = null;
    life.seconds = life.actFor;
    life.talkCooldown = 8 + Math.random() * 8;
    return this.finishAct(life, clock, placeById.get(life.placeId));
  }

  private maybeTalk(zone: ZoneId, clock: GameClock): string | null {
    const present = [...this.people.values()].filter((life) => life.zone === zone && life.phase === 'act' && life.talkCooldown <= 0);
    for (let i = 0; i < present.length; i++) {
      for (let j = i + 1; j < present.length; j++) {
        const a = present[i];
        const b = present[j];
        if (Math.hypot(a.x - b.x, a.z - b.z) > 1.7) continue;
        if (Math.random() > 0.35) continue;
        a.phase = 'talk';
        b.phase = 'talk';
        a.partnerId = b.id;
        b.partnerId = a.id;
        a.seconds = 0;
        b.seconds = 0;
        const text = `${this.nameOf(a.id)} ו${this.nameOf(b.id)} נעמדו לדבר`;
        for (const [person, other] of [
          [a, b],
          [b, a],
        ] as const) {
          applyAwards(person.strengths, { speech: 1, friendship: 1 });
          person.achievements.unshift({
            title: `שיחה עם ${this.nameOf(other.id)}`,
            detail: 'דיבור +1, חברות +1',
            timeLabel: clock.timeLabel,
          });
          if (person.achievements.length > 24) person.achievements.pop();
          this.memory.addDiary(person.id, clock.timeLabel, text);
        }
        return text;
      }
    }
    return null;
  }

  private arrive(life: Life, clock: GameClock): string | null {
    life.stuck = 0;
    life.progress = 999;
    if (life.phase === 'leave') {
      const next = life.route[life.index + 1];
      if (!next) {
        life.route = rollRoute(life.id, 12);
        life.index = -1;
        return this.arrive(life, clock);
      }
      const place = placeById.get(next.placeId) ?? PLACES[0];
      life.index += 1;
      life.zone = place.zone;
      life.placeId = place.id;
      life.x = EXIT[place.zone].x;
      life.z = EXIT[place.zone].z;
      life.phase = 'walk';
      this.aim(life, place, this.crowdIndex(place.id, life.id));
      if (this.npcs.actors.some((actor) => actor.id === life.id)) this.npcs.removeActor(life.id);
      return null;
    }
    const place = placeById.get(life.placeId);
    if (!place) return null;
    life.x = life.goalX;
    life.z = life.goalZ;
    this.beginAct(life);
    this.memory.addDiary(life.id, clock.timeLabel, `הגיע אל ${place.name}`);
    return null;
  }

  private beginAct(life: Life): void {
    if (life.zone === 'park' || life.zone === 'luna') {
      this.beginPark(life);
      return;
    }
    this.beginPlaceEvent(life);
  }

  private beginPlaceEvent(life: Life): void {
    this.leaveQueue(life.id);
    life.queuing = false;
    life.headingToRide = false;
    life.rideId = null;
    const place = placeById.get(life.placeId);
    const events = openEvents(place?.kind ?? 'street', life);
    const event = events[Math.floor(Math.random() * events.length)];
    life.eventId = event.id;
    life.phase = 'act';
    life.seconds = 0;
    life.actFor = event.seconds + Math.random() * 2;
    life.yaw = place?.yaw ?? 0;
  }

  private finishAct(life: Life, clock: GameClock, place: Place | undefined): string | null {
    const event = this.currentEvent(life);
    let note: string | null = null;
    if (event) {
      const choice = event.choices[Math.floor(Math.random() * event.choices.length)];
      applyAwards(life.strengths, choice.awards);
      if (choice.unlocks) life.unlocked.add(choice.unlocks);
      const detail = `${choice.text}. ${awardText(choice.awards)}`;
      life.achievements.unshift({ title: choice.label, detail, timeLabel: clock.timeLabel });
      if (life.achievements.length > 24) life.achievements.pop();
      this.memory.addDiary(life.id, clock.timeLabel, `${event.title}: ${detail}`);
      note = `${this.nameOf(life.id)} בחר: ${choice.label}. ${awardText(choice.awards)}`;
    }
    this.goNext(life, clock.hour);
    return note;
  }

  private beginPark(life: Life): void {
    if (life.queuing && life.rideId) {
      life.phase = 'queue';
      life.seconds = 0;
      life.headingToRide = false;
      const index = this.queueIndex(life.rideId, life.id);
      const spot = index >= 0 ? this.queueSpot(life.rideId, index) : null;
      if (spot) {
        life.x = spot.x;
        life.z = spot.z;
        life.yaw = spot.yaw;
      }
      return;
    }
    if (life.headingToRide && life.rideId && life.rideSlot >= 0) {
      const spot = anyApproach(life.rideId, life.rideSlot);
      const far = Math.hypot(life.x - spot.x, life.z - spot.z);
      if (far > 1.8 && life.rideTries < 2) {
        life.rideTries += 1;
        life.phase = 'walk';
        this.plan(life, spot.x, spot.z);
        return;
      }
      life.phase = 'ride';
      life.seconds = 0;
      life.eventId = null;
      life.headingToRide = false;
      life.queuing = false;
      return;
    }
    const pick = this.pickRide(life);
    if (!pick) {
      this.beginPlaceEvent(life);
      return;
    }
    if ('queue' in pick) {
      const index = this.joinQueue(pick.id, life.id);
      if (index < 0) {
        this.beginPlaceEvent(life);
        return;
      }
      life.queuing = true;
      life.lined = index;
      life.rideId = pick.id;
      life.rideSlot = -1;
      life.headingToRide = true;
      life.rideTries = 0;
      life.eventId = null;
      life.rideLine = '';
      life.phase = 'walk';
      const spot = this.queueSpot(pick.id, index);
      if (spot) this.plan(life, spot.x, spot.z);
      return;
    }
    life.queuing = false;
    life.rideId = pick.id;
    life.rideSlot = pick.slot;
    life.headingToRide = true;
    life.rideTries = 0;
    life.eventId = null;
    life.rideLine = '';
    life.phase = 'walk';
    const spot = anyApproach(pick.id, pick.slot);
    this.plan(life, spot.x, spot.z);
  }

  private pickRide(self: Life): { id: string; slot: number } | { id: string; queue: true } | null {
    const info = ridesHere(self.zone).map((ride) => {
      let busy = 0;
      const open: number[] = [];
      for (let slot = 0; slot < ride.slots; slot++) {
        if (this.slotTaken(ride.id, slot)) busy += 1;
        else open.push(slot);
      }
      return { ride, busy, open, line: this.lineFor(ride.id).length, lineCap: lunaLine(ride.id).length };
    });
    const sharedOpen = info.filter((item) => item.busy > 0 && item.open.length > 0);
    const emptyOpen = info.filter((item) => item.busy === 0 && item.open.length > 0);
    const canQueue = info.filter((item) => item.lineCap > 0 && item.line < item.lineCap && item.busy > 0 && item.open.length === 0);
    const seatOf = (item: (typeof info)[number]) => {
      const slot = item.open[Math.floor(Math.random() * item.open.length)];
      return { id: item.ride.id, slot };
    };
    if (sharedOpen.length && Math.random() < 0.75) return seatOf(sharedOpen[Math.floor(Math.random() * sharedOpen.length)]);
    if (canQueue.length && Math.random() < 0.55) {
      canQueue.sort((a, b) => b.busy - a.busy || a.line - b.line);
      return { id: canQueue[0].ride.id, queue: true };
    }
    if (emptyOpen.length) return seatOf(emptyOpen[Math.floor(Math.random() * emptyOpen.length)]);
    if (sharedOpen.length) return seatOf(sharedOpen[Math.floor(Math.random() * sharedOpen.length)]);
    if (canQueue.length) {
      canQueue.sort((a, b) => a.line - b.line || b.busy - a.busy);
      return { id: canQueue[0].ride.id, queue: true };
    }
    const anyLine = info.filter((item) => item.lineCap > 0 && item.line < item.lineCap);
    if (!anyLine.length) return null;
    anyLine.sort((a, b) => a.line - b.line);
    return { id: anyLine[0].ride.id, queue: true };
  }

  private stepQueue(life: Life, dt: number, clock: GameClock, visible: boolean): string | null {
    const ride = anyRide(life.rideId ?? '');
    if (!ride || !life.rideId) {
      life.queuing = false;
      life.phase = 'walk';
      return null;
    }
    const index = this.queueIndex(life.rideId, life.id);
    if (index < 0) {
      life.queuing = false;
      this.beginPark(life);
      return null;
    }
    const spot = this.queueSpot(life.rideId, index);
    if (!spot) return null;
    const dx = spot.x - life.x;
    const dz = spot.z - life.z;
    const dist = Math.hypot(dx, dz) || 0;
    if (dist > 0.18) {
      const step = Math.min(dist, 2.2 * dt);
      life.x += (dx / dist) * step;
      life.z += (dz / dist) * step;
      life.yaw = Math.atan2(dx, dz);
      if (visible) {
        this.npcs.holdAt(life.id, life.x, life.z, life.yaw);
        this.npcs.playClip(life.id, 'walk', true);
        this.npcs.setStatus(life.id, `מתקדם בתור ל${ride.name}`);
      }
      return null;
    }
    life.x = spot.x;
    life.z = spot.z;
    life.yaw = spot.yaw;
    if (visible) {
      this.npcs.holdAt(life.id, spot.x, spot.z, spot.yaw);
      this.npcs.playClip(life.id, 'idle', true);
      this.npcs.setStatus(life.id, `בתור ל${ride.name}, מקום ${index + 1}`);
    }
    if (index === 0) {
      const slot = this.freeSlot(ride.id);
      if (slot >= 0) this.boardFromQueue(life, slot);
    }
    void clock;
    return null;
  }

  private boardFromQueue(life: Life, slot: number): void {
    if (!life.rideId) return;
    this.leaveQueue(life.id);
    life.queuing = false;
    life.lined = -1;
    life.rideSlot = slot;
    life.headingToRide = true;
    life.rideTries = 0;
    life.phase = 'walk';
    const spot = anyApproach(life.rideId, slot);
    this.plan(life, spot.x, spot.z);
  }

  private stepRide(life: Life, dt: number, clock: GameClock, visible: boolean): string | null {
    const ride = anyRide(life.rideId ?? '');
    if (!ride) {
      life.phase = 'walk';
      return null;
    }
    life.seconds += dt;
    const pose = anySample(ride.id, life.rideSlot, life.seconds);
    life.rideLine = pose.line;
    life.x = pose.x;
    life.z = pose.z;
    life.yaw = pose.yaw;
    if (visible) {
      this.npcs.poseAt(life.id, pose);
      this.npcs.playClip(life.id, pose.emote, pose.loop);
      this.npcs.setStatus(life.id, pose.line);
    }
    if (life.seconds < ride.duration) return null;
    return this.finishRide(life, clock, ride);
  }

  private finishRide(life: Life, clock: GameClock, ride: { id: string; name: string; blurb: string; awards: Partial<StrengthMap>; slots: number }): string | null {
    applyAwards(life.strengths, ride.awards);
    const detail = `${ride.blurb}. ${awardText(ride.awards)}`;
    life.achievements.unshift({ title: ride.name, detail, timeLabel: clock.timeLabel });
    if (life.achievements.length > 24) life.achievements.pop();
    this.memory.addDiary(life.id, clock.timeLabel, `${ride.name}: ${detail}`);
    const spot = anyApproach(ride.id, life.rideSlot);
    life.x = spot.x;
    life.z = spot.z;
    if (this.npcs.actors.some((actor) => actor.id === life.id)) {
      this.npcs.moveBusy(life.id, spot.x, spot.z, life.yaw);
      this.npcs.playClip(life.id, 'idle', true);
    }
    const note = `${this.nameOf(life.id)} על ${ride.name}. ${awardText(ride.awards)}`;
    this.goNext(life, clock.hour);
    return note;
  }

  private goNext(life: Life, hour: number): void {
    this.leaveQueue(life.id);
    life.headingToRide = false;
    life.queuing = false;
    life.lined = -1;
    life.trail = [];
    life.rideId = null;
    life.rideLine = '';
    life.rideTries = 0;
    if (life.index + 1 >= life.route.length) {
      life.route = rollRoute(life.id, hour);
      life.index = -1;
    }
    const next = life.route[life.index + 1];
    if (!next) return;
    if (next.zone !== life.zone) {
      life.phase = 'leave';
      life.seconds = 0;
      this.plan(life, EXIT[life.zone].x, EXIT[life.zone].z);
      return;
    }
    life.index += 1;
    const place = placeById.get(next.placeId) ?? PLACES[0];
    life.zone = place.zone;
    life.placeId = place.id;
    life.phase = 'walk';
    life.seconds = 0;
    this.aim(life, place, this.crowdIndex(place.id, life.id));
  }

  private aim(life: Life, place: Place, slot: number): void {
    const spread = place.zone === 'luna' ? 0.45 : 0.9;
    const angle = slot * 1.9;
    life.placeId = place.id;
    life.zone = place.zone;
    this.plan(life, place.x + Math.cos(angle) * spread, place.z + Math.sin(angle) * spread);
  }

  private plan(life: Life, x: number, z: number): void {
    life.goalX = x;
    life.goalZ = z;
    life.trail = [];
    life.viaX = null;
    life.viaZ = null;
    life.stuck = 0;
    life.hops = 0;
    life.progress = 999;
    if (life.zone !== 'luna') return;
    const points = lunaRoute(life.x, life.z, x, z);
    const first = points.shift();
    if (!first) return;
    life.viaX = first.x;
    life.viaZ = first.z;
    life.trail = points;
  }

  private crowdIndex(placeId: string, id: string): number {
    let slot = 0;
    for (const life of this.people.values()) {
      if (life.id === id) return slot;
      if (life.placeId === placeId) slot += 1;
    }
    return slot;
  }

  private currentEvent(life: Life): LifeEvent | null {
    if (!life.eventId) return null;
    for (const list of Object.values(EVENTS)) {
      const found = list.find((event) => event.id === life.eventId);
      if (found) return found;
    }
    return null;
  }

  private bodies(except: string, visible: boolean, playerX: number, playerZ: number): Array<{ x: number; z: number }> {
    const bodies: Array<{ x: number; z: number }> = [];
    if (visible && playerX < 900) bodies.push({ x: playerX, z: playerZ });
    const zone = this.people.get(except)?.zone;
    if (visible) {
      for (const actor of this.npcs.actors) {
        if (actor.id === except) continue;
        bodies.push({ x: actor.mesh.position.x, z: actor.mesh.position.z });
      }
      return bodies;
    }
    for (const life of this.people.values()) {
      if (life.id === except || life.zone !== zone) continue;
      bodies.push({ x: life.x, z: life.z });
    }
    return bodies;
  }

  private nameOf(id: string | null): string {
    if (!id) return 'מישהו';
    return this.npcs.actors.find((actor) => actor.id === id)?.profile.name ?? id;
  }
}
