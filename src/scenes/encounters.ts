import type { StrengthMap, ZoneId } from '../core/types';
import type { Beat, FollowUp, SceneScript } from './catalog';

/** A choice image: pose, object, floor, and who stands beside the player. */
export interface EncounterShot {
  mood: string;
  prop?: string;
  ground: 'home' | 'grass' | 'street' | 'class';
  friend?: string;
}

export interface Encounter extends SceneScript {
  zone: ZoneId;
  spot: { x: number; z: number };
  /** What the player reads when they walk up to the spot. */
  label: string;
}

type Cast = Array<[string, number, number]>;
type Line = [string, string?, string[]?, [number, number]?, Cast?];

interface Way {
  id: string;
  label: string;
  mood: string;
  prop?: string;
  friend?: string;
  awards: Partial<StrengthMap>;
  lines: Line[];
}

const SHOTS = new Map<string, EncounterShot>();

function beat(line: Line, cast: Cast): Beat {
  const [say, emote, props, at, ownCast] = line;
  return { t: 2.6, say, emote: emote ?? 'talk', props, at, cast: ownCast ?? cast };
}

function scene(def: {
  id: string;
  zone: ZoneId;
  x: number;
  z: number;
  label: string;
  title: string;
  intro: string;
  ground: EncounterShot['ground'];
  prop: string;
  friend?: string;
  cast: Cast;
  open: Line[];
  ways: [Way, Way, Way];
}): Encounter {
  SHOTS.set(def.id, { mood: 'talk', prop: def.prop, ground: def.ground, friend: def.friend });
  const follows: FollowUp[] = def.ways.map((way) => {
    SHOTS.set(`${def.id}/${way.id}`, {
      mood: way.mood,
      prop: way.prop ?? def.prop,
      ground: def.ground,
      friend: way.friend,
    });
    return { id: way.id, label: way.label, awards: way.awards, beats: way.lines.map((line) => beat(line, def.cast)) };
  });
  return {
    id: def.id,
    zone: def.zone,
    spot: { x: def.x, z: def.z },
    label: def.label,
    title: def.title,
    intro: def.intro,
    beats: def.open.map((line) => beat(line, def.cast)),
    follows,
  };
}

