# План переробки «Автосервіс 2.0» у режим без серверного вузла API (Supabase online-first)

## 1. Мета та обмеження

- Онлайн робота напряму через Supabase (Auth + PostgREST + Storage) без нашого Node.js API.
- Збереження поточного UX та багатомовності (uk/ru/en) і всіх сценаріїв; таблиці БД лишаються без змін.
- Підтримка мобільних платформ Android та iOS (Expo/EAS), а також браузера через Expo Web.
- Безпека: RLS політики у БД, клієнтські JWT сесії Supabase; у мобільному/веб — тільки `anon` ключ.
- Push зі стороннього сервера — опційно; базові нагадування через локальні нотифікації.

## 2. Поточний стан (огляд)

- Фреймворк: `Expo` + `React Native` (`mobile/package.json`).
- Локалізація: `i18next` з файлами `mobile/locales/**/translation.json`.
- Мережевий шар: `axios` через `mobile/api/axiosConfig.js`; екранні запити у низці `screens/*.js` через `fetch('/api/...')`.
  - Приклади викликів:
    - `mobile/screens/VehicleList.js:34` — `axiosAuth.get('/api/vehicles')`.
    - `mobile/screens/AddVehicle.js:555` — `fetch('/api/vehicles', { method: 'POST', ... })`.
    - `mobile/context/AuthContext.js:92` — `axiosAuth.post('/api/users/login', ...)`.
- Офлайн-патерни вже присутні частково: кешування, `offlineVehicles`, локальні нагадування та fallback-дані (`vehicleCatalogApi`).

## 3. Цільова архітектура (online-first, Supabase direct)

### 3.1. Зберігання даних

- Базові сховища:
  - `SecureStore` — токени/профілі/налаштування доступу.
  - `AsyncStorage` — доменні сутності та індекси: `vehicles`, `service_records`, `appointments`, `notifications`, `parts`, `services`, `user_settings`, `interactions`.
- Ключі/структури:
  - `vehicles`: масив об’єктів `{ id, make_id, model_id, ... }`.
  - `service_records`: масив `{ id, vehicle_id, date, works[], totalCost }`.
  - `appointments`: масив `{ id, vehicle_id, status, date, slot }`.
  - `notifications`: масив `{ id, title, message, is_read, created_at, is_local }`.
  - `users_settings`: об’єкт з прапорами та перевагами.
- Опція: перехід на SQLite (`expo-sqlite`) для складніших запитів і акуратної валідації, з міграціями у стартовому етапі. На першій ітерації лишаємо `AsyncStorage` + індексацію в пам’яті.

#### 3.1.1. Дзеркало таблиць (узгодження з БД)

- Клієнтські модулі працюють без зміни схем БД; поля та зв’язки відповідають існуючим таблицям (`vehicles`, `service_history`, `appointments`, `notifications`, `services`, `mechanics`, `parts`, `repair_works`, `repair_parts`, `payments`, `service_stations`).
- Ідентифікатори (`uuid`/`bigint`) та ключові зв’язки (`vehicle_vin`, `user_id`) зберігаються.

### 3.2. Доступ до даних

- Клієнтський DAO поверх Supabase:
  - Для мобільного/веб: `supabase-js` або прямий `PostgREST` через `axios` з `anon` ключем.
  - Для бота: `service_role` ключ тільки у середовищі бота; чутливі операції — через RPC з перевірками.
- Екрани заміняють `fetch('/api/...')`/`axiosAuth` на запити Supabase (select/insert/update/delete).

### 3.3. Автентифікація та ролі

- Використовуємо Supabase Auth (email+password, інші провайдери за потреби).
- `AuthContext` переходить з `/api/users/login` на `supabase.auth.signInWithPassword`.
- Ролі (`role`) зберігаються у таблиці `users`; доступ контролюється RLS.

### 3.4. Сповіщення та нагадування

- Локальні сповіщення (`expo-notifications`); серверні push — опційно через сторонні сервіси (не наш API).

### 3.5. Аналітика та статистика

- `AdminStatisticsScreen` та інші екрани роблять агрегації через запити Supabase (фільтри/group) або на клієнті після вибірки.

### 3.6. OCR та імпорт

- OCR (`tesseract.js`) вже локальний — зберігаємо.
- Імпорт/експорт даних (бекап) через `expo-file-system` та `expo-sharing`:
  - Експорт JSON zip всіх сутностей.
  - Імпорт із файлу (з перевіркою версії схеми).

