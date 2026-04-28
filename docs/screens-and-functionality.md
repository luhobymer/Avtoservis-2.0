# Екрани та функціонал (Avtoservis)

Цей документ описує **екрани (сторінки)** застосунку та те, що на них може робити користувач.
Інформація зібрана з маршрутизації у `client/src/App.jsx` і реалізацій у `client/src/pages/*`.

## Як користувач рухається по застосунку (навігація)

- **Після входу** використовується `MainLayout` (`client/src/layouts/MainLayout.jsx`)
  - **Меню зліва** (на компʼютері) і **нижнє меню** (на телефоні).
  - У верхній панелі:
    - `NotificationBell` — індикатор/перехід до сповіщень.
    - `LanguageSwitcher` — перемикач мови.
  - Є **плаваюча кнопка швидких дій** (speed-dial):
    - `Додати авто` -> `/vehicles/add`
    - `Новий запис` -> `/appointments/schedule`
    - `Мої послуги` (тільки механік/адмін) -> `/my-services`
    - `Мої чати` -> `/my-chats`
    - `Взаємодії` -> `/interactions`
  - Якщо пропадає інтернет — показує попередження (offline toast).

- **Екрани входу/реєстрації** відкриваються у `AuthLayout` (`client/src/layouts/AuthLayout.jsx`)
  - Якщо користувач вже увійшов — перекидає на головну.
  - Якщо профіль після Google не дозаповнений — перекидає на `/auth/complete-profile`.

## Екрани авторизації (однаково для клієнта та механіка)

### `/auth/login` — Вхід
Файл: `client/src/pages/Login.jsx`

- **Форма входу**:
  - Поля:
    - `identifier` (email або телефон)
    - `password`
  - Кнопка **Увійти**.
  - Обробка станів:
    - `loading`
    - `error` (Alert)
- **Google Sign-In**:
  - Відмальовування кнопки Google через `https://accounts.google.com/gsi/client` якщо задано `VITE_GOOGLE_CLIENT_ID`.
  - Після Google login:
    - якщо `requireProfileSetup` -> `/auth/complete-profile`
    - інакше -> `/`
- **Посилання**:
  - `Забули пароль?` -> `/auth/forgot-password`
  - `Реєстрація` -> `/auth/register`

### `/auth/register` — Реєстрація
Файл: `client/src/pages/Register.jsx`

- **Вибір ролі**:
  - `client`
  - `master`
- **Поля**:
  - `name` (імʼя)
  - `lastName` (прізвище)
  - `patronymic` (по батькові, **обовʼязково** для `master`)
  - `region` (вибір з `UA_REGION_NAMES`)
  - `city` (вибір з `getCitiesByRegion(region)`)
  - `email`
  - `phone` (валідація формату `+380...` / `0...`)
  - `password`
- **Валідації/нормалізація**:
  - Телефон нормалізується до формату `+380XXXXXXXXX`.
- **Після успіху**:
  - Toast з повідомленням.
  - Якщо API повертає `verificationLink` — кнопка відкрити посилання в новій вкладці.
  - Кнопка переходу на `/auth/login`.
- **Google Sign-In**:
  - Аналогічно Login.

### `/auth/complete-profile` — Завершення профілю (після Google)
Файл: `client/src/pages/CompleteGoogleProfile.jsx`

- **Призначення**:
  - Дозаповнення обовʼязкових даних після Google входу.
- **Редіректи**:
  - Якщо не залогінений -> `/auth/login`
  - Якщо `needsProfileSetup === false` -> `/`
- **Поля**:
  - `role` (`client` / `master`)
  - `displayName` (disabled)
  - `firstName`, `lastName`
  - `patronymic` (обовʼязкове для `master`)
  - `region`, `city`
  - `email` (disabled)
  - `phone` (валідація і нормалізація)
- **Submit**:
  - `completeGoogleProfile(...)` -> редірект на `/`.

### `/auth/verify-email` — Підтвердження email
Файл: `client/src/pages/VerifyEmail.jsx`

- Параметри query:
  - `email`
  - `token`
- POST запит на `/api/auth/verify-email`.
- Стани:
  - loading (spinner)
  - success / error (Alert)
- Кнопка переходу на `/auth/login`.

### `/auth/forgot-password` — Запит на скидання паролю
Файл: `client/src/pages/ForgotPassword.jsx`

- Поле `email`.
- POST `/api/auth/forgot-password`.
- Показує success/error.
- Може показувати `debug_reset_link` (якщо backend повернув).
- Кнопка повернення на `/auth/login`.

### `/auth/reset-password` — Встановити новий пароль
Файл: `client/src/pages/ResetPassword.jsx`

- Параметри query:
  - `email`
  - `token`
- Поля:
  - `email`
  - `newPassword`
  - `confirmPassword`
- Валідації:
  - наявність токена
  - мін. довжина 8
  - співпадіння паролів
- POST `/api/auth/reset-password`.
- Після успіху редірект на `/auth/login`.

### `/auth/change-password` — Зміна паролю (після входу дефолтним)
Файл: `client/src/pages/ChangePassword.jsx`

