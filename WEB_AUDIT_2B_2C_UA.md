# WEB аудит: 2B (функціонал) потім 2C (інтеграції)

Дата: 2026-04-13
Обсяг: тільки web (client + server)

---

## 0) Короткий підсумок

Цей аудит містить перелік незавершених / неузгоджених / ризикованих зон, що впливають на повноту функціоналу (пріоритет 2B), а потім — на інтеграції (пріоритет 2C). Для кожного пункту наведено короткий вплив і конкретну локацію в коді.

---

## 1) Пріоритет 2B — Основні фічі продукту / бізнес-процеси

### 1.1 Користувачі / ролі / адмін-панель

- [HIGH] В адмін-панелі не відображені всі наявні адмін-інструменти
  - Вплив: головний адмін/майстер не може відкрити частину екранів керування з UI.
  - Client:
    - `client/src/pages/AdminPanel.jsx`
    - Доступні компоненти (існують, але не підключені у вкладках):
      - `client/src/components/admin/ServicesManagement.jsx`
      - `client/src/components/admin/InsuranceManagement.jsx`
    - Поточні вкладки: Dashboard/Users/Vehicles/Appointments/ServiceRecords/Parts.

- [MEDIUM] Неузгоджені назви ролей (`master`, `admin`, `mechanic`)
  - Вплив: частина ендпоїнтів дозволяє/забороняє доступ на основі різних наборів ролей.
  - Приклади на сервері:
    - `server/routes/mechanics.js` використовує `['master','mechanic','admin']` у `ensurePrivileged`
    - `server/routes/services.js` та `server/routes/parts.js` використовують `checkAdmin`
    - `server/routes/serviceCategories.js` дозволяє `master/mechanic` для створення (без `checkAdmin`).

### 1.2 Зв’язки клієнт–майстер

- [HIGH] MyClients створює користувача з хардкодним паролем
  - Вплив: безпека + поламаний очікуваний онбординг.
  - Client:
    - `client/src/pages/MyClients.jsx` → `createClientWithRelationship()` використовує `password: '12345678'`.

- [MEDIUM] Сторінка MyMechanics використовує inline “Mock API calls” замість DAO
  - Вплив: дублювання логіки запитів/оновлення; складніше підтримувати.
  - Client:
    - `client/src/pages/MyMechanics.jsx`
  - На сервері ендпоїнти існують:
    - `server/routes/relationships.js`
    - `server/controllers/relationshipController.js`

### 1.3 Записи (кілька послуг, власність, узгодженість)

- [MEDIUM] Модель запису використовує і `service_id`, і `service_ids`
  - Вплив: ризик часткових оновлень / плутанина в UI.
  - Server:
    - `server/routes/appointments.js` обробляє обидва варіанти.
    - `server/controllers/appointmentController.js` нормалізує та будує `services_list`.

- [MEDIUM] Правила “призначений майстер” vs “власник” відрізняються залежно від ендпоїнта
  - Вплив: користувач може мати право перегляду/оновлення в одному флоу, але не мати його в іншому.
  - Server:
    - `server/routes/appointments.js` для update перевіряє лише `isMaster` або `isOwner`.
    - `server/controllers/vehiclePartsController.js` для запчастин у записі дозволяє `isOwner` OR `isAssignedMechanic` OR privileged.

### 1.4 Послуги / послуги майстра

- [LOW] Створення категорій послуг використовує кастомну перевірку ролей, тоді як глобальні послуги використовують `checkAdmin`
  - Вплив: неузгодженість політик.
  - Server:
    - `server/routes/serviceCategories.js` (`master/mechanic`)
    - `server/routes/services.js` (`checkAdmin`)

### 1.5 Каталог запчастин vs історія запчастин авто

- [MEDIUM] Реалізовано дві різні сутності, але назви в UI можуть плутати
  - Вплив: користувачам може бути незрозуміло, чим відрізняються:
    - глобальний каталог (`parts` table, тільки адмін)
    - історія по авто (`vehicle_parts` table)
  - Server:
    - `server/routes/parts.js` + `server/controllers/partsController.js`
    - `server/routes/vehicleParts.js` + `server/controllers/vehiclePartsController.js`
  - Client:
    - `client/src/pages/MyParts.jsx` використовує vehicle parts + OCR імпорт.

### 1.6 OCR для запчастин + номера

- [HIGH] Debug ендпоїнт OCR відкритий без авторизації
  - Вплив: будь-хто може завантажувати файли та запускати OCR.
  - Server:
    - `server/routes/ocr.js` → `POST /api/ocr/plate-debug` (без `auth`).

---

## 2) Пріоритет 2C — Інтеграції (web push, нагадування, Telegram/Viber)

### 2.1 Web Push (PWA)

- [OK] Service worker обробляє `push` та `notificationclick`
  - Client:
    - `client/src/sw.js`

