# План міграції на Render і деплой проекту

## 1) Передумови та доступи
- [ ] Підключити репозиторій до Render.
- [ ] Підготувати домени для фронтенду і бекенду.
- [ ] Створити Cloudflare API token з доступом до D1/R2 та DNS.
- [x] Підготувати SERVER_API_KEY для захищених ендпоінтів.
- [ ] Перевірити D1 і R2 доступи на продакшн акаунті.

### Статус даних у проекті
- [x] CLOUDFLARE_ACCOUNT_ID знайдено в `.env`.
- [x] CLOUDFLARE_API_TOKEN знайдено в `.env`.
- [x] CLOUDFLARE_API_TOKEN_D1 знайдено в `.env`.
- [x] CLOUDFLARE_D1_DATABASE_ID знайдено в `.env`.
- [x] CORS_ORIGIN знайдено в `.env`.
- [x] APP_BASE_URL знайдено в `.env`.
- [x] GOOGLE_CLIENT_ID знайдено в `.env`.
- [x] SERVER_API_KEY знайдено в `.env`.
- [x] R2_ACCESS_KEY_ID знайдено в `.env`.
- [x] R2_SECRET_ACCESS_KEY знайдено в `.env`.
- [x] R2_BUCKET знайдено в `.env`.
- [x] R2_ENDPOINT знайдено в `.env`.
- [x] R2_PUBLIC_BASE_URL знайдено в `.env`.
- [x] TELEGRAM_BOT_TOKEN знайдено в `.env`.

## 2) Render: Backend (Web Service)
- [x] Додати `render.yaml` для бекенду і бота.
- [x] Створити Web Service з репозиторію.
- [x] Встановити Root Directory: `server`.
- [x] Build Command: `npm install`.
- [x] Start Command: `npm start`.
- [x] Додати env змінні з `.env.example`.
- [x] Додати `CORS_ORIGIN` і `APP_BASE_URL` з прод доменом.
- [ ] Перевірити `/health` на Render URL.

## 3) Telegram Bot (Render Web Service, webhook)
- [ ] Створити Web Service з репозиторію.
- [ ] Встановити Root Directory: `telegram-bot`.
- [ ] Build Command: `npm install`.
- [ ] Start Command: `npm run start:webhook`.
- [ ] Додати `BOT_MODE=webhook`, `WEBHOOK_URL`, `WEBHOOK_SECRET`.
- [ ] Додати `TELEGRAM_BOT_TOKEN`, `SERVER_API_URL`, `SERVER_API_KEY`.
- [ ] Перевірити `/health` і `/status` на Render URL.

## 4) Cloudflare Pages: Frontend
- [ ] Створити Pages проект з папки `client`.
- [ ] Build Command: `npm run build`.
- [ ] Output: `dist`.
- [ ] Додати `VITE_API_BASE_URL=https://api.<домен>`.
- [ ] Перевірити вебдодаток на Pages URL.

## 5) Cloudflare Cron Worker
- [ ] Заповнити `API_BASE_URL` і `SERVER_API_KEY` у `cloudflare/wrangler.toml`.
- [ ] Виконати `npx wrangler deploy` у папці `cloudflare`.
- [ ] Перевірити, що cron викликає `/api/reminders/run-check`.

## 6) DNS і HTTPS
- [ ] Додати CNAME `api` → Render backend URL.
- [ ] Додати CNAME root → Cloudflare Pages URL.
- [ ] Увімкнути proxy та HTTPS у Cloudflare.

## 7) Фінальна перевірка
- [ ] Web: логін, записи, профіль, завантаження файлів.
- [ ] API: `/health`, `/api/auth/login`, `/api/users/me`.
- [ ] Bot: реєстрація, вибір ролі, запис на сервіс.
- [ ] Reminders: cron виклик і логування.

## 8) Реліз і підтримка
- [ ] Увімкнути автодеплой на main.
- [ ] Додати моніторинг логів Render.
- [ ] Зафіксувати всі продакшн змінні середовища.
