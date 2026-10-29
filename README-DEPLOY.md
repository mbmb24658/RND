# سامانه مدیریت پروژه‌ها و پروپوزال‌های تحقیق و توسعه (R&D)

سامانه تحت وب برای **ثبت، تغییر، پایش و ارزیابی** پروژه‌ها و پروپوزال‌های R&D — مهندسی‌معکوس‌شده از فایل `DB.xlsx` با ۶۲۸ رکورد و ۶۸ ستون.

## ✨ قابلیت‌ها

| بخش | شرح |
|---|---|
| داشبورد وضعیت | آمار کل، نمودار وضعیت‌ها، روند ثبت ماهانه (شمسی)، مبلغ به تفکیک گروه، آخرین تغییرات |
| مدیریت پروژه‌ها و پروپوزال‌ها | ثبت/ویرایش با **ویزارد ۵ مرحله‌ای**، جستجو و فیلتر، جزئیات کامل با تب‌های مالی/تمدید/ارزیابی/مستندات |
| داشبورد ارزیابی و امتیازدهی | صف ارزیابی پروژه‌های بدون ارزیابی، فرم امتیازدهی ۵ معیاره (جمع ۱۰۰)، درجه‌بندی عالی/خوب/متوسط/ضعیف، روند عملکرد |
| مدیریت مالی | کارت‌های تعهدات/پرداخت/باقی‌مانده/حق‌نظارت، ثبت پرداخت با شماره سند و نامه، نرخ پرداخت هر پروژه |
| مدیریت ناظران | ساخت کاربر ناظر با یوزر/پسورد، آمار ارزیابی‌ها و پروژه‌های تحت نظارت |
| مدیریت کاربران و نقش‌ها | چند مدیر همزمان، تغییر نقش هر کاربر، فعال/غیرفعال، بازنشانی رمز |
| مستندات | بارگذاری اسناد اسکن‌شده (PDF/تصویر/آفیس تا ۱۰MB) و دانلود |
| گزارش تغییرات | لاگ کامل همه عملیات (ایجاد/ویرایش/حذف/ورود) با کاربر و زمان شمسی |

## 🔐 نقش‌ها و دسترسی‌ها

| نقش | دسترسی |
|---|---|
| **مدیریت (ADMIN)** | همه‌چیز + مدیریت کاربران و نقش‌ها + حذف رکوردها |
| **کارشناس کنترل پروژه (PROJECT_CONTROL)** | ثبت و تغییر پروژه/پروپوزال، پرداخت، تمدید، بارگذاری مستندات |
| **ناظر (SUPERVISOR)** | مشاهده همه + ثبت و ویرایش ارزیابی‌ها |

کاربران پیش‌فرض (اولین راه‌اندازی با `bun scripts/seed.mjs`):

| یوزر | پسورد | نقش |
|---|---|---|
| `admin` | `admin123` | مدیریت |
| `control` | `control123` | کارشناس کنترل پروژه |
| `nazer` | `nazer123` | ناظر |

⚠️ پس از استقرار واقعی، رمزها را از بخش «مدیریت کاربران» تغییر دهید.

## 🗓 قواعد داده

- **تاریخ‌ها:** ورود و نمایش همگی **هجری شمسی** (مثل `۱۴۰۴/۰۵/۲۱`)؛ در دیتابیس به‌صورت ISO ذخیره می‌شوند. اسکریپت ETL برای هر فیلد تاریخ اکسل (سریال اکسل، `2019/9/12`، `26/10/2019` و…) قانون مجزا دارد و تاریخ شمسی درون داده‌ها را نیز تشخیص می‌دهد.
- **مبالغ:** همه‌چیز **ریال** (BigInt)؛ زیر هر برچسب مبلغ، معادل **تومان** نمایش داده می‌شود.
- **Data Validation:** فیلدهای وضعیت، نوع طرح، نوع نظارت، نوع پرداخت، درصدها (۰-۱۰۰)، امتیازها (۰-۲۰) و تاریخ‌ها سمت سرور اعتبارسنجی می‌شوند و مقدار غیرمجاز ذخیره نمی‌شود.

## 🧱 معماری و اسکیمای دیتابیس

مهندسی معکوس از اکسل → جداول نرمال‌شده با PK/FK (فایل `prisma/schema.prisma`):