- [OK] У клієнті є UI для увімкнення/вимкнення/тесту web push
  - Client:
    - `client/src/pages/Profile.jsx`
    - `client/src/api/dao/webPushDao.js`

- [OK] На сервері є VAPID + зберігання підписок + тестова відправка
  - Server:
    - `server/routes/webPush.js`
    - `server/services/webPushService.js`
  - Потрібні env:
    - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, опційно `VAPID_SUBJECT`.

- [MEDIUM] Немає єдиного застосування “налаштувань сповіщень”
  - Вплив: користувач може вимкнути сповіщення в UI, але сервер при відправці не перевіряє ці налаштування.
  - Пов’язано:
    - `client/src/pages/Profile.jsx` використовує `userSettingsDao` і зберігає налаштування
    - `server/services/reminderScheduler.js` відправляє push/webpush за простроченими нагадуваннями без перевірки налаштувань користувача.

### 2.2 Планувальник нагадувань / щомісячні запити пробігу / планове ТО

- [OK] Планувальник існує і може запускатися через cron
  - Server:
    - `server/services/reminderScheduler.js`
    - Увімкнений лише коли `SCHEDULER_ENABLED=true` (`server/index.js`).

- [MEDIUM] Перемикач “увімкнути/вимкнути нагадування” працює тільки локально
  - Вплив: перемикач в UI не впливає на відправку з бекенда (зберігається в `localStorage`).
  - Client:
    - `client/src/pages/Reminders.jsx` → `reminder_enabled_${id}` у localStorage.

- [MEDIUM] Ендпоїнти ручного запуску перевірок нагадувань досі доступні
  - Вплив: може бути зловживання, якщо витече API key; також дублює відповідальність планувальника.
  - Server:
    - `server/routes/reminders.js`:
      - `POST /api/reminders/run-check` (API key)
      - `POST /api/reminders/run-check-auth` (auth)

- [OPEN] “Щомісячний запит пробігу” та “нагадування про планове ТО” не виділені як окремі флоу
  - Знайдено: загальні нагадування + нотифікації.
  - Не знайдено (у web-обсязі): окремий планувальник щомісячних запитів пробігу + UI-флоу для відповіді на пробіг.

### 2.3 Telegram

- [OK] Існують серверні Telegram API routes (захищені API key)
  - Server:
    - `server/routes/telegram.js` використовує `server/middleware/apiKey.js` і далі `auth` на вибраних маршрутах.
    - `server/controllers/telegramController.js`

- [NOTE] Є окрема папка `telegram-bot/`
  - Вона поза web client/server обсягом, але є частиною репо і, ймовірно, використовується як runtime для реального бота.

### 2.4 Viber

- [GAP] Інтеграцію Viber не знайдено в web client/server коді
  - Пошук `viber` у `server/**/*.js` та `client/src/**/*` не дав збігів.

---

## 3) Швидкі рекомендації (за порядком)

1. Прибрати або захистити debug ендпоїнт OCR
   - `server/routes/ocr.js` (`/plate-debug`).

2. Замінити флоу з хардкодним паролем при створенні клієнта
   - `client/src/pages/MyClients.jsx`.

3. Додати відсутні вкладки AdminPanel (Services + Insurance) або прибрати невикористані компоненти
   - `client/src/pages/AdminPanel.jsx`.

4. Зробити увімкнення/вимкнення нагадувань керованим сервером (збереження в БД) або прибрати перемикач
   - `client/src/pages/Reminders.jsx` + server scheduler.

5. Визначитись та реалізувати інтеграцію Viber або прибрати її з роадмапи на цей етап.

---

## 4) Згадані файли

Server:
- `server/index.js`
- `server/routes/admin.js`
- `server/routes/appointments.js`
- `server/controllers/appointmentController.js`
- `server/routes/relationships.js`
- `server/controllers/relationshipController.js`
- `server/routes/reminders.js`
- `server/services/reminderScheduler.js`
- `server/routes/webPush.js`
- `server/services/webPushService.js`
- `server/routes/telegram.js`
- `server/controllers/telegramController.js`
- `server/routes/ocr.js`
- `server/routes/vehicleParts.js`
- `server/controllers/vehiclePartsController.js`

Client:
- `client/src/pages/AdminPanel.jsx`
- `client/src/components/admin/ServicesManagement.jsx`
- `client/src/components/admin/InsuranceManagement.jsx`
- `client/src/pages/MyClients.jsx`
- `client/src/pages/MyMechanics.jsx`
- `client/src/pages/Profile.jsx`
- `client/src/pages/Reminders.jsx`
- `client/src/pages/Notifications.jsx`
- `client/src/components/NotificationBell.jsx`
- `client/src/sw.js`
- `client/src/api/dao/notificationsDao.js`
- `client/src/api/dao/webPushDao.js`