### 3.7. Безпека

- Конфіденційне — у `SecureStore`. Для великих масивів — опційне шифрування (`crypto-browserify`): AES-256-GCM над JSON перед записом у `AsyncStorage`.
- Мінімізація витоків: жодних сторонніх URL/ключів, scrub логів у проді.

## 4. План змін по модулях

### 4.1. Конфігурація

- `mobile/app.json` → додати `expo.extra.SUPABASE_URL`, `expo.extra.SUPABASE_ANON_KEY` (реальні значення підставляти на збірці; не комітити секрети).
- `supabaseClient` або оновлення `axiosConfig` для PostgREST:
  - Ініціалізувати клієнт з `SUPABASE_URL` і `SUPABASE_ANON_KEY`.
  - `isTokenValid()` спирається на `supabase.auth.getSession()`.
  - Прибрати залежність від Node API (`/api/*`).

### 4.2. AuthContext

- `mobile/context/AuthContext.js`:
  - `loadAuthData()` — отримувати активну сесію з Supabase.
  - `login()`/`register()` — `supabase.auth.signInWithPassword` / `signUp`.
  - `getToken()` — брати `access_token` із `supabase.auth.getSession()`.

### 4.3. Клієнтський DAO (Supabase)

- Створити модулі:
  - `mobile/api/dao/vehiclesDao.js`
  - `mobile/api/dao/serviceHistoryDao.js`
  - `mobile/api/dao/appointmentsDao.js`
  - `mobile/api/dao/notificationsDao.js`
  - `mobile/api/dao/servicesDao.js`
  - `mobile/api/dao/mechanicsDao.js`
  - `mobile/api/dao/partsDao.js`
- Кожен DAO: select/insert/update/delete напряму у Supabase з мапінгом на поля таблиць.

### 4.4. Екрани, що використовують `fetch('/api/...')`

- Замінити на виклики відповідних DAO Supabase. Цільові місця (неповний список):
  - `mobile/screens/AdminStatisticsScreen.js:23,31` — `/api/admin/statistics` → локальні агрегації.
  - `mobile/screens/AppointmentsManagementScreen.js:17` — `/api/admin/appointments` → `appointmentsRepository.list()`.
  - `mobile/screens/PartsManagementScreen.js:26,62,94,134` — `/api/admin/parts` → `partsRepository`.
  - `mobile/screens/ServicesManagementScreen.js:25,61,92,131` — `/api/admin/services` → `servicesRepository`.
  - `mobile/screens/UsersManagementScreen.js:17,48,70` — `/api/admin/users...` → `usersRepository` (локальні ролі).
  - `mobile/screens/ServiceRecordsScreen.js:16` — `/api/service-records` → `serviceRecordsRepository`.
  - `mobile/screens/VehicleDetails.js:22,53` — `/api/vehicles/:id` → `vehiclesRepository.get/update`.
  - `mobile/screens/EditVehicle.js:278` — `PUT /api/vehicles/:id` → `vehiclesRepository.update`.
  - `mobile/screens/CreateReminderScreen.js:32,70` — `/api/service-reminders` → `notificationsRepository + scheduler`.
  - `mobile/screens/NotificationsScreen.js:78,112` — `/api/notifications...` → `notificationsRepository`.

### 4.5. `VehicleList` та `AddVehicle`

- `mobile/screens/VehicleList.js:34` — читання з `vehiclesDao.listByUser()` (фільтр за `auth.uid`).
- `mobile/screens/AddVehicle.js:555,578` — створення через `vehiclesDao.create(...)`.

### 4.6. Сповіщення

- `mobile/api/notificationsService.js` — локальні нотифікації (`scheduleNotificationAsync`); серверні push — окремо.
 - Перенесено на Supabase:
   - Отримання сповіщень користувача: `supabase.from('notifications').select`.
   - Позначення прочитаним/усіх прочитаними: `update { is_read: true }`.
   - Видалення одного/всіх сповіщень: `delete().eq('id'| 'user_id')`.
  - Заплановані нагадування: вставка у `scheduled_notifications` замість HTTP POST.
  - `mobile/api/notificationsApi.js` переведено на Supabase (`select/update/delete/count`).
 - Збережено офлайн-логіку: мердж з локальним кешем `AsyncStorage` та fallback при помилках мережі.
 - Push-токени (`push_tokens`) додамо пізніше — відкладено.

### 4.7. Статистика та графіки

- `AdminStatisticsScreen` — агрегації через Supabase або на клієнті після вибірки.

