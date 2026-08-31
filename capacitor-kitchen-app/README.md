# אפליקציית מטבח (Capacitor) — אדלה בשוק

עוטפת את `admin.html` הקיים באתר באפליקציית Android (Capacitor), כדי לפתור בעיית
**הדפסה למדפסת תרמית USB בלי root**. שום דבר בדף `admin.html` עצמו לא שונה — התיקייה
הזו היא פרויקט נפרד לגמרי, שמעתיק את הדף בזמן build ומזריק לתוך ה*עותק* בלבד את
התוספות שדרושות בשביל WebView נייטיבי.

## למה זה נחוץ (ולמה לא מספיק Chrome רגיל)

אנדרואיד טוען אוטומטית דרייבר קרנל (`usblp`) על כל מכשיר מסוג USB Printer Class ברגע
שהוא מחובר. Chrome/WebUSB לא יכול לתפוס (`claim`) ממשק שכבר מוחזק ע"י דרייבר קרנל —
זו מגבלה של Chromium עצמו, ואין דרך לעקוף אותה בלי root מתוך הדפדפן.

אפליקציית Android נייטיבית **כן** יכולה, דרך:
```kotlin
connection.claimInterface(iface, force = true)
```
זה הצעד היחיד שבאמת "פותר" את הבעיה — הכל כאן קיים בשביל לאפשר את הקריאה הזו.

## מה שונה מ-WebUSB (הפתרון הקיים באתר)

ב-`admin.html` **כבר קיים** מודול הדפסה ישירה דרך WebUSB (מסומן
`WebUSB direct printing`, ראו `PRINTER_WEBUSB.md` בשורש הריפו): הוא בונה קבלה כתמונה
ושולח אותה כ-ESC/POS raster (`GS v 0`) דרך `navigator.usb`. זה עובד מצוין ב-Chrome
רגיל על **מחשב/טאבלט שבו למדפסת אין דרייבר קרנל מובנה שתופס אותה**. באנדרואיד, ה-usblp
תופס אותה קודם — ומכאן הצורך באפליקציה נייטיבית.

**חשוב:** לא שוכפל כאן שום קוד הדפסה. במקום זאת, `scripts/sync-web.js` מזריק ב*עותק*
של הדף (`www/index.html` בלבד — לא ב-`admin.html` המקורי) פוליפיל קטן ל-`navigator.usb`
המגובה ע"י הפלאגין הנייטיבי `UsbThermalPrinterPlugin`. כך כל קוד ה-WebUSB הקיים
(`escposConnect`/`escposIsConnected`/`escposPrintOrder`, כולל רינדור הקבלה ל-canvas)
ממשיך לרוץ **ללא שינוי אחד**, רק שהוא בפועל מדבר עם USB דרך קוד נייטיבי במקום WebUSB
של הדפדפן.

## מבנה הפרויקט

```
capacitor-kitchen-app/
├── capacitor.config.ts        # appId/appName ניתנים לקונפיגורציה (APP_ID / APP_NAME)
├── scripts/sync-web.js        # מעתיק admin.html + נכסים ל-www/, מזריק תיקוני build
├── www/                       # נוצר ע"י sync-web.js — לא ב-git
└── android/                   # פרויקט Android (נוצר ע"י `npx cap add android`)
    └── app/src/main/java/com/adelabashuk/kitchen/
        ├── MainActivity.java            # registerPlugin(UsbThermalPrinterPlugin)
        └── UsbThermalPrinterPlugin.kt   # connect / isConnected / printBytes / disconnect
```

הקבצים היחידים שהועתקו מהאתר ל-`www/` (רק מה שהדף באמת טוען בדפדפן — לא כל האתר):
`admin.html`→`index.html`, `site.config.js`, `js/firebase-auth.js`,
`admin-manifest.json`, `icon-192.png`, `icon-512.png`, `sounds/alert.wav`.

## מה תוקן ב-build (רק בעותק — לא ב-admin.html המקורי)

כל התיקונים האלה מוזרקים כ-`<script>` יחיד ע"י `scripts/sync-web.js`, מיד אחרי
`<script src="js/firebase-auth.js">` וב-`www/index.html` בלבד:

