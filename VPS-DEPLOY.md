# TAMUR Open the Safe — Contabo/Coolify sinov joylashtirish

Bu tarmoq **faqat tayyorlov**. GitHub `main` va Render'dagi jonli saytni o'zgartirmaydi.

## Tuzilish

- Dockerfile: root huquqisiz ishlaydigan NGINX, ichki port **8080**.
- `/healthz`: xizmat ishlayotganini tekshirish.
- UI va barcha media lokal statik fayllardan beriladi.
- `js/app.js` Supabase Edge Function'ga **o'zgarishsiz** murojaat qiladi; Supabase bazasi, Edge Function va o'yin ma'lumotlari ko'chirilmaydi.

## Coolify

1. Coolify ishga tushgan VPS'da GitHub repoga ulanish.
2. Resurs: Application → Public/Private Git Repository → shu repo, tarmoq `vps-migration/open-safe`.
3. Build pack: **Dockerfile**, Dockerfile location: `/Dockerfile`, port: **8080**.
4. Avval vaqtinchalik test domen bilan ishga tushirish. **DNS va eski Render servisni o'zgartirmaslik**.
5. `https://TEST-DOMEN/healthz` → `ok`; asosiy sahifada video, shriftlar va 3D seyfni tekshirish.
6. Brauzer tarmoq so'rovlarida `safe-api` javoblarini tekshirish. Supabase CORS siyosati yangi domenga ruxsat berishi kerak.
7. Testda foydalanuvchi ma'lumoti yozilmasligiga e'tibor: haqiqiy kampaniyaga kod kiritib sinamang; `accepting_entries=false` test rejimi yoki alohida sinov muhitida tekshiring.
8. Domen va HTTPS tayyor bo'lgachgina alohida tasdiq bilan trafikni yangi VPS'ga o'tkazish. Shundan keyin eski Render'ni bekor qilish mumkin.

## Qaytarish

VPS yoki yangi domen ishlamasa, DNS'ni eski xizmatga qaytaring. Supabase ma'lumotiga tegilmaydi.

## Tekshirilmagan jihatlar

Docker build va real VPS smoke-test hali o'tkazilmagan; buning uchun serverga kirish kerak.