### 4.8. Навігація та ролі

- `mobile/navigation/AppNavigator.js` — джерело істини ролі з `AuthContext` (Supabase сесія), валідація доступу на рівні екранів.

## 5. Міграції даних

- На старті застосунку:
  - Перенести старі ключі (`offlineVehicles`, тощо) у нові структури репозиторіїв.
  - Додати `schemaVersion` у загальному ключі `app_state`, щоб керувати майбутніми міграціями.

## 6. UI/UX та конфлікти

- Показувати офлайн-статус.
- Для редагувань — оптимістичні оновлення у репозиторії.
- Конфлікти мінімальні (один користувач, один девайс). Якщо з’явиться синхронізація у майбутньому — додати правила мерджу «останній виграш» або мітки змін.

### 6.1. Поточна реалізація офлайн (online-first + fallback)

- Адмін‑екрани показують банер офлайн‑режиму за `NetInfo` та прапорцем `offline_mode`.
- DAO інструментовано для online‑first з прозорим fallback на `AsyncStorage`:
  - `admin_parts` / `admin_services` / `admin_users` / `admin_appointments` / `admin_vehicles`.
  - Операції create/update/delete у офлайні записуються локально; UI відображає зміни відразу.
- Мікро‑синхронізація при поверненні мережі:
  - Запчастини: синхронізація офлайн‑створених (`offline_*`) та `unsynced` оновлень у `listAll()`.
  - Послуги: синхронізація офлайн‑створених та `unsynced` оновлень у `listAll()`.
  - Користувачі: застосування `unsynced` статусу/ролі у `listAll()`.
  - Записи: застосування `unsynced` статусу у `listAdmin()`.
- UI маркує локально змінені елементи бейджем «Локально змінено» (`admin.common.unsynced`).

### 6.2. Оновлення: відмова від офлайн‑синхронізації (online‑first)

- Офлайн‑режим у клієнті вилучено. Екрани працюють онлайн через DAO/Supabase без кешів/черг.
- Прибрано офлайн‑банери, індикатори синхронізації та мітки `unsynced` на адмін‑екранах.
- Видалено використання `NetInfo`/`AsyncStorage` у клієнтських екранах для фолбеків.
- Наступні кроки: вилучити офлайн‑fallback та черги із DAO, де вони ще залишилися; депрекейтнути модуль `mobile/api/syncQueue.js`.

Виконано:
- Створено модуль `mobile/api/syncQueue.js` з `enqueue()` та `process()`.
- Підключено DAO до черги: parts/services/users/appointments додають операції у офлайні.
- Запуск `process()` при відновленні мережі через `NetInfo` у адмін‑екранах.
- Додано індикатор прогресу синхронізації на адмін‑екранах з лічильником черги.
 - Реалізовано історію синхронізацій з переглядом у адмін‑екранах (Services/Parts).
 - Уніфіковано `axios` конфігурацію, прибрано `mobile/api/axiosConfig.js.temp`.
 - `appointmentsService` переведено на онлайн‑режим без моків; формування `vehicle_info` з `vehicles`.
 - Модуль сервісних записів переведено на Supabase: 
   - `service_records` використовує поля `vehicle_id, description, service_date, mileage, cost`.
   - Оновлено `ServiceRecordsScreen`, `ServiceRecordDetails`, `EditServiceRecord`, `createServiceRecord`.
   - Прибрано виклик Node API з `EditServiceRecord`, замінено на Supabase.

- Прибрано мок‑дані та офлайн‑фолбеки у мобільному застосунку (online‑first):
  - `mobile/api/vehicleCatalogApi.js` — вилучено тестові марки/моделі/роки; при помилці повертаються порожні масиви.
  - `mobile/api/reminderService.js` — прибрано `getMockReminders()`; дані нормалізовано під UI.
  - `mobile/api/notificationsApi.js` — прибрано `getMockNotifications()`; поля уніфіковано (`createdAt`, `read`).
  - `mobile/api/interactionService.js` — прибрано тестові взаємодії з catch; на помилку повертається `[]`.
  - `mobile/screens/NewInteractionScreen.js` — замість моків використовуються `usersDao`, `vehiclesService`, `appointmentsApi`; додано ключі перекладу.
  - `mobile/screens/EditVehicle.js` — вилучено офлайн‑збереження у `AsyncStorage`; оновлення через `vehiclesService.updateVehicle()`; повідомлення про помилку мережі.