const ENCOUNTERS: Encounter[] = [
  scene({
    id: 'enc-ball',
    zone: 'park',
    x: -4,
    z: -8,
    label: 'לגשת לוויכוח על הכדור',
    title: 'ויכוח על הכדור',
    intro: 'המשחק נעצר. שני ידיים על כדור אחד.',
    ground: 'grass',
    prop: 'ball',
    friend: 'dani',
    cast: [
      ['dani', 1.15, 1.15],
      ['noam', -1.15, 1.2],
    ],
    open: [
      ['דני מושך את הכדור. «אני הבאתי אותו.»', 'talk', ['ball']],
      ['נועם לא עוזב. «שיחקנו בו יחד כל ההפסקה.»', 'talk', ['ball']],
      ['הכדור נעצר בין שניהם. אף אחד לא בועט.', 'talk', ['ball'], [0, 0.3]],
      ['שניהם מסתכלים עליכם. הוויכוח מחכה למילה.', 'talk', ['ball']],
    ],
    ways: [
      {
        id: 'blame',
        label: 'לצעוק שדני צודק',
        mood: 'shout',
        friend: 'dani',
        awards: { courage: 1, friendship: -1 },
        lines: [
          ['«הכדור של דני!» הקול עולה מעל הדשא.', 'stomp', ['ball']],
          ['נועם עוזב את הידיים. הפנים שלו נסגרות.', 'sad', ['ball'], [-0.4, 0.2]],
          ['דני לוקח את הכדור, אבל אין עם מי לשחק.', 'talk', ['ball'], [0.6, 0.4]],
          ['הדשא שקט. הניצחון לא מרגיש כמו משחק.', 'sad', ['ball']],
        ],
      },
      {
        id: 'leave',
        label: 'ללכת מהוויכוח',
        mood: 'leave',
        prop: 'ball',
        awards: { restraint: 1 },
        lines: [
          ['אתם פונים מהכדור והולכים אל השביל.', 'walk', ['ball'], [0, -1.2]],
          ['מאחוריכם הם עדיין מושכים. לא נאמר חוק.', 'walk', ['ball'], [0.4, -1.6]],
          ['אתם עוצרים ליד עץ. הוויכוח נשאר שם.', 'talk', ['ball']],
          ['אחר כך מישהו יצטרך לחזור ולפתור את זה.', 'talk', ['ball']],
        ],
      },
      {
        id: 'turns',
        label: 'להציע תורות',
        mood: 'talk',
        friend: 'noam',
        awards: { speech: 2, friendship: 2, flexibility: 1 },
        lines: [
          ['«שתי מסירות לדני, אחר כך שתיים לנועם.»', 'talk', ['ball', 'cones']],
          ['דני מוסר. הוא סופר בקול: אחת, שתיים.', 'play', ['ball', 'cones']],
          ['נועם מחזיר בלי למשוך. הכדור עגול שוב.', 'play', ['ball']],
          ['הם צוחקים על מסירה עקומה. המשחק חזר.', 'play', ['ball', 'cones']],
        ],
      },
    ],
  }),
  scene({
    id: 'enc-swing',
    zone: 'park',
    x: 6,
    z: 10,
    label: 'לגשת לתור של הנדנדה',
    title: 'מי ראשון בנדנדה',
    intro: 'הנדנדה תפוסה, ומישהו אומר שהוא חיכה קודם.',
    ground: 'grass',
    prop: 'rope',
    friend: 'maya',
    cast: [
      ['maya', 1.1, 1.2],
      ['noam', -1.2, 1.15],
    ],
    open: [
      ['מאיה יושבת על הנדנדה ולא קמה.', 'sit', ['rope']],
      ['נועם עומד מולה. «אמרת עוד דקה, וזה כבר הרבה.»', 'talk', ['rope']],
      ['החבל זז לאט. אף אחד לא סופר.', 'talk', ['rope'], [0, 0.2]],
      ['מאיה מביטה אליכם. אפשר לצעוק, לחכות, או לקבוע כלל.', 'talk', ['rope']],
    ],
    ways: [
      {
        id: 'shout',
        label: 'לצעוק שתקום',
        mood: 'shout',
        friend: 'maya',
        awards: { courage: 1, friendship: -1 },
        lines: [
          ['«קומי כבר!» מאיה נבהלת ועוצרת את החבל.', 'stomp', ['rope']],
          ['היא קמה, אבל לא נותנת לנועם לשבת.', 'sad', ['rope']],
          ['נועם אומר שצעקה לא הופכת מישהו לראשון.', 'talk', ['rope']],
          ['הנדנדה ריקה. שניהם עומדים בצד.', 'sad', ['rope']],
        ],
      },
      {
        id: 'wait',
        label: 'לחכות בשקט בתור',
        mood: 'wait',
        friend: 'noam',
        awards: { restraint: 2, friendship: 1 },
        lines: [
          ['אתם עומדים מאחורי נועם בלי לדחוף.', 'talk', ['rope'], [-0.3, -0.2]],
          ['«עוד עשר נדנודים.» מאיה סופרת בקול.', 'sit', ['rope']],
          ['בעשר היא קמה. נועם מתיישב.', 'play', ['rope']],
          ['התור שלכם אחריו. אף אחד לא רב.', 'talk', ['rope']],
        ],
      },
      {
        id: 'count',
        label: 'לספור עשר ביחד',
        mood: 'talk',
        prop: 'rope',
        friend: 'maya',
        awards: { speech: 2, flexibility: 1, friendship: 1 },
        lines: [
          ['«בוא נספור עשר, ואז מתחלפים.» שניהם מהנהנים.', 'talk', ['rope']],
          ['אחת עד עשר, לאט, עם כל נדנוד.', 'play', ['rope']],
          ['מאיה יורדת ומחזיקה את החבל לנועם.', 'talk', ['rope']],
          ['הכלל נשאר גם לסיבוב הבא.', 'play', ['rope']],
        ],
      },
    ],
  }),
  scene({
    id: 'enc-toy',
    zone: 'park',
    x: -2,
    z: 8,
    label: 'לגשת לצעצוע שנשכח',
    title: 'צעצוע על הדשא',
    intro: 'קובייה אדומה שוכבת לבד ליד השביל.',
    ground: 'grass',
    prop: 'blocks',
    friend: 'dani',
    cast: [['dani', 1.2, 1.1]],
    open: [
      ['אתם מרים את הקובייה. היא לא שלכם.', 'clean', ['blocks']],
      ['דני רץ חזרה. «ראיתם קובייה אדומה?»', 'run', ['blocks'], [0.4, 0.6]],
      ['הוא כבר מושיט יד, ואז עוצר. אולי היא של מישהו אחר.', 'talk', ['blocks']],
      ['הקובייה אצלכם. צריך להחליט לאן היא הולכת.', 'talk', ['blocks']],
    ],
    ways: [
      {
        id: 'keep',
        label: 'להשאיר אותה בכיס',
        mood: 'hide',
        prop: 'blocks',
        awards: { courage: 1, friendship: -1 },
        lines: [
          ['אתם סוגרים את היד. «לא ראיתי.»', 'hide', ['blocks']],
          ['דני מסתכל על הדשא הריק וממשיך לחפש.', 'sad', ['blocks'], [1, 1.2]],
          ['הקובייה בכיס. היא לא מרגישה כמו שלכם.', 'hide', ['blocks']],
          ['בדרך הביתה אתם עדיין חושבים עליו.', 'walk', ['blocks'], [0, -0.6]],
        ],
      },
      {
        id: 'bench',
        label: 'לשים על הספסל ולחכות',
        mood: 'wait',
        prop: 'blocks',
        awards: { responsibility: 2, restraint: 1 },
        lines: [
          ['אתם שמים את הקובייה על הספסל, לא בכיס.', 'talk', ['blocks'], [-0.4, 0.4]],
          ['דני נשאר לידה. אתם נשארים גם.', 'wait', ['blocks']],
          ['ילדה באה, רואה, ואומרת «שלי».', 'talk', ['blocks']],
          ['היא מודה. הספסל שוב ריק.', 'play', ['blocks']],
        ],
      },
      {
        id: 'ask',
        label: 'לשאול את דני אם זו שלו',
        mood: 'talk',
        friend: 'dani',
        awards: { speech: 2, friendship: 2 },
        lines: [
          ['«איזו קובייה חיפשת?» דני אומר: אדומה, עם שריטה.', 'talk', ['blocks']],
          ['אתם פותחים את היד. השריטה שם.', 'talk', ['blocks']],
          ['הוא מחייך ומודה, לא חוטף.', 'play', ['blocks']],
          ['«בפעם הבאה אשים אותה בתיק.» שניכם הולכים.', 'talk', ['blocks']],
        ],
      },
    ],
  }),
  scene({
    id: 'enc-sorry',
    zone: 'park',
    x: 10,
    z: 6,
    label: 'לגשת למילים מאתמול',
    title: 'מילים מאתמול',
    intro: 'מאיה עומדת עם הגב. אתמול נאמר משפט שכואב.',
    ground: 'grass',
    prop: 'ball',
    friend: 'maya',
    cast: [
      ['maya', 1.05, 1.25],
      ['noam', -1.3, 1.1],
    ],
    open: [
      ['מאיה לא באה אל הכדור. היא עומדת ליד העץ.', 'sad', ['ball']],
      ['נועם לוחש: «אתמול צחקו עליה שהיא איטית.»', 'talk', ['ball']],
      ['הכדור מונח באמצע, ואף אחד לא זורק לה.', 'talk', ['ball']],
      ['אפשר להעמיד פנים שזה נגמר, או לפתוח את זה.', 'talk', ['ball']],
    ],
    ways: [
      {
        id: 'ignore',
        label: 'להתעלם ולהתחיל משחק',
        mood: 'play',
        friend: 'noam',
        awards: { courage: 1, friendship: -1 },
        lines: [
          ['אתם בועטים את הכדור לנועם. מאיה לא במשחק.', 'play', ['ball']],
          ['היא שומעת את הצחוק ומתרחקת עוד צעד.', 'sad', ['ball'], [1.2, 0.2]],
          ['המשחק רץ. החסר בה נשאר.', 'play', ['ball']],
          ['בסוף נועם שואל «איפה מאיה?» מאוחר.', 'talk', ['ball']],
        ],
      },
      {
        id: 'alone',
        label: 'ללכת אליה בלי קהל',
        mood: 'whisper',
        friend: 'maya',
        awards: { friendship: 2, speech: 1, restraint: 1 },
        lines: [
          ['אתם משאירים את הכדור והולכים עד העץ.', 'walk', ['ball'], [1.1, 0.5]],
          ['«אתמול זה היה מטופש. סליחה.» בקול נמוך.', 'talk', ['ball']],
          ['מאיה מהנהנת. היא לא חייבת לחזור ישר.', 'talk', ['ball']],
          ['אחר כך היא כן באה, ובוחרת את המקום שלה.', 'play', ['ball']],
        ],
      },
      {
        id: 'rule',
        label: 'לקבוע שלא צוחקים על ריצה',
        mood: 'talk',
        friend: 'noam',
        awards: { speech: 2, friendship: 2, responsibility: 1 },
        lines: [
          ['אתם קוראים לנועם ולמאיה לאותו מקום.', 'talk', ['ball', 'cones']],
          ['«במשחק הזה לא צוחקים על מי שמגיע אחרון.»', 'talk', ['cones']],
          ['נועם אומר את המשפט גם הוא, בקול.', 'talk', ['ball']],
          ['מאיה נכנסת. המסירה הראשונה אליה איטית.', 'play', ['ball']],
        ],
      },
    ],
  }),
  scene({
    id: 'enc-pencil',
    zone: 'school',
    x: 16,
    z: 9,
    label: 'לגשת לעיפרון שנלקח',
    title: 'העיפרון של שירה',
    intro: 'על הדשא שירה מחפשת עיפרון, וליאור מצייר בו.',
    ground: 'class',
    prop: 'book',
    friend: 'shira',
    cast: [
      ['shira', 1.15, 1.15],
      ['lior', -1.15, 1.2],
    ],
    open: [
      ['שירה פותחת קלמר ריק. «הצהוב שלי היה כאן.»', 'talk', ['book']],
      ['ליאור מחדד עיפרון צהוב ולא מרים עיניים.', 'play', ['book']],
      ['השירטוט על הדף יפה. העיפרון לא שלו.', 'talk', ['book', 'page']],
      ['שירה פונה אליכם. היד שלה רועדת קצת.', 'sad', ['book']],
    ],
    ways: [
      {
        id: 'grab',
        label: 'לחטוף את העיפרון',
        mood: 'shout',
        friend: 'lior',
        awards: { courage: 1, friendship: -1 },
        lines: [
          ['אתם מושכים את העיפרון מהיד של ליאור.', 'stomp', ['book']],
          ['החוד נשבר. שירה מקבלת חצי.', 'sad', ['book']],
          ['ליאור קם כועס. «יכולתם לבקש.»', 'talk', ['book']],
          ['הציור נעצר באמצע קו.', 'sad', ['page']],
        ],
      },
      {
        id: 'quiet',
        label: 'להגיד לשירה שתוותר',
        mood: 'whisper',
        friend: 'shira',
        awards: { restraint: 1, friendship: -1 },
        lines: [
          ['«עזבי, זה רק עיפרון.» שירה שותקת.', 'talk', ['book']],
          ['ליאור ממשיך לצייר כאילו לא שמע.', 'play', ['page']],
          ['שירה הולכת בלי קלמר סגור.', 'walk', ['book'], [0.8, -0.4]],
          ['ההפסקה ממשיכה, והחסר נשאר אצלה.', 'sad', ['book']],
        ],
      },
      {
        id: 'return',
        label: 'לבקש שיחזיר ויחדד',
        mood: 'talk',
        friend: 'lior',
        awards: { speech: 2, responsibility: 1, friendship: 2 },
        lines: [
          ['«זה הצהוב של שירה. מחזירים, ואז שואלים.»', 'talk', ['book']],
          ['ליאור עוצר. הוא מגיש לה את העיפרון.', 'talk', ['book']],
          ['החוד שבור. הוא מחדד אותו עד הסוף.', 'play', ['book']],
          ['שירה מודה. ליאור מבקש דף אחר, לא את שלה.', 'play', ['page', 'book']],
        ],
      },
    ],
  }),
  scene({
    id: 'enc-team',
    zone: 'school',
    x: 8,
    z: 10,
    label: 'לגשת לבחירת הקבוצות',
    title: 'נשארים אחרונים',
    intro: 'שני קפטנים בוחרים. רות ואיתן עדיין בחוץ.',
    ground: 'grass',
    prop: 'cones',
    friend: 'rut',
    cast: [
      ['rut', 1.2, 1.15],
      ['eitan', -1.2, 1.2],
      ['lior', 0.2, 2],
    ],
    open: [
      ['ליאור מצביע על החזקים קודם. המעגל קטן.', 'talk', ['cones']],
      ['רות משפשפת את המרפק. איתן מסתכל על הנעליים.', 'sad', ['cones']],
      ['«נשארו שניים.» מישהו צוחק צחוק קטן.', 'talk', ['cones']],
      ['הקונוסים מחכים. הבחירה הבאה יכולה לתקן או להעמיק.', 'talk', ['cones']],
    ],
    ways: [
      {
        id: 'laugh',
        label: 'לצחוק עם הקפטנים',
        mood: 'shout',
        friend: 'lior',
        awards: { courage: 1, friendship: -2 },
        lines: [
          ['אתם צוחקים גם. רות שומעת את השם שלה.', 'stomp', ['cones']],
          ['איתן יוצא מהמעגל בלי שנבחרו.', 'walk', ['cones'], [-1, -0.4]],
          ['המשחק מתחיל בלי שניהם.', 'play', ['cones']],
          ['אחר כך קשה לקרוא להם בחזרה.', 'sad', ['cones']],
        ],
      },
      {
        id: 'pick',
        label: 'לבחור אותם ראשונים',
        mood: 'talk',
        friend: 'rut',
        awards: { friendship: 2, courage: 2, speech: 1 },
        lines: [
          ['«אני הקפטן השני. רות אצלי, איתן אצלי.»', 'talk', ['cones']],
          ['ליאור מופתע. הוא בוחר מתוך מי שנשאר.', 'talk', ['cones']],
          ['רות מקבלת את הקונוס הכתום ועומדת בשער.', 'play', ['cones']],
          ['איתן רץ. אף אחד לא אומר שהוא אחרון.', 'run', ['cones'], [-0.4, 0.8]],
        ],
      },
      {
        id: 'mix',
        label: 'לערבב בלי בחירה',
        mood: 'play',
        prop: 'cones',
        friend: 'eitan',
        awards: { flexibility: 2, friendship: 2 },
        lines: [
          ['«שמים את הקונוסים. מי שנוגע בכתום בקבוצה אחת.»', 'talk', ['cones']],
          ['רות נוגעת בכתום. איתן גם. הם יחד, בלי הצבעה.', 'play', ['cones']],
          ['ליאור נוגע בכחול וצוחק, הפעם בלי עוקץ.', 'play', ['cones']],
          ['המשחק מתחיל מקו, לא מרשימה.', 'run', ['cones']],
        ],
      },
    ],
  }),
  scene({
    id: 'enc-new',
    zone: 'school',
    x: 17,
    z: 3,
    label: 'לגשת לילד החדש',
    title: 'ילדה חדשה בשוליים',
    intro: 'הילה עומדת ליד הגדר עם תיק סגור. אף אחד לא קרא לה.',
    ground: 'grass',
    prop: 'book',
    friend: 'hila',
    cast: [
      ['hila', 1.25, 1.1],
      ['shira', -1.3, 1.3],
    ],
    open: [
      ['הילה מחזיקה את הרצועה של התיק בשתי ידיים.', 'sad', ['book']],
      ['שירה משחקת עם אחרות ולא רואה את הגדר.', 'play', ['ball'], [-1, 1.6]],
      ['המורה דוד עובר ומהנהן, אבל לא עוצר.', 'walk', ['book'], [0, 1.8], [['teacher_david', 0.2, 2.1]]],
      ['הילה מביטה אליכם לרגע ומיד אל הנעליים.', 'sad', ['book']],
    ],
    ways: [
      {
        id: 'pass',
        label: 'לעבור לידה בלי לעצור',
        mood: 'leave',
        awards: { restraint: 1, friendship: -1 },
        lines: [
          ['אתם ממשיכים אל הכדור. התיק נשאר סגור.', 'walk', ['ball'], [-0.6, 0.8]],
          ['הילה זזה עוד קצת אל הגדר.', 'sad', ['book'], [1.3, 0.4]],
          ['שירה שואלת מי זו. אף אחד לא יודע את השם.', 'talk', ['ball']],
          ['ההפסקה נגמרת והילה עדיין בשוליים.', 'walk', ['book']],
        ],
      },
      {
        id: 'wave',
        label: 'לנופף ולומר את השם',
        mood: 'talk',
        friend: 'hila',
        awards: { speech: 2, friendship: 2, courage: 1 },
        lines: [
          ['«הילה? אני כאן. רוצה לעמוד איתנו?»', 'talk', ['book'], [0.6, 0.4]],
          ['היא מהססת, ואז עוזבת את הרצועה ביד אחת.', 'talk', ['book']],
          ['שירה באה. «יש מקום ליד הקונוס.»', 'talk', ['cones', 'book']],
          ['הילה עומדת במעגל, התיק על הדשא לידה.', 'play', ['book', 'cones']],
        ],
      },
      {
        id: 'job',
        label: 'לתת לה תפקיד ברור',
        mood: 'talk',
        prop: 'cones',
        friend: 'hila',
        awards: { responsibility: 1, friendship: 2, flexibility: 1 },
        lines: [
          ['«צריך שופטת לקו. את אומרת מתי יצאו.»', 'talk', ['cones']],
          ['הילה מקבלת את הקונוס. יש לה מה להחזיק.', 'play', ['cones']],
          ['שירה מחכה ל«שלוש» שלה, לא רצה קודם.', 'talk', ['cones']],
          ['אחרי הסיבוב הילה נשארת, בלי תיק על הכתף.', 'play', ['cones', 'book']],
        ],
      },
    ],
  }),
  scene({
    id: 'enc-crayon',
    zone: 'school',
    x: 6,
    z: 4,
    label: 'לגשת לצבע שנשבר',
    title: 'הצבע נשבר',
    intro: 'אביב לחץ חזק. הצבע האדום נשבר לשניים על הדף.',
    ground: 'class',
    prop: 'blocks',
    friend: 'aviv',
    cast: [
      ['aviv', 1.1, 1.15],
      ['teacher', -0.2, 1.7],
    ],
    open: [
      ['שני חצאים אדומים על הדף. אביב לא זז.', 'sad', ['page', 'blocks']],
      ['«זה היה של הכיתה.» המורה עוד לא ראתה.', 'talk', ['page']],
      ['אביב אוסף חצי אחד ומסתיר ביד.', 'hide', ['blocks']],
      ['החצי השני על הדף. אפשר להאשים, לבכות, או לתקן.', 'talk', ['page', 'blocks']],
    ],
    ways: [
      {
        id: 'blame',
        label: 'להאשים בקול',
        mood: 'shout',
        friend: 'aviv',
        awards: { speech: 1, friendship: -1 },
        lines: [
          ['«אביב שבר!» כמה ראשים מסתובבים.', 'stomp', ['blocks']],
          ['הוא שומט את החצי. העיניים למטה.', 'sad', ['blocks']],
          ['המורה באה בגלל הצעקה, לא בגלל הצבע.', 'talk', ['page']],
          ['הדף נשאר עם קו שבור באמצע.', 'sad', ['page']],
        ],
      },
      {
        id: 'cry',
        label: 'לשבת ולכעוס בשקט',
        mood: 'cry',
        prop: 'page',
        awards: { restraint: 1 },
        lines: [
          ['אתם יושבים ליד הדף ולא מדברים.', 'sit', ['page', 'blocks']],
          ['אביב יושב גם, רחוק חצי מטר.', 'sit', ['blocks'], [0.8, 0.2]],
          ['ההפסקה ממשיכה בלי שניכם.', 'sad', ['page']],
          ['הצבע לא מתקן את עצמו. גם הכעס לא.', 'sad', ['blocks']],
        ],
      },
      {
        id: 'tape',
        label: 'להדביק ולהמשיך יחד',
        mood: 'talk',
        friend: 'teacher',
        awards: { responsibility: 2, friendship: 1, creativity: 1 },
        lines: [
          ['«נביא נייר דבק. שני החצאים עדיין צובעים.»', 'talk', ['blocks', 'page']],
          ['המורה נותנת רצועה קצרה. אביב מחזיק את החצי.', 'talk', ['blocks']],
          ['אתם מצמידים. הצבע עבה, אבל עובד.', 'play', ['blocks', 'page']],
          ['אביב מצייר שמש. אתם מוסיפים קו, לא לוקחים לו את הדף.', 'play', ['page']],
        ],
      },
    ],
  }),
  scene({
    id: 'enc-remote',
    zone: 'home',
    x: 4.8,
    z: 4.2,
    label: 'לגשת לוויכוח על השלט',
    title: 'השלט בסלון',
    intro: 'האח מחזיק את השלט. אבא ביקש שקט של עשר דקות.',
    ground: 'home',
    prop: 'handset',
    friend: 'brother',
    cast: [
      ['brother', 1.15, 1.15],
      ['dad', -1.2, 1.35],
    ],
    open: [
      ['האח מעלה את הקול. הצבעים קופצים על המסך.', 'play', ['handset']],
      ['אבא עומד בפתח. «עוד רגע אני בשיחה.»', 'talk', ['handset']],
      ['האח לוחש «עוד פרק» ולא נותן את השלט.', 'talk', ['handset']],
      ['השלט בין שניכם. עשר הדקות כבר התחילו.', 'talk', ['handset']],
    ],
    ways: [
      {
        id: 'yell',
        label: 'לצעוק שזה התור שלי',
        mood: 'shout',
        friend: 'brother',
        awards: { courage: 1, friendship: -1 },
        lines: [
          ['«תן!» האח מצמיד את השלט לחזה.', 'stomp', ['handset']],
          ['אבא סוגר את הדלת של החדר. השיחה נקטעת.', 'sad', ['handset']],
          ['אף אחד לא צופה. השלט על השטיח.', 'sad', ['handset'], [0, 0.4]],
          ['הסלון רועש יותר מכפי שהיה.', 'talk', ['handset']],
        ],
      },
      {
        id: 'grab',
        label: 'לקחת וללכת לחדר',
        mood: 'leave',
        prop: 'handset',
        awards: { courage: 1, responsibility: -1 },
        lines: [
          ['אתם לוקחים את השלט באמצע הפרק ויוצאים.', 'walk', ['handset'], [0, -1]],
          ['האח נשאר מול מסך שעצר.', 'sad', ['handset']],
          ['בחדר אין מה לעשות עם שלט בלי מסך.', 'sit', ['handset']],
          ['אבא יצטרך לבקש אותו אחר כך. הפעם בכעס.', 'talk', ['handset']],
        ],
      },
      {
        id: 'timer',
        label: 'לשים עשר דקות בשעון',
        mood: 'talk',
        friend: 'dad',
        awards: { responsibility: 2, restraint: 1, friendship: 1 },
        lines: [
          ['«מסיימים את הסצנה, ואז שקט עד הצלצול.»', 'talk', ['handset']],
          ['האח מהנהן. אבא משאיר את הדלת פתוחה קצת.', 'talk', ['handset']],
          ['הסצנה נגמרת. השלט יורד על השולחן, לא נזרק.', 'talk', ['handset']],
          ['בעשר הדקות אתם בונים משהו על השטיח. בלי מסך.', 'play', ['blocks']],
        ],
      },
    ],
  }),
  scene({
    id: 'enc-snack',
    zone: 'home',
    x: 10.4,
    z: -4.2,
    label: 'לגשת לעוגייה האחרונה',
    title: 'העוגייה האחרונה',
    intro: 'בצלחת נשארה עוגייה אחת. שניכם רעבים.',
    ground: 'home',
    prop: 'plate',
    friend: 'brother',
    cast: [
      ['brother', 1.1, 1.15],
      ['mom', -1.15, 1.35],
    ],
    open: [
      ['האח כבר נוגע בצלחת. העוגייה זזה.', 'talk', ['plate']],
      ['אמא מערבבת סיר ולא רואה את היד.', 'cook', ['pot'], [-0.8, 0.6]],
      ['«אני ראיתי אותה קודם.» שניכם אומרים את זה יחד.', 'talk', ['plate']],
      ['העוגייה באמצע. אפשר לריב עליה או לחתוך.', 'talk', ['plate']],
    ],
    ways: [
      {
        id: 'snatch',
        label: 'לקחת לפניו',
        mood: 'shout',
        friend: 'brother',
        awards: { courage: 1, friendship: -1 },
        lines: [
          ['היד שלכם מקדימה. העוגייה נעלמת שלמה.', 'stomp', ['plate']],
          ['האח דופק על השולחן. הפירורים קופצים.', 'sad', ['plate']],
          ['אמא מסתובבת לקול, לא לריח.', 'talk', ['pot', 'plate']],
          ['הבטן מלאה. המטבח לא.', 'sad', ['plate']],
        ],
      },
      {
        id: 'sulk',
        label: 'לשבת בלי לאכול',
        mood: 'cry',
        prop: 'plate',
        awards: { restraint: 1 },
        lines: [
          ['אתם יושבים ודוחפים את הצלחת.', 'sit', ['plate']],
          ['האח לוקח את העוגייה ולא נהנה ממנה.', 'eat', ['plate']],
          ['אמא שואלת מה קרה. אף אחד לא עונה.', 'talk', ['plate']],
          ['הרעב נשאר, וגם השתיקה.', 'sad', ['plate']],
        ],
      },
      {
        id: 'split',
        label: 'לחתוך לחצי',
        mood: 'talk',
        friend: 'mom',
        awards: { flexibility: 2, friendship: 2, restraint: 1 },
        lines: [
          ['«חותכים באמצע. אתם בוחרים חצי ראשון.»', 'talk', ['plate']],
          ['אמא נותנת סכין ומחזיקה את הצלחת.', 'cook', ['plate']],
          ['שני חצאים. אף אחד לא גדול יותר בעין.', 'eat', ['plate']],
          ['הפירורים נאספים, לא נזרקים.', 'clean', ['plate', 'cloth']],
        ],
      },
    ],
  }),
  scene({
    id: 'enc-bed',
    zone: 'home',
    x: -6.5,
    z: -4.2,
    label: 'לגשת לסיפור שלפני השינה',
    title: 'עוד לא לישון',
    intro: 'האור במסדרון כבר חלש. אבא עומד עם ספר, ואתם יושבים על קצה המיטה.',
    ground: 'home',
    prop: 'pillow',
    friend: 'dad',
    cast: [
      ['dad', 1.15, 1.2],
      ['mom', -1.25, 1.4],
    ],
    open: [
      ['«עוד פרק.» אתם אומרים את זה מהכרית.', 'sit', ['pillow', 'book']],
      ['אבא פותח את הספר באמצע, לא בהתחלה.', 'talk', ['book']],
      ['אמא קוראת מהמטבח שהמחר מתחיל מוקדם.', 'talk', ['book'], [-0.6, 0.2]],
      ['הספר פתוח. השינה והסיפור רבים על אותה דקה.', 'talk', ['book', 'pillow']],
    ],
    ways: [
      {
        id: 'argue',
        label: 'להתווכח על עוד פרק',
        mood: 'shout',
        friend: 'dad',
        awards: { speech: 1, restraint: -1 },
        lines: [
          ['«כולם ערים חוץ ממני.» הקול עולה.', 'stomp', ['book']],
          ['אבא סוגר את הספר. הסימנייה נופלת.', 'sad', ['book']],
          ['אמא מכבה אור בלי סיפור.', 'talk', ['pillow']],
          ['המיטה מוכנה, והערב נגמר בכעס.', 'sit', ['pillow']],
        ],
      },
      {
        id: 'hide',
        label: 'להסתתר מתחת לשמיכה',
        mood: 'hide',
        prop: 'pillow',
        awards: { restraint: 1, courage: -1 },
        lines: [
          ['אתם נכנסים מתחת לשמיכה עם הנעליים.', 'hide', ['pillow']],
          ['אבא מחכה. הספר נשאר פתוח על הברך שלו.', 'talk', ['book']],
          ['אף אחד לא קורא. גם לא יוצאים.', 'hide', ['pillow']],
          ['בסוף האור כבה על שמיכה שעוד זזה.', 'sad', ['pillow']],
        ],
      },
      {
        id: 'page',
        label: 'לבקש עמוד אחד ולכבות',
        mood: 'read',
        friend: 'dad',
        awards: { restraint: 2, speech: 1, responsibility: 1 },
        lines: [
          ['«עמוד אחד. אחר כך האור כבה.»', 'talk', ['book', 'pillow']],
          ['אבא קורא לאט. אתם לא קוטעים באמצע משפט.', 'talk', ['book']],
          ['העמוד נגמר. הסימנייה נכנסת למקום.', 'talk', ['book']],
          ['האור כבה. אמא אומרת לילה טוב מהפתח.', 'sit', ['pillow']],
        ],
      },
    ],
  }),
  scene({
    id: 'enc-homework',
    zone: 'home',
    x: -8.4,
    z: 5.2,
    label: 'לגשת לשיעורי הבית',
    title: 'תרגיל תקוע',
    intro: 'המחברת פתוחה על שלוש. התרגיל הרביעי לא זז.',
    ground: 'home',
    prop: 'book',
    friend: 'brother',
    cast: [
      ['brother', 1.15, 1.15],
      ['dad', -1.2, 1.4],
    ],
    open: [
      ['העיפרון עומד על השורה הריקה.', 'talk', ['book', 'page']],
      ['האח מציץ. «זה קל.» והולך.', 'talk', ['book']],
      ['אתם מוחקים כל כך חזק שהדף כמעט נקרע.', 'sad', ['page']],
      ['אבא שואל מהדלת אם צריך אותו. עוד לא עניתם.', 'talk', ['book']],
    ],
    ways: [
      {
        id: 'snap',
        label: 'לצעוק שזה טיפשי',
        mood: 'shout',
        friend: 'brother',
        awards: { courage: 1, responsibility: -1 },
        lines: [
          ['«מטופש!» העיפרון נופל על הרצפה.', 'stomp', ['book']],
          ['האח צוחק מהפתח. זה לא עוזר לשורה.', 'talk', ['page']],
          ['אבא נכנס בגלל הרעש וסוגר את המחברת.', 'sad', ['book']],
          ['התרגיל נשאר למחר, ועוד יותר גדול.', 'sad', ['book']],
        ],
      },
      {
        id: 'copy',
        label: 'להעתיק מהאח',
        mood: 'whisper',
        friend: 'brother',
        awards: { flexibility: 1, responsibility: -1 },
        lines: [
          ['«תן לי לראות רק את התשובה.» האח מהסס ונותן.', 'talk', ['book']],
          ['אתם מעתיקים את הספרות בלי את הדרך.', 'talk', ['page']],
          ['השורה מלאה. אתם לא יודעים למה היא נכונה.', 'sad', ['book']],
          ['מחר השאלה הדומה תחזור ריקה.', 'talk', ['page']],
        ],
      },
      {
        id: 'hint',
        label: 'לבקש רמז, לא תשובה',
        mood: 'read',
        friend: 'dad',
        awards: { speech: 2, responsibility: 2, courage: 1 },
        lines: [
          ['«אל תגיד את המספר. תגיד מאיפה מתחילים.»', 'talk', ['book']],
          ['אבא מצביע על השורה הראשונה, לא על הסוף.', 'talk', ['page', 'book']],
          ['אתם כותבים צעד אחד. מוחקים רק מילה, לא הכול.', 'talk', ['page']],
          ['התרגיל נגמר בכתב שלכם. האח אומר «הצלחת».', 'play', ['book']],
        ],
      },
    ],
  }),
  scene({
    id: 'enc-guest',
    zone: 'home_blue',
    x: -8,
    z: 6,
    label: 'לגשת לבלגן אצל נועם',
    title: 'בלגן אצל חבר',
    intro: 'בחדר של נועם הקוביות על השטיח, והדלת של אמא שלו עוד מעט נפתחת.',
    ground: 'home',
    prop: 'blocks',
    friend: 'noam',
    cast: [
      ['noam', 1.15, 1.15],
      ['dad', -1.25, 1.4],
    ],
    open: [
      ['נועם בונה מגדל ושוכח את הקופסה הפתוחה.', 'play', ['blocks']],
      ['צעדים במסדרון. «עוד חמש דקות ואז מסדרים.»', 'talk', ['blocks']],
      ['קובייה מתגלגלת מתחת למיטה. נועם אומר «אחר כך».', 'play', ['blocks'], [0.4, 0.5]],
      ['חמש הדקות כמעט נגמרו. החדר עדיין באמצע משחק.', 'talk', ['blocks']],
    ],
    ways: [
      {
        id: 'more',
        label: 'לבנות עוד בכל זאת',
        mood: 'play',
        friend: 'noam',
        awards: { creativity: 1, responsibility: -1 },
        lines: [
          ['«עוד מגדל.» אתם מוסיפים קומה.', 'play', ['blocks']],
          ['הדלת נפתחת על חדר שלא זז.', 'sad', ['blocks']],
          ['נועם מקבל את המבט. המשחק נעצר באמצע.', 'sad', ['blocks']],
          ['מסדרים בחיפזון, ומגדל נופל.', 'clean', ['blocks']],
        ],
      },
      {
        id: 'blame',
        label: 'להגיד שנועם בלגן',
        mood: 'shout',
        friend: 'noam',
        awards: { speech: 1, friendship: -2 },
        lines: [
          ['«זה החדר שלו, לא שלי.» נועם נעלב.', 'stomp', ['blocks']],
          ['הוא אוסף לבד, בלי להסתכל עליכם.', 'clean', ['blocks']],
          ['הביקור נגמר מוקדם. המעיל כבר ביד.', 'walk', ['blocks'], [0, -0.8]],
          ['בדרך הביתה השטיח ההוא עדיין בראש.', 'sad', ['blocks']],
        ],
      },
      {
        id: 'box',
        label: 'לאסוף יחד לקופסה',
        mood: 'clean',
        prop: 'blocks',
        friend: 'noam',
        awards: { responsibility: 2, friendship: 2 },
        lines: [
          ['«קודם כל מה שמתחת למיטה, אחר כך המגדל.»', 'talk', ['blocks']],
          ['נועם מחזיק את הקופסה. אתם מגישים קובייה־קובייה.', 'clean', ['blocks']],
          ['המגדל האחרון מצטלם בראש, ואז נכנס פנימה.', 'play', ['blocks']],
          ['כשהדלת נפתחת, השטיח נקי והקופסה סגורה.', 'talk', ['blocks']],
        ],
      },
    ],
  }),
  scene({
    id: 'enc-music',
    zone: 'home_blue',
    x: 8.5,
    z: 2.4,
    label: 'לגשת למוזיקה החזקה',
    title: 'השיר חזק מדי',
    intro: 'נועם מעלה שיר. בחדר השני מישהו מבקש שקט.',
    ground: 'home',
    prop: 'notes',
    friend: 'noam',
    cast: [
      ['noam', 1.15, 1.15],
      ['dad', -1.2, 1.35],
    ],
    open: [
      ['התווים כמעט רועדים. נועם רוקד צעד אחד.', 'play', ['notes']],
      ['מהחדר השני: «אפשר קצת יותר בשקט?»', 'talk', ['notes']],
      ['נועם לא שמע, או לא רצה לשמוע.', 'play', ['notes']],
      ['השיר באמצע. אפשר לצעוק מעליו או להנמיך.', 'talk', ['notes']],
    ],
    ways: [
      {
        id: 'louder',
        label: 'להגביר עוד',
        mood: 'shout',
        friend: 'noam',
        awards: { courage: 1, friendship: -1, restraint: -1 },
        lines: [
          ['אתם מעלים. השיר בולע את הבקשה.', 'stomp', ['notes']],
          ['הדלת נסגרת חזק יותר מהפזמון.', 'sad', ['notes']],
          ['נועם מפסיק לרקוד. כבר לא כיף.', 'sad', ['notes']],
          ['מישהו מכבה את זה מבחוץ. השיר נחתך.', 'talk', ['notes']],
        ],
      },
      {
        id: 'off',
        label: 'לכבות בלי להגיד',
        mood: 'leave',
        prop: 'notes',
        awards: { responsibility: 1, friendship: -1 },
        lines: [
          ['אתם לוחצים על השקט באמצע מילה.', 'talk', ['notes']],
          ['נועם נעלב. «יכולתם לבקש.»', 'sad', ['notes']],
          ['החדר שקט, והריקוד נעצר באמצע צעד.', 'sad', ['notes']],
          ['אחר כך קשה להדליק שוב בלי ויכוח.', 'talk', ['notes']],
        ],
      },
      {
        id: 'soft',
        label: 'להנמיך ולרקוד בשקט',
        mood: 'play',
        friend: 'noam',
        awards: { flexibility: 2, friendship: 2, restraint: 1 },
        lines: [
          ['«חצי קול. עדיין שומעים את המילים.»', 'talk', ['notes']],
          ['נועם מנמיך. הצעד הבא קטן יותר.', 'play', ['notes']],
          ['מהחדר השני לא באה עוד בקשה.', 'talk', ['notes']],
          ['בסוף השיר אתם משתחווים בשקט, לא בצעקה.', 'play', ['notes']],
        ],
      },
    ],
  }),
  scene({
    id: 'enc-window',
    zone: 'home_yellow',
    x: 8,
    z: 4.5,
    label: 'לגשת לכדור שפגע בחלון',
    title: 'הכדור והחלון',
    intro: 'הכדור חזר מהזכוכית. מאיה מחזיקה אותו, והשכנה כבר בדרך.',
    ground: 'home',
    prop: 'ball',
    friend: 'maya',
    cast: [
      ['maya', 1.15, 1.15],
      ['neighbor', -1.25, 1.35],
    ],
    open: [
      ['צלצול קטן בזכוכית. הכדור על הרצפה.', 'play', ['ball']],
      ['מאיה מרימה אותו מהר, כאילו אפשר להחזיר את הרעש.', 'clean', ['ball']],
      ['השכנה נכנסת. היא לא צועקת. היא שואלת «הכול בסדר?»', 'talk', ['ball']],
      ['אין סדק. עדיין צריך להגיד משהו.', 'talk', ['ball']],
    ],
    ways: [
      {
        id: 'hideball',
        label: 'להחביא את הכדור',
        mood: 'hide',
        prop: 'ball',
        awards: { courage: -1, responsibility: -1 },
        lines: [
          ['מאיה דוחפת את הכדור מאחורי הכיסא.', 'hide', ['ball']],
          ['«לא אנחנו.» השכנה מסתכלת על הרצפה הריקה.', 'talk', ['ball']],
          ['אחר כך הכדור מתגלה. השקר גדול מהמכה.', 'sad', ['ball']],
          ['משחקים בחוץ נגמר להיום.', 'walk', ['ball'], [0, -0.6]],
        ],
      },
      {
        id: 'blame',
        label: 'להגיד שמאיה בעטה',
        mood: 'shout',
        friend: 'maya',
        awards: { speech: 1, friendship: -2 },
        lines: [
          ['«היא!» מאיה מסתכלת עליכם, לא על החלון.', 'stomp', ['ball']],
          ['השכנה מבקשת שקט. הצעקה מיותרת.', 'talk', ['ball']],
          ['מאיה מניחה את הכדור והולכת לחדר.', 'walk', ['ball'], [1, -0.2]],
          ['החלון שלם. החברות פחות.', 'sad', ['ball']],
        ],
      },
      {
        id: 'sorry',
        label: 'להגיד סליחה ולבדוק את הזכוכית',
        mood: 'talk',
        friend: 'neighbor',
        awards: { speech: 2, responsibility: 2, friendship: 1 },
        lines: [
          ['«הכדור ברח לנו. אפשר לבדוק יחד?»', 'talk', ['ball']],
          ['השכנה מעבירה אצבע על הזכוכית. אין סדק.', 'talk', ['ball']],
          ['מאיה אומרת סליחה גם היא, בלי שדוחפים אותה.', 'talk', ['ball']],
          ['הכדור יוצא לחצר, רחוק מהחלון.', 'play', ['ball'], [0, 0.8]],
        ],
      },
    ],
  }),
  scene({
    id: 'enc-dog',
    zone: 'neighborhood',
    x: -16,
    z: 2,
    label: 'לגשת לכלב שנובח',
    title: 'הכלב ליד השער',
    intro: 'כלב חום עומד מאחורי שער ונובח. נועם נעצר באמצע המדרכה.',
    ground: 'street',
    prop: 'puppy',
    friend: 'noam',
    cast: [
      ['noam', 1.2, 1.15],
      ['neighbor', -1.25, 1.4],
    ],
    open: [
      ['הנביחה קצרה, שוב ושוב. נועם לא זז.', 'sad', ['puppy']],
      ['«הוא לא יוצא.» אתם אומרים, והרגליים עדיין עומדות.', 'talk', ['puppy']],
      ['השכן יוצא לשער. «הוא נבהל מאופניים, לא מילדים.»', 'talk', ['puppy']],
      ['הדרך הביתה עוברת כאן. צריך לבחור איך עוברים.', 'talk', ['puppy']],
    ],
    ways: [
      {
        id: 'run',
        label: 'לרוץ מהר ליד השער',
        mood: 'run',
        prop: 'puppy',
        awards: { courage: 1, restraint: -1 },
        lines: [
          ['אתם רצים. הנביחה מתארכת.', 'run', ['puppy'], [0.8, 1]],
          ['נועם רץ אחריכם וכמעט מועד.', 'run', ['puppy'], [0.4, 0.6]],
          ['השכן מחזיק את הקולר. הכלב לא יצא.', 'talk', ['puppy']],
          ['עברתם, אבל הלב עוד רץ.', 'sad', ['puppy']],
        ],
      },
      {
        id: 'back',
        label: 'לחזור ברחוב הארוך',
        mood: 'leave',
        awards: { restraint: 1, courage: -1 },
        lines: [
          ['«נלך מסביב.» נועם ממהר להסכים.', 'walk', ['puppy'], [0, -1]],
          ['הנביחה קטנה מאחוריכם.', 'walk', [], [0.2, -1.4]],
          ['הדרך ארוכה בעשר דקות. אתם מגיעים.', 'walk', [], [0, -1.8]],
          ['מחר השער עדיין שם.', 'talk', ['puppy']],
        ],
      },
      {
        id: 'slow',
        label: 'לעבור לאט בצד הרחוק',
        mood: 'wait',
        friend: 'neighbor',
        awards: { courage: 2, restraint: 2 },
        lines: [
          ['השכן אומר «לאט, בלי יד בשער.»', 'talk', ['puppy']],
          ['אתם הולכים על שפת המדרכה, לא רצים.', 'walk', ['puppy'], [-0.8, 0.8]],
          ['נועם צועד לידכם. הנביחה יורדת לנהמה.', 'walk', ['puppy']],
          ['אחרי השער אתם נושמים. הכלב נשאר במקום שלו.', 'talk', ['puppy']],
        ],
      },
    ],
  }),
  scene({
    id: 'enc-bike',
    zone: 'neighborhood',
    x: 10,
    z: -2,
    label: 'לגשת לאופניים האחדות',
    title: 'זוג אופניים אחד',
    intro: 'האופניים של דני עומדות על המדרכה. נועם מחזיק את הכידון.',
    ground: 'street',
    prop: 'bike',
    friend: 'dani',
    cast: [
      ['dani', 1.15, 1.15],
      ['noam', -1.2, 1.2],
    ],
    open: [
      ['«רק עד הפינה.» נועם כבר עם רגל על הדוושה.', 'talk', ['bike']],
      ['דני אומר שהשרשרת חדשה והוא לא רוצה שתישבר.', 'talk', ['bike']],
      ['הגלגל מסתובב חצי סיבוב ונעצר.', 'play', ['bike']],
      ['שניהם מסתכלים עליכם. אופניים אחת, שני רוצים.', 'talk', ['bike']],
    ],
    ways: [
      {
        id: 'push',
        label: 'להגיד לו לרכוב בכל זאת',
        mood: 'shout',
        friend: 'noam',
        awards: { courage: 1, friendship: -1 },
        lines: [
          ['«סע!» נועם יוצא לפני שדני גמר את המשפט.', 'stomp', ['bike']],
          ['הפנייה חדה. השרשרת משמיעה קליק.', 'sad', ['bike'], [0.8, 1]],
          ['דני רץ אחרי האופניים שלו.', 'run', ['bike']],
          ['נועם יורד. אף אחד לא נהנה מהסיבוב.', 'sad', ['bike']],
        ],
      },
      {
        id: 'nope',
        label: 'להגיד שאסור לגעת',
        mood: 'talk',
        friend: 'dani',
        awards: { responsibility: 1, flexibility: -1 },
        lines: [
          ['«לא נוגעים.» נועם מוריד את הרגל.', 'talk', ['bike']],
          ['דני מזיז את האופניים אל הקיר, קרוב אליו.', 'talk', ['bike']],
          ['הולכים ברגל. האופניים חורקות ליד.', 'walk', ['bike'], [0.4, 0.8]],
          ['נועם שותק עד הבית.', 'sad', ['bike']],
        ],
      },
      {
        id: 'walkbike',
        label: 'ללכת איתן עד הפינה',
        mood: 'talk',
        prop: 'bike',
        friend: 'noam',
        awards: { friendship: 2, flexibility: 2, responsibility: 1 },
        lines: [
          ['«אף אחד לא רוכב. מוליכים עד הפינה וחוזרים.»', 'talk', ['bike']],
          ['דני מחזיק כידון, נועם הולך מהצד השני.', 'walk', ['bike'], [0, 0.7]],
          ['בפינה מחליפים ידיים וחוזרים.', 'talk', ['bike']],
          ['השרשרת שקטה. שניהם נגעו, אף אחד לא לקח.', 'play', ['bike']],
        ],
      },
    ],
  }),
  scene({
    id: 'enc-line',
    zone: 'shop',
    x: 3.6,
    z: 0.2,
    label: 'לגשת לתור בקופה',
    title: 'מי לפני מי',
    intro: 'במכולת שני אנשים הגיעו לקופה יחד. הסלסילה של השכנה, והבקבוק של אמא.',
    ground: 'street',
    prop: 'bottle',
    friend: 'mom',
    cast: [
      ['mom', 1.1, 1.2],
      ['neighbor', -1.15, 1.25],
      ['shopkeeper', 0.1, 1.85],
    ],
    open: [
      ['השכנה שמה סלסילה על הדלפק באותו רגע.', 'talk', ['bottle']],
      ['אמא אומרת «היינו כאן.» בקול נמוך, לא בטוח.', 'talk', ['bottle']],
      ['מוטי מחכה עם השקית פתוחה. הוא לא בוחר צד.', 'talk', ['bottle']],
      ['התור תקוע על שני צעדים. כולם שומעים אתכם.', 'talk', ['bottle']],
    ],
    ways: [
      {
        id: 'cut',
        label: 'להיכנס לפני הסלסילה',
        mood: 'shout',
        friend: 'neighbor',
        awards: { courage: 1, friendship: -1 },
        lines: [
          ['אתם שמים את הבקבוק לפני הסלסילה.', 'stomp', ['bottle']],
          ['השכנה שותקת ומושכת את הסל לאחור.', 'sad', ['bottle']],
          ['אמא משלמת מהר. היציאה לא נעימה.', 'talk', ['bottle']],
          ['בחוץ אף אחד לא אומר תודה.', 'walk', ['bottle'], [0, -0.6]],
        ],
      },
      {
        id: 'drop',
        label: 'לוותר וללכת בלי לקנות',
        mood: 'leave',
        prop: 'bottle',
        awards: { restraint: 1, responsibility: -1 },
        lines: [
          ['«עזבי.» אתם מחזירים את הבקבוק למדף.', 'walk', ['bottle'], [-0.6, -0.4]],
          ['אמא הולכת אחריכם. התור זז בלעדיכם.', 'walk', ['bottle']],
          ['בבית אין את מה שבאתם לקחת.', 'sad', ['bottle']],
          ['הויכוח נגמר כי נעלמתם, לא כי נפתר.', 'talk', ['bottle']],
        ],
      },
      {
        id: 'offer',
        label: 'להציע לה קודם, היא עם סל',
        mood: 'talk',
        friend: 'shopkeeper',
        awards: { speech: 2, friendship: 2, restraint: 1 },
        lines: [
          ['«יש לה סל שלם. אנחנו אחריה, זה רק בקבוק.»', 'talk', ['bottle']],
          ['השכנה מחייכת קטן. מוטי סופר את שלה קודם.', 'talk', ['bottle']],
          ['אחר כך הבקבוק עולה על הדלפק בלי דחיפה.', 'talk', ['bottle']],
          ['בחוץ השכנה מחזיקה את הדלת.', 'play', ['bottle']],
        ],
      },
    ],
  }),
  scene({
    id: 'enc-spill',
    zone: 'shop',
    x: 3.2,
    z: -3.6,
    label: 'לגשת לבקבוק שנשפך',
    title: 'נשפך במעבר',
    intro: 'בקבוק מיץ נח על הצד. שלולית קטנה מתקרבת לנעל.',
    ground: 'street',
    prop: 'bottle',
    friend: 'shopkeeper',
    cast: [['shopkeeper', 1.2, 1.3]],
    open: [
      ['הבקבוק מתגלגל עוד סנטימטר. הפקק פתוח.', 'talk', ['bottle']],
      ['מיץ על האריח. מישהו מאחוריכם אומר «אוי.»', 'sad', ['bottle']],
      ['מוטי בא עם סמרטוט ועוד לא רואה אתכם.', 'walk', ['cloth'], [0.6, 0.8]],
      ['אפשר לברוח מהשלולית, לכעוס, או לעצור אותה.', 'talk', ['bottle']],
    ],
    ways: [
      {
        id: 'blame',
        label: 'להגיד שמישהו דחף',
        mood: 'shout',
        friend: 'shopkeeper',
        awards: { speech: 1, responsibility: -1 },
        lines: [
          ['«לא אני, דחפו אותי!» הקול גבוה במעבר.', 'stomp', ['bottle']],
          ['אנשים זזים. אף אחד לא מודה בדחיפה.', 'talk', ['bottle']],
          ['מוטי מנגב לבד. הוא לא מתווכח.', 'clean', ['cloth']],
          ['אתם יוצאים עם הידיים נקיות והבטן לא.', 'walk', ['bottle'], [0, -0.5]],
        ],
      },
      {
        id: 'step',
        label: 'לדלג ולהמשיך',
        mood: 'leave',
        prop: 'bottle',
        awards: { restraint: 1, responsibility: -1 },
        lines: [
          ['אתם פוסעים מעל השלולית אל המדף הבא.', 'walk', ['bottle'], [0.5, 0.4]],
          ['הבקבוק עדיין שוכב. המיץ מגיע לעוד אריח.', 'sad', ['bottle']],
          ['מוטי מגיע אחרי שהכתם גדל.', 'clean', ['cloth', 'bottle']],
          ['אף אחד לא כועס עליכם. גם אף אחד לא נעזר.', 'talk', ['cloth']],
        ],
      },
      {
        id: 'stand',
        label: 'להרים ולהזהיר',
        mood: 'clean',
        prop: 'cloth',
        friend: 'shopkeeper',
        awards: { responsibility: 2, speech: 1, courage: 1 },
        lines: [
          ['אתם מרימים את הבקבוק ומעמידים אותו.', 'clean', ['bottle']],
          ['«רצפה רטובה.» אתם אומרים למי שבא.', 'talk', ['bottle']],
          ['מוטי מגיש סמרטוט. אתם מחזיקים את הקצה.', 'clean', ['cloth']],
          ['האריח מתייבש. מוטי אומר תודה בשקט.', 'talk', ['cloth', 'bottle']],
        ],
      },
    ],
  }),
  scene({
    id: 'enc-wolf',
    zone: 'zoo',
    x: 6,
    z: 2,
    label: 'לגשת לפחד מול הכלוב',
    title: 'מול הזאב',
    intro: 'הזאב עובר לאורך הגדר. האחות נעצרת שני צעדים לפני השלט.',
    ground: 'grass',
    prop: 'cones',
    friend: 'sister',
    cast: [
      ['sister', 1.15, 1.15],
      ['zookeeper', -1.2, 1.45],
    ],
    open: [
      ['האחות אוחזת בשרוול. «הוא מסתכל.»', 'sad', ['cones']],
      ['השומר עומד ליד השלט ולא צוחק.', 'talk', ['cones']],
      ['ילדים אחרים מצמידים פנים לגדר. היא לא.', 'talk', ['cones'], [-0.2, 0.4]],
      ['אפשר למשוך אותה, ללכת, או להישאר מאחורי הקו.', 'talk', ['cones']],
    ],
    ways: [
      {
        id: 'pull',
        label: 'למשוך אותה עד הגדר',
        mood: 'shout',
        friend: 'sister',
        awards: { courage: 1, friendship: -1 },
        lines: [
          ['«אין מה לפחד.» אתם מושכים את השרוול.', 'stomp', ['cones']],
          ['היא נעצרת באמצע ומושכת אחורה.', 'sad', ['cones']],
          ['השומר אומר «לא מושכים.» ופותח רווח.', 'talk', ['cones']],
          ['האחות הולכת לספסל. הכלוב נשאר בלי שניכם.', 'walk', ['cones'], [0, -0.8]],
        ],
      },
      {
        id: 'skip',
        label: 'לדלג על הכלוב הזה',
        mood: 'leave',
        awards: { restraint: 1, flexibility: 1 },
        lines: [
          ['«יש אייל בהמשך. נתחיל שם.»', 'talk', ['cones']],
          ['האחות ממהרת להסכים. הכתפיים יורדות.', 'walk', ['cones'], [0, -0.6]],
          ['מול האייל היא כן מתקרבת לשלט.', 'talk', ['plant'], [0.2, 0.8]],
          ['את הזאב אפשר לראות אחר כך, לא היום.', 'talk', ['cones']],
        ],
      },
      {
        id: 'line',
        label: 'לעמוד על הקו יחד',
        mood: 'wait',
        friend: 'zookeeper',
        awards: { courage: 2, friendship: 2, restraint: 1 },
        lines: [
          ['השומר מראה קו על השביל. «עד כאן זה קרוב מספיק.»', 'talk', ['cones']],
          ['אתם עומדים על הקו. האחות עומדת חצי צעד מאחוריכם.', 'wait', ['cones']],
          ['הזאב עובר ולא עוצר. היא סופרת את הצעדים שלו.', 'talk', ['cones']],
          ['אחר כך היא זזה אל הקו בעצמה, בלי משיכה.', 'talk', ['cones'], [0.3, 0.4]],
        ],
      },
    ],
  }),
];

const byId = new Map(ENCOUNTERS.map((encounter) => [encounter.id, encounter]));

export function allEncounters(): readonly Encounter[] {
  return ENCOUNTERS;
}

export function encountersIn(zone: ZoneId): Encounter[] {
  return ENCOUNTERS.filter((encounter) => encounter.zone === zone);
}

export function encounterById(id: string): Encounter | undefined {
  return byId.get(id);
}

export function encounterShot(key: string): EncounterShot | undefined {
  return SHOTS.get(key);
}