- Поля:
  - `currentPassword`
  - `newPassword`
  - `confirmPassword`
- POST `${VITE_API_BASE_URL}/api/auth/change-password`.
- Після успіху:
  - показ success
  - через ~2 сек виконує `logout()` і редірект на `/auth/login`.

## Основні екрани після входу — окремо для ролей

### `/` — Головна сторінка
Файл: `client/src/App.jsx` (компонент `HomePage`)

- Якщо роль **механік/майстер** — відкривається робочий екран механіка (`MasterDashboard`).
- Якщо роль **клієнт** — відкривається звичайна головна (`Dashboard`).

---

# Клієнт: екрани та можливості

## `/` — Головна (Dashboard)
Файл: `client/src/pages/Dashboard.jsx`

- Показує “коротку картинку” по вашому авто та записах:
  - скільки у вас авто
  - скільки активних записів
  - останні/найближчі записи
- Швидкі переходи:
  - `Мої авто` -> `/vehicles`
  - `Мої записи` -> `/appointments`
  - `Записатись` -> `/appointments/schedule`

## `/vehicles` — Мої авто (список)
Файл: `client/src/pages/Vehicles.jsx`

- Список ваших автомобілів.
- Клік по картці авто -> відкриває деталі авто.
- Кнопка `Додати авто` -> `/vehicles/add`.

## `/vehicles/add` — Додати авто
Файл: `client/src/pages/VehicleDetails.jsx` (props `isNew={true}`)

- Заповнюєте дані авто (марка/модель/рік/VIN/номер тощо).
- Можна додати фото.
- Є пошук даних за номером (якщо дані доступні).

## `/vehicles/:id` — Авто (деталі)
Файл: `client/src/pages/VehicleDetails.jsx`

- Вкладки:
  - **Інформація** — редагування даних авто + фото.
  - **Регламент ТО** — планове обслуговування.
  - **Сервісна книга** — історія робіт по цьому авто.
  - **Запчастини** — список запчастин по цьому авто.

## `/appointments` — Мої записи (список)
Файл: `client/src/pages/Appointments.jsx`

- Список ваших записів на сервіс.
- Видно дату/час, авто, статус.
- Клік -> деталі запису.
- Кнопка `Записатись` -> `/appointments/schedule`.

## `/appointments/schedule` — Записатись на сервіс
Файл: `client/src/pages/AppointmentDetails.jsx` (props `isNew={true}`)

- Обираєте:
  - авто
  - майстра (зі “своїх” майстрів)
  - категорію та послуги
  - дату і час
- Можна додати коментар.
- Для нового запису можна додати “мої запчастини” (як список позицій).

## `/appointments/:id` — Деталі запису
Файл: `client/src/pages/AppointmentDetails.jsx`

- Перегляд деталей і статусу запису.
- Можна спілкуватися в чаті по запису (відкривається також через `#chat`).
- Клієнт може скасувати запис (переводить у `cancelled`).

## `/service-records` — Історія робіт (список)
Файл: `client/src/pages/ServiceRecords.jsx`

- Список сервісних записів по ваших авто.
- Можна фільтрувати по конкретному авто.
- Можна додати новий запис (якщо доступно в ролі/сценарії).
- Є експорт сервісної книги (`ServiceBookExport`).

## `/service-records/new`, `/service-records/:id` — Додати/редагувати сервісний запис
Файл: `client/src/pages/ServiceRecordDetails.jsx`

- Форма: авто, дата, пробіг, опис, виконавець, сума.

## `/service-book` — Сервісна книга по одному авто
Файл: `client/src/pages/ServiceBook.jsx`

- Обираєте авто — бачите таблицю історії.
- Можна експортувати.

## `/my-parts` — Мої запчастини
Файл: `client/src/pages/MyParts.jsx`

- Список запчастин, які ви додали для своїх авто.
- Є імпорт з фото (OCR): завантажуєте чек/накладну — система пробує розпізнати позиції.

## `/reminders` — Нагадування
Файл: `client/src/pages/Reminders.jsx`

- Додаєте нагадування по авто (ТО/страховка/інше).
- Можна вмикати/вимикати, редагувати, видаляти.
- Може просити дозвіл на системні нотифікації.

## `/notifications` — Сповіщення
Файл: `client/src/pages/Notifications.jsx`

- Список сповіщень.
- Можна позначити прочитаними, видалити, завантажити ще.
- Клік часто веде на потрібний екран (запис/нагадування/сервісний запис).

## `/my-mechanics` — Мої механіки
Файл: `client/src/pages/MyMechanics.jsx`

- Список ваших майстрів і статус взаємодії (прийнято/очікує/відхилено).
- Пошук майстра по місту та імені і надсилання запрошення.

## `/my-chats` — Мої чати
Файл: `client/src/pages/MyChats.jsx`

- Список діалогів (в основному по записах).
- Клік відкриває чат у деталях запису: `/appointments/:id#chat`.

## `/interactions` та `/interactions/new` — Взаємодії
Файли:
- `client/src/pages/Interactions.jsx`
- `client/src/pages/NewInteraction.jsx`

