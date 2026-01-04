# 📋 Керівництво з впровадження оновлень Автосервіс

## 🎯 Огляд

Це керівництво допоможе вам впровадити всі необхідні оновлення для повноцінної роботи системи автосервісу, включаючи:

- ✅ Додавання відсутніх таблиць бази даних
- ✅ Заповнення послуг та налаштування RLS політик
- ✅ Налаштування API маршрутів та CORS
- ✅ Виправлення Express сервера

## 📁 Створені файли

1. `add_missing_services.sql` - Додавання відсутніх послуг
2. `add_rls_policies.sql` - RLS політики безпеки
3. `create_reminders_table.sql` - Таблиця нагадувань
4. `create_notifications_table.sql` - Таблиця повідомлень
5. `create_service_records_table.sql` - Детальні записи обслуговування
6. `setup_supabase_api_cors.sql` - API функції та CORS
7. `fix_express_routing_cors.js` - Оновлений Express сервер

## 🚀 Порядок впровадження

### Крок 1: Оновлення бази даних

#### 1.1 Додавання відсутніх послуг
```bash
# Виконайте в Supabase SQL Editor або через psql
psql -h your-supabase-host -U postgres -d postgres -f add_missing_services.sql
```

#### 1.2 Створення таблиці нагадувань
```bash
psql -h your-supabase-host -U postgres -d postgres -f create_reminders_table.sql
```

#### 1.3 Створення таблиці повідомлень
```bash
psql -h your-supabase-host -U postgres -d postgres -f create_notifications_table.sql
```

#### 1.4 Створення таблиці детальних записів
```bash
psql -h your-supabase-host -U postgres -d postgres -f create_service_records_table.sql
```

#### 1.5 Додавання RLS політик
```bash
psql -h your-supabase-host -U postgres -d postgres -f add_rls_policies.sql
```

#### 1.6 Налаштування API функцій
```bash
psql -h your-supabase-host -U postgres -d postgres -f setup_supabase_api_cors.sql
```

### Крок 2: Оновлення Express сервера

#### 2.1 Резервне копіювання поточного сервера
```bash
cp server/index.js server/index.js.backup
```

#### 2.2 Заміна коду сервера
```bash
# Скопіюйте вміст fix_express_routing_cors.js в server/index.js
cp fix_express_routing_cors.js server/index.js
```

#### 2.3 Встановлення залежностей
```bash
cd server
npm install @supabase/supabase-js cors helmet express-rate-limit dotenv
```

#### 2.4 Налаштування змінних середовища
Створіть або оновіть файл `server/.env`:
```env
# Supabase налаштування
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Сервер налаштування
PORT=3001
NODE_ENV=development

# Frontend URL для CORS
FRONTEND_URL=http://localhost:3000
```

### Крок 3: Перевірка впровадження

#### 3.1 Перевірка бази даних
```sql
-- Перевірте створені таблиці
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('reminders', 'notifications', 'service_records');

-- Перевірте кількість послуг
SELECT category, COUNT(*) as count 
FROM services 
GROUP BY category 
ORDER BY count DESC;

-- Перевірте RLS політики
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';
```

#### 3.2 Перевірка API функцій
```sql
-- Перевірте створені функції
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE 'get_user_%';

-- Перевірте представлення
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name LIKE 'api_%';
```

#### 3.3 Запуск та тестування сервера
```bash
# Запустіть сервер
cd server
npm start

# Перевірте здоров'я API
curl http://localhost:3001/api/health

# Перевірте публічні ендпоінти
curl http://localhost:3001/api/stations
curl http://localhost:3001/api/services
```

## 🔧 Налаштування Supabase

### Увімкнення RLS
```sql
-- Увімкніть RLS для всіх таблиць
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_records ENABLE ROW LEVEL SECURITY;
```

### Налаштування автентифікації
1. Перейдіть в Supabase Dashboard
2. Authentication → Settings
3. Увімкніть "Enable email confirmations"
4. Налаштуйте "Site URL" на ваш frontend URL
5. Додайте "Redirect URLs" для вашого додатку

## 📊 Моніторинг та логування

### Перевірка логів сервера
```bash
# Дивіться логи в реальному часі
tail -f server/logs/combined.log

# Перевірте помилки
grep "ERROR" server/logs/error.log
```

### Моніторинг бази даних
```sql
-- Статистика використання таблиць
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_tup_ins DESC;

-- Активні з'єднання
SELECT count(*) as active_connections
FROM pg_stat_activity
WHERE state = 'active';
```

## 🐛 Усунення неполадок

### Поширені проблеми

#### 1. CORS помилки
```javascript
// Перевірте налаштування CORS в server/index.js
// Додайте ваш frontend URL до allowedOrigins
const allowedOrigins = [
  'http://localhost:3000',
  'https://your-frontend-domain.com'
];
```

#### 2. Помилки автентифікації
```bash
# Перевірте змінні середовища
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# Перевірте токен в запиті
curl -H "Authorization: Bearer your-jwt-token" http://localhost:3001/api/users/me
```

#### 3. Помилки бази даних
```sql
-- Перевірте права доступу
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'users';

-- Перевірте RLS політики
SELECT * FROM pg_policies WHERE tablename = 'users';
```

#### 4. Помилки API
```bash
# Перевірте статус сервера
curl -I http://localhost:3001/api/health

# Перевірте логи помилок
tail -n 50 server/logs/error.log
```

## 📈 Оптимізація продуктивності

### Індекси бази даних
```sql
-- Перевірте використання індексів
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Кешування
```javascript
// Додайте Redis для кешування в server/index.js
const redis = require('redis');
const client = redis.createClient();

// Кешування публічних даних
app.get('/api/services', async (req, res) => {
  const cached = await client.get('services');
  if (cached) {
    return res.json(JSON.parse(cached));
  }
  // ... отримання з бази даних
  await client.setex('services', 3600, JSON.stringify(data));
});
```

## 🔒 Безпека

### Рекомендації
1. Регулярно оновлюйте залежності: `npm audit fix`
2. Використовуйте HTTPS в продакшені
3. Налаштуйте rate limiting для API
4. Регулярно перевіряйте логи на підозрілу активність
5. Використовуйте сильні паролі для бази даних

### Резервне копіювання
```bash
# Створення резервної копії бази даних
pg_dump -h your-supabase-host -U postgres -d postgres > backup_$(date +%Y%m%d).sql

# Відновлення з резервної копії
psql -h your-supabase-host -U postgres -d postgres < backup_20240101.sql
```

## 📞 Підтримка

Якщо у вас виникли проблеми:

1. Перевірте логи сервера та бази даних
2. Переконайтеся, що всі змінні середовища налаштовані правильно
3. Перевірте статус Supabase сервісів
4. Переглядайте документацію Supabase та Express.js

## ✅ Чек-лист впровадження

- [ ] Виконано всі SQL скрипти
- [ ] Оновлено Express сервер
- [ ] Налаштовано змінні середовища
- [ ] Перевірено API ендпоінти
- [ ] Протестовано автентифікацію
- [ ] Налаштовано CORS
- [ ] Перевірено RLS політики
- [ ] Створено резервну копію
- [ ] Налаштовано моніторинг

---

**Успішного впровадження! 🚀**