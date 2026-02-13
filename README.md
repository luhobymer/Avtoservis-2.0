# Avtoservis 2.0

Веб + сервер для управління автосервісом: клієнти, авто, записи, послуги, механіки.

## Запуск (dev)

1. Встановити залежності:

```bash
npm run install:all
```

2. Створити `.env` у корені (приклад змінних див. `server/README.md`).

3. Запустити все разом:

```bash
npm run dev:full
```

Клієнт: `http://127.0.0.1:5173`

## Деплой (поточний підхід)

### 1) Підготовка інфраструктури

- Створити акаунт Cloudflare та під’єднати домен.
- Створити D1 базу для продакшну.
- Підготувати API токен з доступом до Pages, Workers, D1, R2 та DNS (якщо домен в Cloudflare).

### 2) Фронтенд (Cloudflare Pages)

- Створити Pages проєкт із цієї репозиторії, папка `client`.
- Build command: `npm run build`
- Build output: `dist`
- Environment variables:
  - `VITE_API_BASE_URL=https://api.<ваш-домен>` (URL бекенда)

#### Деплой через Wrangler
```bash
npx wrangler pages project list
npx wrangler pages deploy client/dist --project-name <pages-project>
```

### 3) Бекенд (Express)

**Варіант A — швидкий запуск (Node-хостинг + Cloudflare DNS/Proxy)**  
Піднімаємо сервер на будь-якому Node-хостингу, а домен і TLS робить Cloudflare.

- Налаштувати DNS запис `api.<ваш-домен>` і ввімкнути proxy.
- На хостингу задати змінні середовища з `.env.example` +:
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_API_TOKEN` (або `CLOUDFLARE_API_TOKEN_D1`)
  - `CLOUDFLARE_D1_DATABASE_ID`
  - `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`
  - `R2_PUBLIC_BASE_URL` (опційно)
  - `CORS_ORIGIN=https://<ваш-домен>`
  - `APP_BASE_URL=https://<ваш-домен>`
  - `SERVER_API_KEY` (для запуску cron-ендпоінта)
- При старті сервера схема з `d1_schema.sql` застосовується автоматично.

**Варіант B — повний Cloudflare стек (потрібен рефакторинг)**  
Ціль: перенести бекенд на Workers + D1 + R2.

- Замінити збереження файлів з локального `server/public/uploads` на Cloudflare R2.
- Перенести планувальник нагадувань на Cloudflare Cron Triggers.
- Переписати Express-роути під Workers-сумісний рантайм (наприклад, Hono).

**Статус:**
- Вже додано R2-завантаження в бекенд.
- Додано захищений ендпоінт `/api/reminders/run-check` під Cron.

### 4) Cron для нагадувань (Workers)
У папці `cloudflare/` є worker для запуску `/api/reminders/run-check`.

1) Заповнити змінні в `cloudflare/wrangler.toml`:
- `API_BASE_URL=https://api.<ваш-домен>`
- `SERVER_API_KEY=<ваш-ключ>`

2) Деплой:
```bash
cd cloudflare
npx wrangler deploy
```

### 5) План міграції на Render
Детальний чекліст: [docs/DEPLOY_RENDER_PLAN.md](./docs/DEPLOY_RENDER_PLAN.md)
Blueprint для Render: [render.yaml](./render.yaml)
Поточний статус: бекенд вже на Render, бот буде розгорнуто пізніше на іншому хостингу.

## Прайс послуг

- Імпорт цін/часу з прайсу: див. `docs/PRICE_LIST.md`.
