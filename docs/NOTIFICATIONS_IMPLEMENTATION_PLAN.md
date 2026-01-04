# План реалізації функціоналу сповіщень та нагадувань

## Поточний стан

### ✅ Вже реалізовано:
1. **База даних:**
   - Таблиці `notifications`, `scheduled_notifications`, `push_tokens`
   - Модель `Notification.js` з методами для взаємодії з БД
   - RLS політики для безпеки

2. **Серверна частина:**
   - Роути `/api/notifications` (частково)
   - Контролер для сповіщень (закоментований)
   - Структура для обробки push-сповіщень

3. **Мобільний додаток:**
   - Сервіси: `notificationsService.js`, `pushNotificationsService.js`, `reminderService.js`
   - Компоненти: `NotificationBell.js`, `NotificationsScreen.js`
   - Інтеграція з Expo Notifications
   - Реєстрація пристроїв для push-сповіщень

### ❌ Потребує доробки:
1. **База даних:**
   - Створити таблицю `reminders`
   - Додати індекси та RLS політики для `reminders`

2. **Серверна частина:**
   - Активувати закоментований код у роутах сповіщень
   - Реалізувати cron job для автоматичних нагадувань
   - Налаштувати відправку push-сповіщень через Expo

3. **Мобільний додаток:**
   - Доробити UI для створення/редагування нагадувань
   - Покращити інтеграцію з календарем
   - Додати локальні сповіщення

## План виконання

### Крок 1: Створення таблиці reminders у БД
**SQL запит для виконання:**
```sql
-- Створення таблиці reminders
CREATE TABLE reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    reminder_type VARCHAR(50) NOT NULL CHECK (reminder_type IN ('maintenance', 'inspection', 'insurance', 'custom')),
    reminder_date TIMESTAMP WITH TIME ZONE NOT NULL,
    mileage_threshold INTEGER,
    is_completed BOOLEAN DEFAULT FALSE,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_interval VARCHAR(20) CHECK (recurring_interval IN ('daily', 'weekly', 'monthly', 'yearly')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Індекси для оптимізації
CREATE INDEX idx_reminders_user_id ON reminders(user_id);
CREATE INDEX idx_reminders_vehicle_id ON reminders(vehicle_id);
CREATE INDEX idx_reminders_date ON reminders(reminder_date);
CREATE INDEX idx_reminders_type ON reminders(reminder_type);
CREATE INDEX idx_reminders_completed ON reminders(is_completed);

-- RLS політики
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminders" ON reminders
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reminders" ON reminders
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminders" ON reminders
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminders" ON reminders
FOR DELETE USING (auth.uid() = user_id);

-- Тригер для оновлення updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reminders_updated_at
    BEFORE UPDATE ON reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Крок 2: Активація серверного функціоналу
- Розкоментувати код у `server/routes/notifications.js`
- Додати роути для роботи з нагадуваннями
- Реалізувати cron job для перевірки нагадувань

### Крок 3: Налаштування push-сповіщень
- Налаштувати Expo Push Notifications на сервері
- Реалізувати відправку сповіщень за розкладом
- Додати обробку помилок та retry логіку

### Крок 4: Доробка мобільного UI
- Покращити `CreateReminderScreen.js`
- Додати можливість редагування нагадувань
- Інтегрувати з календарем пристрою
- Додати локальні сповіщення

### Крок 5: Тестування та оптимізація
- Протестувати всі сценарії використання
- Оптимізувати продуктивність
- Додати обробку помилок
- Перевірити переклади

## Технічні деталі

### Типи нагадувань:
- `maintenance` - технічне обслуговування
- `inspection` - техогляд
- `insurance` - страхування
- `custom` - користувацькі нагадування

### Інтервали повторення:
- `daily` - щоденно
- `weekly` - щотижня
- `monthly` - щомісяця
- `yearly` - щороку

### Push-сповіщення:
- Використання Expo Push Notifications
- Збереження токенів у таблиці `push_tokens`
- Обробка помилок доставки
- Retry механізм для невдалих відправок

## Залежності

### Серверні:
- `node-cron` - для планування завдань
- `expo-server-sdk` - для відправки push-сповіщень

### Мобільні:
- `expo-notifications` - для локальних та push-сповіщень
- `expo-calendar` - для інтеграції з календарем
- `@react-native-async-storage/async-storage` - для збереження налаштувань

## Безпека

- Всі операції з нагадуваннями захищені RLS політиками
- Валідація даних на клієнті та сервері
- Шифрування чутливих даних
- Обмеження частоти запитів (rate limiting)

## Моніторинг

- Логування всіх операцій з сповіщеннями
- Метрики доставки push-сповіщень
- Аналітика використання функціоналу
- Алерти при помилках системи

Дата створення: " + new Date().toISOString().split('T')[0] + "
Статус: В розробці