- Переклад оновлено (`uk/en/ru`): додано секцію `interactions`, ключ `validation.invalid_year`, та повідомлення `vehicles.update_error` і `vehicles.recognizing`.

## 7. Тестування та перевірка

- Юніт-тести репозиторіїв: CRUD, індекси, агрегації (`jest`).
- Інтеграційні тести екранів: `@testing-library/react-native` — перевірка списків/форм.
- E2E (Detox) для ключових сценаріїв входу, додавання авто, перегляду історії, нагадувань (див. `docs/TESTING_AND_DEBUGGING.md`).

## 8. Реліз та конфігурація

- Expo/EAS: збірки для Android/iOS.
- Перевірити пермішени в `mobile/app.json` (камера, медіа, нотифікації) — вже налаштовано.
- Веб-версія: обмежити камеру/нотифікації за підтримкою браузера.

## 9. Безпекові рекомендації

- Шифрувати великі JSON у `AsyncStorage` при зберіганні чутливої інформації.
- Не логувати приватні поля у проді.
- Файли бекапів — з попередженням користувача.

## 10. Дорожня карта (ітерації)

### Ітерація 1: Інтеграція Supabase у мобільний/веб

- Додати `SUPABASE_URL` і `SUPABASE_ANON_KEY` у `app.json.extra` (реальні значення підставляти при збірці).
- Створити `supabaseClient` у `mobile/api/` або налаштувати `axios` до PostgREST.
- `AuthContext` → замінити логін/реєстрацію на `supabase.auth.*`, адаптувати `isTokenValid()`.
- `VehicleList`/`AddVehicle` → замінити `/api/*` на DAO Supabase.

Виконано у межах ітерації:
- `userSettingsService` → прямі запити до `public.user_settings` (читання/збереження).
- `scheduleService` → прямі запити до `appointments` та інтеграція `mechanic_busy_status` (читання/запис статусу).
- `vehiclesService` → переведено на Supabase (через `vehiclesDao`), вилучено `axiosAuth`.
- `RemindersWidget` → використовує `vehiclesApi.getUserVehicles(user.id)` замість `vehiclesService`.
- `reminderService` → переведено на Supabase (`reminders` + локальне планування), оновлення `notification_sent`.
- `pushNotificationsService` → реєстрація токена у `public.push_tokens` (Supabase upsert), тригер на `public.notifications` для відправки через Expo Push API.
 - `vehicleCatalogApi` → переведено на Supabase (`vehicle_makes`/`vehicle_models`) з тестовим фолбеком.
 - `AuthContext.logout` → на `supabase.auth.signOut` + очищення SecureStore/AsyncStorage.
 - `TwoFactorSetupScreen` → прибрано `axiosAuth`, тимчасово показ помилок через переклад (`2fa.setup_error`, `2fa.verification_error`).
 - `ServiceBookScreen` → отримання авто через `vehiclesService.getAllVehicles()` замість `/api/vehicles`.
  - `admin/UsersManagementScreen` → читання користувачів напряму з `users` (Supabase select/order).
  - `admin/ServicesManagementScreen` → читання послуг напряму з `services` (Supabase select/order).
  - `admin/PartsManagementScreen` → читання запчастин напряму з `parts` (Supabase select/order).

### Ітерація 2: Перенесення інших екранів

- Замінити виклики `/api/admin/*`, `/api/service-records`, `/api/notifications` на DAO Supabase.
- Виконано: модуль сповіщень (`notificationsService`) переведено на Supabase (`select/update/delete/insert` для запланованих); push-токени — збереження у `public.push_tokens`, відправка — через тригер/Edge Function.
- Додати селективні індекси/фільтри у запитах для продуктивності.

Виконано в рамках цієї ітерації (додатково до початкового плану):
- Офлайн‑банер та `offline_mode` на адмін‑екранах.
- DAO з офлайн‑fallback для послуг, запчастин, користувачів, записів, авто.
- Мікро‑синхронізація офлайн‑доданих/оновлених елементів (parts/services/users/appointments).
- Debounce пошуку та фільтри статусу/ролей на адмін‑списках.

### Ітерація 3: Бот та адміністрування

- Бот: підключення напряму до Supabase з `service_role` ключем у середовищі бота; чутливі операції — через RPC.
- Адмін-панелі: ті самі DAO з перевіркою ролі (`users.role='admin'`).

### Ітерація 4: Безпека та аудит