- “Inbox” для повідомлень/запитів з привʼязкою до запису або авто.
- Можна створити нову взаємодію та вибрати, з чим вона повʼязана.

## `/profile` — Профіль та налаштування
Файл: `client/src/pages/Profile.jsx`

- Редагування контактів і базових даних.
- Налаштування сповіщень/інтеграцій/мови/теми.
- Безпека (в т.ч. 2FA, якщо увімкнено).

---

# Механік (майстер): екрани та можливості

## `/master-dashboard` — Робочий простір
Файл: `client/src/pages/MasterDashboard.jsx`

- Головний екран механіка.
- Показує:
  - ваш поточний статус (вільний/зайнятий)
  - статистику по записах
  - записи на сьогодні і найближчі
- Можна вручну поставити “зайнятий” (з причиною і часом до якого зайнятий).
- Швидкі переходи:
  - Робочі години -> `/master-working-hours`
  - Історія робіт -> `/service-records`
  - Сповіщення -> `/notifications`

## `/master-working-hours` — Робочі години
Файл: `client/src/pages/MasterWorkingHours.jsx`

- Налаштовуєте графік по днях:
  - “робочий/вихідний”
  - час початку і кінця
- Кнопка `Зберегти`.

## `/appointments` — Записи (мій список / графік)
Файл: `client/src/pages/Appointments.jsx`

- Є вкладки:
  - **Мої записи** — те, що закріплено за вами.
  - **Робочий графік** — розширений список (для ролі майстра/адміна).
- Клік по запису -> деталі.

## `/appointments/:id` — Робота з записом
Файл: `client/src/pages/AppointmentDetails.jsx`

- Механік може вести запис по статусам:
  - підтвердити
  - почати роботу
  - завершити роботу
- При завершенні можна:
  - вказати пробіг
  - додати нотатки
  - додати запчастини (вручну або через OCR з фото)
- Є чат з клієнтом по цьому запису.

## `/vehicles` — Авто (обслуговувані / мої)
Файл: `client/src/pages/Vehicles.jsx`

- Механік може перемикатися між:
  - **обслуговуваними** авто
  - **моїми** авто (якщо є)
- Клік по авто -> деталі.

## `/vehicles/add` та `/vehicles/:id` — Додати/переглянути авто
Файл: `client/src/pages/VehicleDetails.jsx`

- При створенні авто механік може:
  - обрати власника (клієнта)
  - створити нового клієнта
  - імпортувати існуючі авто клієнта у “обслуговувані”
- В деталях авто — вкладки з регламентом, сервісною книгою і запчастинами.

## `/my-clients` — Мої клієнти
Файл: `client/src/pages/MyClients.jsx`

- Список клієнтів (всі / очікують / прийняті).
- Приймати/відхиляти запити.
- Додати клієнта вручну або з контактів.
- Перехід у картку клієнта.

## `/my-clients/:id` — Картка клієнта
Файл: `client/src/pages/ClientDetails.jsx`

- Контакти клієнта.
- Список авто клієнта з переходом у деталі авто.
- Можна редагувати дані клієнта.
- Можна “відʼєднати” клієнта (по суті — відхилити relationship).

## `/my-services` — Мої послуги
Файл: `client/src/pages/MyServices.jsx`

- Керуєте списком послуг:
  - додати
  - редагувати
  - увімкнути/вимкнути
  - групування по категоріях

## `/service-records` — Історія робіт
Файл: `client/src/pages/ServiceRecords.jsx`

- Перегляд/експорт сервісних записів.

## `/notifications` — Сповіщення
Файл: `client/src/pages/Notifications.jsx`

- Те саме, що у клієнта: список, позначення прочитаними, навігація в контекст.

## `/interactions`, `/interactions/new`, `/my-chats`, `/profile`

- Ці екрани також доступні механіку і працюють аналогічно (з урахуванням того, що контекст — це його записи/клієнти).

---

 # Адмін (якщо використовується)

Адміністратор має доступ до окремого екрану керування системою.
В цьому документі адмін-частина описана коротко, бо всередині вкладок багато таблиць/форм з `components/admin/*`.

## Адмін панель
Файл: `client/src/pages/AdminPanel.jsx`

- Доступ: `isAdmin()` (інакше редірект `/`).
- Tabs:
  - DashboardStats (`components/admin/DashboardStats`)
  - UsersManagement (`components/admin/UsersManagement`)
  - VehiclesManagement (`components/admin/VehiclesManagement`)
  - AppointmentsManagement (`components/admin/AppointmentsManagement`)
  - ServiceRecordsManagement (`components/admin/ServiceRecordsManagement`)
  - PartsManagement (`components/admin/PartsManagement`)

## Примітки

- Частина логіки “всередині екрана” знаходиться в компонентах у `client/src/components/**` (наприклад: чат, форми, адмін-таблиці, регламент ТО).
- Якщо потрібно — я можу доповнити цей документ детальніше по кожному великому компоненту (окремими підрозділами).