```
User (PK id) ۱──∞ Project.supervisor / author
Institute (PK id) ۱──∞ Project (FK instituteId)
Project (PK id, UK code) ۱──∞ Payment (FK projectId, onDelete Cascade)
Project ۱──∞ Extension (FK projectId)
Project ۱──∞ ProjectItem (FK projectId)
Project ۱──∞ Evaluation (FK projectId) ∞──۱ User (evaluatorId)
Document (entityType + entityId — چندریختی)
ActivityLog (FK userId)
```

## 🚀 اجرای محلی

```bash
bun install
bun run db:push          # ایجاد جداول
bun scripts/seed.mjs     # کاربران پیش‌فرض
bun scripts/etl.mjs      # مهاجرت داده از upload/DB.xlsx (اختیاری — دیتابیس همراه پروژه آماده است)
bun run dev              # http://localhost:3000
```

## ☁️ انتشار روی GitHub + Vercel

### ۱) پوش به GitHub

```bash
git init
git add .
git commit -m "سامانه مدیریت پروژه‌های R&D — نسخه ۱"
git branch -M main
git remote add origin https://github.com/<USERNAME>/<REPO>.git
git push -u origin main
```

### ۲) اتصال Vercel

1. در [vercel.com](https://vercel.com) → **Add New → Project** → ریپازیتوری را Import کنید.
2. Framework Preset به‌صورت خودکار **Next.js** تشخیص داده می‌شود.
3. متغیرهای محیطی (Environment Variables):
   - `DATABASE_URL` — نگاه کنید به بخش «دیتابیس در Vercel»
   - `JWT_SECRET` — یک رشته تصادفی طولانی (مثلاً خروجی `openssl rand -hex 32`)
   - `UPLOAD_DIR` — `/tmp/uploads` (فایل‌سیستم Vercel فقط در `/tmp` نوشتنی است)
4. Deploy.

### ⚠️ دیتابیس در Vercel (مهم)

این پروژه به‌صورت پیش‌فرض از **SQLite** استفاده می‌کند که برای اجرای محلی/سندباکس عالی است، اما فایل‌سیستم Vercel ماندگار نیست و برای **محصول واقعی** باید یک دیتابیس ابری متصل کنید:

**گزینه پیشنهادی: Neon Postgres (رایگان):**
1. در [neon.tech](https://neon.tech) یک دیتابیس بسازید و Connection String را کپی کنید.
2. در `prisma/schema.prisma` فقط یک خط تغییر دهد:
   ```prisma
   datasource db {
     provider = "postgresql"   // به‌جای "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
3. اعمال اسکیما و مهاجرت داده:
   ```bash
   # روی سیستم خودتان با DATABASE_URL ابری:
   DATABASE_URL="postgresql://..." bun run db:push
   DATABASE_URL="postgresql://..." bun scripts/seed.mjs
   DATABASE_URL="postgresql://..." bun scripts/etl.mjs   # خواندن اکسل و درج در دیتابیس ابری
   ```
4. در Vercel متغیر `DATABASE_URL` را با همان رشته Postgres تنظیم کنید.

**یادداشت بارگذاری فایل:** ذخیره اسناد روی دیسک Vercel موقتی است. برای ماندگاری، اتصال به [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) توصیه می‌شود (نقطه تغییر فقط دو تابع در `src/app/api/documents/route.ts` و `[id]/route.ts` است).

## 🛠 پوشه‌بندی

```
prisma/schema.prisma      اسکیمای دیتابیس (PK/FK)
scripts/etl.mjs           اسکریپت ETL مهاجرت از اکسل (idempotent)
scripts/seed.mjs          کاربران پیش‌فرض
db/custom.db              دیتابیس SQLite با ۶۲۸ رکورد مهاجرت‌یافته
upload/DB.xlsx            فایل اکسل منبع
src/app/api/*             لایه API (auth, dashboard, projects, evaluations, finance, users, documents, activity)
src/components/app/*      رابط کاربری (ویوها، ویزارد، جزئیات)
src/lib/*                 جلالی، قالب‌بندی ریال/تومان، احراز هویت، اعتبارسنجی
uploads/                  محل ذخیره اسناد بارگذاری‌شده
```