- Завершити RLS по всіх таблицях; додати аудит доступів (опційно `audit_logs`).
- Мінімізувати витік ключів; для мобільного/веб — тільки `anon`.

## 11. Критерії приймання

- Додаток/веб/бот працюють онлайн напряму з Supabase; жодних залежностей від нашого Node API.
- Користувач може:
  - Створити/редагувати/видалити авто та записи обслуговування.
  - Переглядати історію, статистику, отримувати нагадування.
  - Доступ та дані обмежені RLS політиками згідно ролі.

## 12. Примітки щодо перекладу

- Усі нові тексти додати до `mobile/locales/*/translation.json`.
- Перевірити ключі для нових розділів (бекап, офлайн-статус, ролі, репозиторії).

## 13. Операційний чек-лист реалізації

1. Прибрати спадок Node.js API та axios:
   - Спрощення `mobile/api/axiosConfig.js` до утиліт (`isTokenValid`, `clearAuthData`) без згадок про Node `/api`.
   - Перевірка всіх залишкових використань `/api/...` у мобільному коді (screens/api), повна відмова від HTTP-запитів на наш Node-сервер.
   - Оновлення та чистка тестів, які ще очікують `axiosAuth` чи Node API.

2. Відмова від офлайн-черг та fallback:
   - Аналіз і вилучення використання `mobile/api/syncQueue.js` у DAO (parts/services/users/appointments/vehicles).
   - Видалення полів/станів `offline_*`, `unsynced` та логіки мікро-синхронізації з DAO.
   - Очищення UI від банерів offline-режиму, бейджів «локально змінено» та індикаторів черги, залишаємо лише стандартну обробку помилок мережі (online-first).

3. Повний аудит екранів з переходом на DAO/Supabase:
   - `AdminStatisticsScreen`, `ServiceRecordsScreen`, `ServiceRecordDetails`, `EditServiceRecord`, `CreateServiceRecord`.
   - `VehicleDetails`, `EditVehicle`, `VehicleList`, `VehiclesScreen`, `ServiceBookScreen`.
   - `CreateReminderScreen`, `ServiceRemindersScreen`, `RemindersWidget`, `NotificationsScreen`, `InteractionsScreen`, інші екрани з розділу 4.4 плану.
   - Для кожного екрану: тільки сервіси/DAO на Supabase, жодних `fetch`/`axios` напряму; усі повідомлення через ключі перекладу.

4. Міграції даних у AsyncStorage та SecureStore:
   - Перевірка та розширення `ensureAppStateMigrated()` у `AuthContext` для перенесення/очищення старих ключів (`offlineVehicles`, кеші адмін-DAO тощо).
   - Аудит усіх використань `AsyncStorage`: що чутливе → у `secureStorage`, великі не-чутливі масиви вирівняти під структури з розділу 3.1.

5. Безпека (ключі, RLS, аудит):
   - Винесення реальних `SUPABASE_URL`/`SUPABASE_ANON_KEY` у секрети збірки (EAS/CI), відсутність секретів у Git.
   - Перевірка та завершення RLS-політик по всіх таблицях, які використовують DAO (доступ по `auth.uid()`, ролі користувача).
   - За потреби — додавання таблиці `audit_logs` та тригерів для фіксації чутливих змін.

6. Тестування:
   - Юніт-тести для всіх DAO та сервісів Supabase (`vehiclesDao`, `appointmentsDao`, `partsDao`, `notificationsService`, `reminderService`, `scheduleService`, `userSettingsService`).
   - Інтеграційні тести для ключових екранів (автентифікація, VehicleList/AddVehicle, історія обслуговування, нагадування, сповіщення, базові адмін-списки).
   - Актуалізація існуючих тестів під нову архітектуру без Node `/api`.
   - E2E (Detox) сценарії для входу, додавання авто, перегляду історії, роботи з нагадуваннями.

7. Бот та розширене адміністрування:
   - Винесення бота в окремий сервіс із підключенням до Supabase через `service_role` (лише на сервері), чутливі операції через RPC.
   - Використання спільних DAO-принципів для адмін-панелей і бота; суворе розмежування прав доступу за роллю.

---

Даний план охоплює повний перехід на режим «без сервера». Реалізація проводиться ітераційно з постійною валідацією через тести та перевіркою UX. Посилання на поточні місця у коді для рефакторингу: `mobile/screens/VehicleList.js:34`, `mobile/screens/AddVehicle.js:555`, `mobile/context/AuthContext.js:92`, `mobile/api/vehicleCatalogApi.js`.
