# Tanum InfoScreen – Lysekil Buss

Det här paketet innehåller en första fungerande version med:
- TV-visning på `/display`
- Administrationssida på `/admin`
- Lägga till, redigera och ta bort inlägg
- Ladda upp en bild per inlägg (max 500 KB)
- Ställa visningstid från 10 till 300 sekunder
- Schemalägga start- och sluttid
- Pausa/aktivera inlägg och ändra ordningen
- حفظ المنشورات في Cloudflare KV

## قبل النشر – إعداد Cloudflare مرة واحدة

1. من Cloudflare افتح **Workers & Pages** ثم افتح Worker الذي أنشأته باسم `tanum-infoscreen`.
2. افتح **Settings → Bindings**.
3. اختر **Add binding → KV namespace**.
4. اكتب Variable name بالضبط: `INFO_KV`.
5. أنشئ KV namespace جديداً باسم مثلاً `TANUM_INFOSCREEN_DATA` ثم اربطه.
6. من **Settings → Variables and Secrets** أضف Secret باسم `ADMIN_PIN` وضع رمز إدارة خاصاً بك (مثلاً رمزاً من 8 أرقام، ولا تستخدم رمزاً سهلاً).
7. احفظ التغييرات.

## رفع الكود

1. افتح Worker ثم **Edit code**.
2. افتح الملف `worker.js` الموجود في هذه الحزمة.
3. استبدل كل الكود الموجود في محرر Cloudflare بمحتوى الملف كاملاً.
4. اضغط **Deploy**.
5. افتح رابط Worker ثم أضف `/admin` للإدارة، أو `/display` لشاشة التلفاز.

مثال:
- `https://اسم-worker.اسم-حسابك.workers.dev/admin`
- `https://اسم-worker.اسم-حسابك.workers.dev/display`

## ملاحظات مهمة

- لا تفعّل Cloudflare Access الآن؛ تسجيل الإدارة يتم برمز `ADMIN_PIN`.
- لا تشارك رمز الإدارة مع السائقين.
- الصور تُحفظ ضمن بيانات المنشورات في KV؛ لذلك ضغط الصور إلى أقل من 500 KB مهم.
- هذه نسخة أولى عملية. جرّبها أولاً على هاتفك، ثم افتح `/display` على التلفاز.
- لا تضع معلومات شخصية أو حساسة في المنشورات العامة.


مهم: يجب أن يكون ربط KV باسم INFO_KV موجوداً في إعدادات Worker على Cloudflare. لا تغيّر مشروع lysekil-buss القديم.
