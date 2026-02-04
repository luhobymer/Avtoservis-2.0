# Avtoservis Server

Серверна частина додатку для управління станціями технічного обслуговування автомобілів.

## Технології

- Node.js
- Express.js
- Cloudflare D1 (SQLite)
- JWT для автентифікації
- Winston для логування

## Встановлення

1. Клонуйте репозиторій:
```bash
git clone https://github.com/your-username/avtoservis.git
cd avtoservis/server
```

2. Встановіть залежності:
```bash
npm install
```

3. Створіть файл .env з наступними змінними:
```env
NODE_ENV=development
PORT=5001

JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

## Cloudflare D1
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_D1_DATABASE_ID=your-d1-database-id
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token

# (опційно) Явний режим роботи з БД
# D1_MODE=d1|fallback

# API key for trusted integrations (Telegram bot etc.)
SERVER_API_KEY=your-shared-server-api-key

CORS_ORIGIN=http://localhost:3000

LOG_LEVEL=info
LOG_FILE_ERROR=logs/error.log
LOG_FILE_COMBINED=logs/combined.log
```

4. Схема БД:

- При старті сервера схема з `d1_schema.sql` застосовується автоматично (для D1 та fallback SQLite).
- Окремої команди міграцій наразі немає.

5. Заповніть базу тестовими даними:
```bash
npm run seed
```

6. Імпорт прайсу (ціна/час) у `services`:
```bash
node scripts/seed_price_list.js
```

## Запуск

### Розробка
```bash
npm run dev
```

### Продакшн
```bash
npm start
```

## API Endpoints

### Автентифікація
- POST /api/auth/register - Реєстрація нового користувача
- POST /api/auth/login - Вхід в систему
- GET /api/auth/me - Отримання даних поточного користувача

### Станції ТО
- GET /api/stations - Отримання списку станцій
- GET /api/stations/:id - Отримання інформації про станцію
- POST /api/stations - Створення нової станції (адмін)
- PUT /api/stations/:id - Оновлення інформації про станцію (адмін)
- DELETE /api/stations/:id - Видалення станції (адмін)

### Послуги
- GET /api/services - Отримання списку послуг
- GET /api/services/:id - Отримання інформації про послугу
- POST /api/services - Створення нової послуги (адмін)
- PUT /api/services/:id - Оновлення інформації про послугу (адмін)
- DELETE /api/services/:id - Видалення послуги (адмін)

### Записи на обслуговування
- GET /api/appointments - Отримання списку записів
- GET /api/appointments/:id - Отримання інформації про запис
- POST /api/appointments - Створення нового запису
- PUT /api/appointments/:id - Оновлення статусу запису
- DELETE /api/appointments/:id - Скасування запису

### Механіки
- GET /api/mechanics - Отримання списку механіків
- GET /api/mechanics/me - Отримання «поточного» механіка для master/mechanic користувача
- GET /api/mechanics/:id - Отримання інформації про механіка
- POST /api/mechanics - Додавання нового механіка (адмін)
- PUT /api/mechanics/:id - Оновлення інформації про механіка (адмін)
- DELETE /api/mechanics/:id - Видалення механіка (адмін)

### Автомобілі
- GET /api/vehicles - Отримання списку автомобілів користувача
- GET /api/vehicles/:vin - Отримання інформації про автомобіль
- POST /api/vehicles - Додавання нового автомобіля
- PUT /api/vehicles/:vin - Оновлення інформації про автомобіль
- DELETE /api/vehicles/:vin - Видалення автомобіля

## Тестування

```bash
# Запуск всіх тестів
npm test

# Запуск тестів в режимі спостереження
npm run test:watch
```

## Lint

```bash
# Перевірка коду
npm run lint

# Автоматичне виправлення помилок
npm run lint:fix
```