1. **נתיבי fetch יחסיים** — `fetch('/.netlify/functions/...')` נשבר בתוך האפליקציה
   כי ה-origin המקומי של Capacitor הוא `https://localhost`, לא הדומיין האמיתי. נכתב
   מחדש ל-URL מלא לפי `PROD_ORIGIN` (ר' טבלת קונפיגורציה למטה).
2. **CORS על ה-Netlify Functions הרלוונטיות** — `netlify/functions/admin-login.js`
   (שנקרא מ-`admin.html` להתחברות) ו-`netlify/functions/notify-order-status.js`
   (התראת פוש ללקוח) עודכנו (בריפו הראשי, לא כאן) כך שכל תשובה שלהן — כולל
   ה-`OPTIONS` preflight וכל תשובת שגיאה — מחזירה בעצמה
   `Access-Control-Allow-Origin`/`-Methods`/`-Headers`. ה-header הכללי ב-`netlify.toml`
   לא תמיד חל על כל תשובה של Function, אז זה נעשה בפונקציות עצמן. **לא נגענו** בשום
   Function אחרת שהדף הזה לא קורא לה.
3. **`<audio loop>`** לפעמים לא אמין ב-WebView של אנדרואיד — הצליל מתנגן פעם אחת
   ונעצר. נוסף מאזין ל-`ended` שמפעיל מחדש ידנית כשה-`loop` עדיין `true` (no-op
   בדפדפנים תקינים).
4. **גשר USB נייטיבי** — פוליפיל ל-`navigator.usb` (מוסבר למעלה).

**לא נעשה שימוש ב-`CapacitorHttp`** — נבדק והוחלט לוותר עליו: הוא מריץ הזרקת fetch
משלו בתוך מאזין `DOMContentLoaded` פנימי של Capacitor, ועלול "לבלוע" בשקט קוד אחר
שעוטף את `window.fetch` (במקרה שלנו, את תיקון ה-PROD_ORIGIN למעלה). מכיוון שהתיקון
האמיתי ל-CORS נעשה בצד השרת (סעיף 2), אין צורך ב-HTTP נייטיבי בכלל — `fetch` רגיל
מספיק.

## טבלת קונפיגורציה

| מפתח | מוגדר איפה | ברירת מחדל | הערה |
|---|---|---|---|
| `APP_ID` | env var בזמן build (`capacitor.config.ts`) | `com.adelabashuk.kitchen` | Application ID של האפליקציה |
| `APP_NAME` | env var בזמן build (`capacitor.config.ts`) | `אדלה בשוק — מטבח` | שם האפליקציה במכשיר |
| `PROD_ORIGIN` | env var בזמן build (`scripts/sync-web.js`) | נלקח אוטומטית מ-`site.config.js` → `business.canonicalUrl` בריפו הראשי | הדומיין האמיתי של האתר; **ריק/placeholder כרגע** — ראו אזהרה למטה |
| VID/PID של המדפסת | `android/app/src/main/res/xml/usb_device_filter.xml` | ריק (placeholder בהערה) | ראו הוראות מילוי למטה |

⚠️ **`site.config.js` בריפו הראשי עדיין מכיל `canonicalUrl` placeholder**
(`REPLACE-WITH-YOUR-DOMAIN.netlify.app`) — כשתמלאו שם את הדומיין האמיתי (ר'
`SETUP.md`), ה-build של האפליקציה יאסוף אותו אוטומטית, בלי לגעת בקוד הזה. עד אז,
אפשר לעקוף עם `PROD_ORIGIN=https://your-real-site.netlify.app npm run build`.

### איך למלא את VID/PID של המדפסת
1. חברו את המדפסת לטלפון/טאבלט (או למחשב, USB רגיל).
2. `lsusb` (לינוקס/מחשב) או `adb shell dumpsys usb` (מכשיר אנדרואיד מחובר ל-adb).
3. תמצאו שורה כמו `ID 0483:5743` — אלה ערכים **הקסדצימליים**. המרה לעשרוני:
   `0x0483` → `1155`, `0x5743` → `22339`.
4. מלאו ב-`android/app/src/main/res/xml/usb_device_filter.xml`:
   ```xml
   <usb-device vendor-id="1155" product-id="22339" />
   ```
   **זה לא חובה** כדי שההדפסה תעבוד — `UsbThermalPrinterPlugin.connect()` מוצא את
   המדפסת גם בלי זה (לפי USB Printer Class, `interfaceClass == 7`). זה נותן נוחות
   נוספת: פתיחת האפליקציה אוטומטית + ללא דיאלוג הרשאה כשמחברים את המדפסת (לפי מדריך
   ה-USB Host הרשמי של אנדרואיד: מכשיר שמסונן כך לא דורש אישור משתמש בכל הפעלה).

## הוראות Build

### מקומי (דורש Android SDK + JDK 21 מותקנים)
```bash
cd capacitor-kitchen-app
npm install
npm run android:sync      # מריץ sync-web.js ואז npx cap sync android
cd android
./gradlew assembleDebug   # APK ב-android/app/build/outputs/apk/debug/
```

### בענן (GitHub Actions — בנייה מהטלפון בלי מחשב)
`.github/workflows/kitchen-app-build.yml` בשורש הריפו. הרצה:
1. GitHub → הריפו → **Actions** → **Build Kitchen App (Android APK)** → **Run workflow**.
   (רץ גם אוטומטית ב-push לשינויים בקבצים הרלוונטיים.)
2. בסיום — ה-APK מופיע כ-**Artifact** בהרצה (`kitchen-app-debug-apk`), להורדה ישירה
   מהדפדפן/מהטלפון.
3. אופציונלי: כדי לקבוע `PROD_ORIGIN`/`APP_ID`/`APP_NAME` בלי לערוך קוד — הגדירו
   **Repository variables** (Settings → Secrets and variables → Actions → Variables)
   באותם שמות; ה-workflow קורא אותם אוטומטית.

## הסרה מלאה
כל הפיצ'ר הזה חי בתיקייה `capacitor-kitchen-app/` בלבד, פרט לשינוי ה-CORS הקטן
ב-2 Netlify Functions (`admin-login.js`, `notify-order-status.js` — לא סיכון: רק
מוסיף headers, לא משנה לוגיקה) ולקובץ ה-workflow. להסרה: מחקו את התיקייה, את
`.github/workflows/kitchen-app-build.yml`, ואופציונלית שחזרו את שני קבצי ה-Functions
(לא חובה — ה-headers הנוספים לא פוגעים בכלום גם אם האפליקציה לא בשימוש).

## ⚠️ צ'קליסט בדיקה ידני על מכשיר פיזי
אין גישה למכשיר Android פיזי מכאן — כל הבנייה נבדקה עד רמת syntax/structure בלבד
(Gradle DSL, Kotlin, JS), לא הורצה בפועל. **חובה** לבדוק את כל הסעיפים הבאים על
מכשיר אמיתי לפני שימוש במטבח:

1. **התקנה בסיסית:** התקינו את ה-APK (debug) → האפליקציה נפתחת ומציגה את מסך
   ה-login של `admin.html` (עיצוב זהה לגרסת הדפדפן).
2. **login:** הזינו סיסמה → מצליח (בודק את תיקון ה-`PROD_ORIGIN`/CORS ל-`admin-login`).
   אם נכשל: פתחו `chrome://inspect` (Remote debugging דרך USB) ובדקו שגיאות ב-Console.
3. **הזמנות:** הזמנה חדשה מהאתר מופיעה בעמודת "חדשות" בזמן סביר (polling כל 8 שניות,
   כרגיל).
4. **חיבור מדפסת USB:** חברו את המדפסת ל-Android דרך כבל USB-OTG. לחצו
   **"🔌 חבר מדפסת USB"**. בפעם הראשונה אמור להופיע דיאלוג הרשאת USB של אנדרואיד
   (לא WebUSB) — אשרו. הכפתור אמור להפוך ל-**"🖨 מדפסת USB מחוברת"**.
   - אם נכשל: בדקו ב-`adb logcat -s UsbThermalPrinter` — יש לוג עם errno/סיבה מדויקת
     (`claimInterface(force=true) נכשל...` וכו').
5. **הדפסה בפועל:** לחצו 🖨 על כרטיס הזמנה → קבלה יוצאת מהמדפסת, עברית תקינה (RTL),
   בלי שיבוש. אם רוחב חתוך/מוסט — שנו ב-`admin.html` (המקור, לא כאן!)
   `ESCPOS_WIDTH_DOTS` מ-`576` ל-`512` (ראו `PRINTER_WEBUSB.md`).
6. **חיבור אוטומטי אחרי רענון:** סגרו ופתחו מחדש את האפליקציה (המדפסת עדיין מחוברת)
   → מתחברת לבד, **בלי** דיאלוג הרשאה נוסף (הרשאת USB של אנדרואיד נשמרת כל עוד
   ההתקן לא מנותק).
7. **חיבור אוטומטי אחרי אתחול מלא:** רק אם מולאו VID/PID ב-`usb_device_filter.xml` —
   אתחלו את הטלפון עם המדפסת מחוברת → האפליקציה אמורה לקבל הרשאה **בלי** דיאלוג
   (בזכות ה-intent-filter ב-`AndroidManifest.xml`).
8. **הדפסה אוטומטית מהזמנה חדשה:** הפעילו "🖨 הדפסה אוטומטית" (הכפתור הקיים) →
   בצעו הזמנת בדיקה מהאתר → מודפסת לבד תוך כמה שניות.
9. **מצב מטבח (Kitchen Mode):** אם בשימוש — ודאו שההתראה האגרסיבית (צליל בלולאה +
   מסך מהבהב) עדיין עובדת בתוך האפליקציה, ושהצליל **באמת חוזר בלולאה** ולא נעצר אחרי
   נגינה אחת (זה בדיוק התיקון בסעיף 3 למעלה — קריטי לבדוק).
10. **Push notifications ללקוח:** שנו סטטוס הזמנה ל"בטיפול"/"מוכן" → ודאו שהלקוח מקבל
    התראה (בודק את תיקון ה-CORS ל-`notify-order-status`). אם לא — יש fallback לקישור
    WhatsApp שאמור להופיע בטוסט.
11. **Wake Lock / מסך דלוק:** עם מצב מטבח פעיל, ודאו שהמסך לא נכבה במשך 10+ דקות.
12. **אביב קופות:** הדפיסו גם מ-אביב (LAN) וגם מהטאבלט (USB) כמעט-יחד → שתי הקבלות
    יוצאות נקיות, בלי הפרעה הדדית (USB ו-LAN הם ממשקים נפרדים במדפסת).
