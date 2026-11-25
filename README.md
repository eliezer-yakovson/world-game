# עולם חי — סימולציית חיים תלת־ממדית בעברית

משחק עולם פתוח אופליין (RTL מלא) על **Three.js + Vite + Yuka + Howler**, עם אפשרות אריזה ל־`.exe` דרך **Tauri**.

## הרצה בפיתוח

```bash
npm install
npm run dev
```

פתחו את הכתובת שמוצגת בטרמינל (ברירת מחדל `http://localhost:5173`).

### שליטה

| מקש | פעולה |
|-----|--------|
| WASD / חצים | תנועה |
| Shift | ריצה |
| Q / R | סיבוב מצלמה |
| E / Enter | אינטראקציה |
| F | כרטיסיית דמות (NPC Inspector) |
| G | אכילת אוכל מהתיק |

## בנייה לווב

```bash
npm run build
npm run preview
```

## אריזה ל־Windows `.exe` (Tauri)

1. התקינו [Rust](https://www.rust-lang.org/tools/install).
2. התקינו תלויות:

```bash
npm install
npm install -D @tauri-apps/cli
```

3. הריצו:

```bash
npm run tauri:dev
npm run tauri:build
```

קבצי ההתקנה יופיעו תחת `src-tauri/target/release/bundle/`.

במחשב הפיתוח הזה Rust לא היה מותקן, ולכן קובץ ה־`.exe` לא הורכב בפועל. פרויקט Tauri מוכן, והמשחק עצמו נבנה ורץ אופליין דרך `npm run build` ו־`npm run preview`. אחרי התקנת Rust, `npm run tauri:build` מייצר את קובץ ההתקנה.

## נכסים CC0

ראו [LICENSES.md](./LICENSES.md) ו־[public/assets/README.md](./public/assets/README.md).

```bash
npm run verify-licenses
```

## מבנה עיקרי

- `src/core` — שעון, זיכרון, שמירות
- `src/world` — אזורים (שכונה, בית, בית ספר, חנות, פארק, גן חיות)
- `src/characters` — שחקן ו־NPC (Yuka)
- `src/situations` — מנוע סיטואציות JSON
- `src/systems` — כלכלה, חברויות, תנועה, בית, צרכים
- `src/ui` — ממשק עברית RTL
- `content/` — דמויות, חנות, סיטואציות, לוח שנה
