# План переходу на PWA (Web → “мобільний” досвід) та перенесення всіх фіч із Mobile у Web

Документ сформовано на основі аудиту кодової бази станом на 2026-03-15.

## 0. Мета та рамки

### 0.1. Мета
- Зробити **Web-клієнт** єдиним “джерелом правди” для UI/UX і фіч.
- Перетворити Web на **PWA**, яке встановлюється на Android/iOS/desktop і стабільно працює при поганому інтернеті.
- Перенести/вирівняти **усі фічі**, які зараз є в React Native додатку, у Web.
- Вийти з залежностей **Metro / Gradle / Android tooling** як основного способу доставки продукту користувачу.

### 0.2. Важливе уточнення про “без Node”
PWA як продукт може деплоїтись як **статичні файли** (без Node на проді), але збірка Vite/React зазвичай робиться через Node як build-tool. Цей план прибирає **RN/Metro/Gradle**, але **не забороняє** Node як інструмент збірки вебу.

### 0.2.1. Як відмічаємо виконання
- Усі кроки у секції “Детальний план” оформлені як чекліст `- [ ]`.
- Після виконання кроку ставимо `- [x]` напроти нього.

### 0.3. Нефункціональні вимоги (обов’язково)
- Безпека: токени, куки, refresh, CORS, CSP, захист від XSS/CSRF.
- Надійність: graceful degradation.
- Продуктивність: мобільний Lighthouse ≥ 80 (як ціль), контроль розміру бандлу.
- UX: мобільний UX не гірший за Mobile app для базових сценаріїв.

### 0.4. Обмеження PWA (щоб не “впиратись” у неможливе)
- iOS: push-сповіщення працюють тільки для “встановлених” PWA на iOS 16.4+, є нюанси з background.
- Немає повного аналога “локальних нативних нагадувань” (як у мобільних застосунках) без push або серверних нагадувань.
- Деякі нативні інтеграції (контакти/дзвінки/фонова робота) можуть вимагати компромісів.

### 0.5. Домовленість на старті
- Поки що робимо без офлайн-режиму для даних (фаза 5 відкладена).

## 1. Поточний стан репозиторію (коротко, для контексту)

### 1.1. Web (client/)
- Технології: Vite + React + MUI, i18next.
- PWA вже частково присутня:
  - [client/public/manifest.json](file:///e:/Avtoservis%202.1/client/public/manifest.json)
  - [client/src/main.jsx](file:///e:/Avtoservis%202.1/client/src/main.jsx) реєструє SW через vite-plugin-pwa.
  - Є **два** SW:
    - [client/public/sw.js](file:///e:/Avtoservis%202.1/client/public/sw.js) (кастомний, з push handler)
    - [client/src/sw.js](file:///e:/Avtoservis%202.1/client/src/sw.js) (Workbox-логіка)
  - VitePWA у [vite.config.js](file:///e:/Avtoservis%202.1/client/vite.config.js) налаштований, але manifest вимкнений (`manifest: false`).

### 1.2. Mobile (mobile/)
- React Native 0.76.x, навігація, OCR, нагадування/сповіщення та інші фічі.
- Push у коді Mobile/Server зараз фактично заглушені “без провайдера”.

### 1.3. Server (server/)
- Є API для фіч Web/Mobile.
- Є таблиця/ендпоінт для токенів (`push_tokens`) і нагадувальник, але реальна відправка push у сервісі вимкнена/заглушена.

### 1.4. Ролі користувачів (актуально зараз)
- Активні ролі:
  - **клієнт** (власник авто)
  - **майстер/механік**
- Роль **адмін** поки що не розвивається (фічі, що стосуються адміна, поставлені на паузу).

## 2. Інвентар фіч: Mobile → Web (що вже є, що треба доробити)

Нижче не “архітектурна поезія”, а практичний список, від якого відштовхуємось у роботі.

### 2.1. Базові екрани/флоу
- Auth (login/register/forgot/reset/verify/change password) — **OK** (потрібно тримати E2E).
- Dashboard — **GAP** (у Mobile є віджети/модалки: mileage requests + push setup).
- Vehicles + Vehicle details (додавання/редагування) — **GAP** (частину вирівняли, але в Mobile є OCR/VIN lookup/більше полів).
- Appointments + Appointment details (створення/редагування) — **GAP** (є в Web, але parity по “шляхам з нотифікацій”, completion flow, статуси і UX треба E2E).
- Service records + details — **OK/GAP** (базово є, але в Mobile є більш “мобільний” UX і інші entrypoints).
- Service Book (сервісна книга як окремий розділ/екран) — **MISSING** у Web як окремий розділ (див. 3.1.1).
- Profile — **GAP** (у Mobile є налаштування нотифікацій, інтеграцій Telegram/Viber, перемикач мови, темна тема).
- Admin panel — **OK** (але нові адмін-фічі **не пріоритезуємо**, див. 1.4).
- Notifications — **GAP** (у Mobile список комбінує notifications + reminders і має swipe actions; у Web це рознесено).
- My mechanics / clients / services / parts — **OK/GAP** (сторінки є; потрібна перевірка parity по нюансах). Контакти (phonebook): **додали у Web** через Contact Picker API + fallback.
- Reminders — **GAP** (у Mobile є enable/permission UX і очікування “нагадувань”, у Web є CRUD, але без “увімкнено/вимкнено” і логіки доставки/дозволів).

### 2.1.1. Матриця паритету екранів (Mobile → Web)

Позначення:
- **OK** — сценарій у Web повторює Mobile (з урахуванням PWA-обмежень).
- **GAP** — сторінка є, але логіка/UX/entrypoints відрізняються.
- **MISSING** — у Web немає аналога.

#### Auth
- Mobile: `LoginScreen`, `RegisterScreen`, `ChangePasswordScreen`, `TwoFactorSetupScreen`
  - Web: `/auth/login`, `/auth/register`, `/auth/change-password` + 2FA в `/profile`.
  - Статус: **OK/GAP**
    - **[GAP]** 2FA UX відрізняється (у Mobile це окремий екран, у Web — в профілі).

#### Dashboard
- Mobile: `DashboardScreen` (vehicles+appointments+serviceRecords widgets, mileage request modal, push token registration)
- Web: `/` (`Dashboard.jsx`) / `/master-dashboard`
- Статус: **GAP**
  - **[GAP]** Mileage requests (щомісячні запити пробігу + модалка відповіді) — немає явного аналога у Web.
  - **[GAP]** Авто-реєстрація push токена як у Mobile — у Web інший механізм (Web Push), потрібна окрема фаза/UX (див. Фаза 4).

#### Vehicles
- Mobile: `VehiclesScreen`/`VehicleList` + `VehicleDetails` + `AddVehicle` + `EditVehicle`
- Web: `/vehicles`, `/vehicles/add`, `/vehicles/:id`
- Статус: **GAP**
  - **[OK]** CRUD авто у Web є.
  - **[OK]** Майстер: вибір власника + додавання клієнта + “з контактів” (Contact Picker API + fallback) — вирівняно.
  - **[GAP]** OCR/розпізнавання (номер/техпаспорт) для автозаповнення — Mobile має, у Web наразі немає.
  - **[GAP]** VIN lookup / додаткові поля з Mobile — у Web спрощено.

#### Appointments
- Mobile: `AppointmentsScreen`, `AppointmentDetailsScreen`, `CreateAppointmentScreen`, `CompleteAppointmentScreen`
- Web: `/appointments`, `/appointments/schedule`, `/appointments/:id`
- Статус: **GAP**
  - **[OK]** Список/деталі/створення у Web є.
  - **[GAP]** Статуси/екшени майстра (confirm/start/complete/cancel) — потрібно звірити 1:1 з Mobile (E2E).
  - **[OK/GAP]** Чат по запису: у Web вже є `AppointmentChat` в `AppointmentDetails`, але потрібні deep-links (див. 3.5).

#### Service Records
- Mobile: `ServiceRecordsScreen`, `ServiceRecordDetails`, `CreateServiceRecord`, `EditServiceRecord`
- Web: `/service-records`, `/service-records/new`, `/service-records/:id`
- Статус: **OK/GAP**
  - **[OK]** Список/створення/редагування присутні.
  - **[GAP]** Entry points/UX як у Mobile (FAB, швидкі дії, навігація з авто/запису) — треба вирівняти.

#### Service Book (окремий розділ)
- Mobile: `ServiceBookScreen` + `ServiceHistoryScreen`
- Web: (зараз) тільки вкладка “Сервісна книга” в `VehicleDetails` через `ServiceRecords`
- Статус: **MISSING** як окремий розділ
  - Потрібно: `/service-book` як у плані (див. 3.1.1).

#### Notifications
- Mobile: `NotificationsScreen` (combined list notifications + reminders, mark all as read, delete all, swipe-to-delete)
- Web: `/notifications` + окремо `/reminders`
- Статус: **GAP**
  - **[GAP]** У Mobile reminders відображаються як частина нотифікацій; у Web це рознесено.
  - **[GAP]** Swipe actions / швидке видалення — відсутнє (може бути не критично, але UX різний).

#### Reminders
- Mobile: `ServiceRemindersScreen`, `CreateReminderScreen` (enable/disable, permissions UX; локальні нагадування фактично заглушені)
- Web: `/reminders` (`Reminders.jsx`)
- Статус: **GAP**
  - **[OK]** CRUD reminders у Web є.
  - **[GAP]** “увімкнути/вимкнути” + permission UX як у Mobile — відсутні.
  - **[GAP]** Канал доставки (in-app/push/серверний scheduler) треба зафіксувати як продуктове рішення.

#### Chats / Interactions
- Mobile: `InteractionsScreen` + `NewInteractionScreen` + `ChatScreen`
- Web: `/my-chats` (`MyChats.jsx`) + чат всередині `AppointmentDetails`
- Статус: **GAP/MISSING**
  - **[OK]** Список чатів по appointment у Web є (my-chats → відкриває appointment).
  - **[GAP]** “чат прив’язаний до запису” — правильний напрям, але потрібно:
    - deep-link `/appointments/:id#chat` і відкриття вкладки,
    - навігація з нотифікацій прямо в чат.
  - **[MISSING]** `NewInteractionScreen` аналог у Web (створення взаємодії/повідомлення з вибором recipient + related entity).
  - **[GAP]** Direct chat по recipient без сутності (як fallback у Mobile) — у Web не визначено.

#### My Clients
- Mobile: `MyClientsScreen` (add client + from contacts, open chat on tap)
- Web: `/my-clients` (`MyClients.jsx`) + додавання власника в `/vehicles/add`
- Статус: **OK/GAP**
  - **[OK]** Додавання клієнта + “З контактів” — є.
  - **[GAP]** Відкриття чату з клієнтом з цього екрану — у Web немає прямого аналога.

#### My Mechanics
- Mobile: `MyMechanicsScreen`
- Web: `/my-mechanics` (`MyMechanics.jsx`)
- Статус: **OK/GAP**
  - Потрібно E2E звірити інвайти/пошук/статуси.

#### My Services
- Mobile: `MyServicesScreen`
- Web: `/my-services` (`MyServices.jsx`)
- Статус: **OK/GAP**
  - Базовий менеджмент є, потрібна parity-перевірка нюансів (категорії/власні/невласні послуги).

#### My Parts
- Mobile: `MyPartsScreen` + `AddEditPartScreen`
- Web: `/my-parts` (`MyParts.jsx`)
- Статус: **OK/GAP**
  - **[OK]** Є OCR імпорт з фото у Web.
  - **[GAP]** Групування/фільтри/кілька фото/офлайн-кеш — залежить від Mobile реалізації (перевірити).

#### Profile / Settings
- Mobile: `ProfileScreen` + `SettingsScreen`
- Web: `/profile` (`Profile.jsx`)
- Статус: **OK/GAP**
  - **[OK]** Notification settings UI у Web (збереження у `user_settings`).
  - **[OK]** Integration settings UI у Web (Telegram) (збереження у `user_settings`).
  - **[GAP]** Повна прив’язка Telegram акаунта (connect/disconnect/status) — потрібна окрема фаза інтеграцій.
  - **[GAP]** Viber інтеграція — відкладено на окрему фазу інтеграцій.
  - **[OK]** Language/appearance (dark mode) застосовується глобально у Web (на основі `user_settings`).
  - **[OK]** 2FA у Web є (компонент `TwoFactorAuth`).

### 2.2. Типові “мобільні” фічі, які треба привести до PWA-реальності
- Push-сповіщення: дозвіл, підписка, керування, доставка, open-action.
- Офлайн/поганий інтернет: кешування сторінок/асетів, кеш даних (vehicles/appointments), відкладені дії.
- Камера/галерея: додавання фото запчастин, документів, OCR.
- OCR:
  - Mobile має ML Kit + fallback/мок.
  - Для Web вже є залежність tesseract у Mobile-частині; у Web треба або:
    - використати tesseract.js у браузері, або
    - перенести OCR на сервер (стабільніше для слабких телефонів), або
    - комбіновано.
- Master-специфічні екрани (MasterDashboard/MasterWorkingHours): потрібно перевірити parity та E2E (див. 3.1).
- Сценарії “швидких дій” (FAB, нижня навігація, UX як у додатку).

  - Чат, прив’язаний до запису (appointment chat): у Web має бути не просто “список чатів”, а чат всередині сторінки запису та deep-linking з нотифікацій.

## 3. Принципи міграції (щоб не робити “переписування заради переписування”)

### 3.1. Web-first
- Усі нові фічі робимо у Web (client/).
- Mobile (RN) переводимо в режим “заморозки” або тільки багфікси до моменту виводу з експлуатації.

### 3.2. Один бекенд, одна модель даних
- Сервер — спільний.
- Вирівнюємо контракти API так, щоб Web покривав усі сценарії Mobile.

### 3.3. Паралельне існування під час переходу
- Переїзд робимо інкрементально: фіча за фічею, без “Big Bang”.
- На кожну фічу: критерії готовності + ручні сценарії перевірки.

## 4. Детальний план робіт (до дрібних кроків)

План поділено на фази. Кожна фаза завершується “вихідними артефактами” та перевіркою.

### Фаза 0 — Підготовка та фіксація цілей (0.5–1 день)
- [ ] Створити “мапу фіч” (таблиця) та позначити:
   - Є у Web і відповідає Mobile (OK)
   - Є у Web, але не паритет (GAP)
   - Нема у Web (MISSING)
- [ ] Узгодити “мінімальний PWA-реліз” (MVP) і “повний паритет”.
- [ ] Визначити цільові платформи:
   - Android Chrome (обов’язково)
   - iOS Safari + встановлення на Home Screen (обов’язково)
   - Desktop (бонус)
- [ ] Визначити політику релізів:
   - частота релізів Web
   - як оновлюється SW (prompt/auto)
- [ ] Зафіксувати список **ризиків** і “план Б” для кожного:
   - push на iOS, background, OCR продуктивність, офлайн-дані.

Артефакт: оновлена таблиця/беклог в таск-трекері + цей документ як “single source of plan”.

### Фаза 1 — Привести PWA-інфраструктуру до одного правильного варіанту (1–2 дні)

Ціль: прибрати двозначність і зробити “один SW, один manifest-потік, контрольовані оновлення”.

#### 1.1. Вирівняти manifest
- [x] Перевірити, що `manifest.json` коректний:
   - `start_url`, `scope`, `display`, `icons`, `theme_color`, `background_color`.
- [x] Перевірити, що `index.html` лінкує manifest і icons.
- [x] Визначити, хто генерує manifest:
   - Варіант А: тримати `client/public/manifest.json` як є (простий).
   - Варіант Б: увімкнути manifest у VitePWA (генерація під час build).
- [x] Обрати 1 варіант і прибрати інший, щоб не було “два джерела”.

#### 1.2. Вирівняти service worker
- [x] Прийняти рішення:
   - “Workbox через VitePWA” як основний шлях (рекомендовано), або
   - “свій ручний SW у public/” (простіше, але складніше масштабувати).
- [x] Залишити тільки один SW:
   - або переносимо логіку push/offline у `client/src/sw.js`,
   - або відмовляємось від `client/src/sw.js` і залишаємо `client/public/sw.js`.
- [x] Додати `notificationclick` обробку:
   - відкриття конкретної сторінки (наприклад `/appointments/:id`).
- [x] Прописати стратегії кешування:
   - HTML навігація: NetworkFirst + fallback на `/offline.html`
   - Статика: CacheFirst
   - API: поки що без кешування (тільки мережа)
- [x] Протестувати:
   - [x] Зібрати build і підняти preview локально.
   - [x] Перевірити логін: більше немає 500 на `/api/auth/login`.
   - [ ] Офлайн сценарії відкладені (див. пункт 0.5).

Вихід: один стабільний SW, який прогнозовано оновлюється.

#### 1.3. Контроль оновлень
- [x] Визначити політику:
   - `registerType: prompt` (вже є) — залишити.
- [x] Додати UX “оновити зараз / пізніше”.
- [x] Перевірити, що при оновленні не ламаються сесії (auth).

### Фаза 2 — Мобільний UX у Web (2–5 днів, інкрементально)

Ціль: користувач на телефоні не відчуває “це сайт”, а відчуває “це додаток”.

#### 2.1. Навігація як у додатку
- [x] Додати “нижню навігацію” в Web (для мобільних брейкпоінтів):
   - Dashboard, Vehicles, Appointments, Notifications, Profile (приклад).
- [x] Зробити FAB (швидкі дії):
   - “Новий запис”, “Додати авто”, “Нова запчастина”.
- [x] Забезпечити, що:
   - маршрути не дублюються,
   - back-поведінка у браузері прогнозована.

#### 2.2. Мобільні форми
- [x] Для ключових форм (створення запису/авто/запчастини):
   - великі клікабельні елементи,
   - мінімум дрібного тексту,
   - коректні input types (date/time/number),
   - автоскрол до помилки.
   - діалог редагування запчастин в Admin → адаптований під мобільні екрани.

#### 2.3. “Швидка” робота при слабкому інтернеті
- [x] Skeleton/placeholder на списках.
- [x] Retry при тимчасових помилках.
- [x] “Offline banner” (вже є події online/offline) — додати UI-індикатор.

### Фаза 3 — Паритет фіч (Mobile → Web) за напрямками (5–15 днів)

Це основна фаза. Її краще вести як окремі епіки.

#### 3.1. Master-кабінет (веб)
- [x] Підтвердити ролі (майстер/механік та клієнт) і маршрути.
- [x] Реалізувати:
   - Master dashboard (аналоги mobile `MasterDashboardScreen`)
   - Master working hours (аналог `MasterWorkingHoursScreen`)
- [ ] Перевірити end-to-end:
   - майстер бачить свої записи,
   - може змінювати статуси,
   - може налаштовувати графік.
- [ ] Усі сценарії для ролі “адмін” залишити на паузі (не реалізовувати нові фічі).

#### 3.1.1. Сервісна книга (Service Book) як окремий розділ у Web
- [x] Додати окремий маршрут і сторінку у Web:
   - `GET /service-book` (або інший узгоджений шлях), доступний клієнту і майстру.
- [x] UX/структура:
   - список авто → вибір авто → таймлайн/історія обслуговувань (аналог mobile `ServiceBookScreen` + `ServiceHistoryScreen`).
   - фільтри: по авто/даті/типу робіт (мінімум: по авто).
- [x] Джерело даних:
   - базуватись на `service_records` (і, якщо треба, на `appointments` як “майбутні/заплановані”).
- [x] Експорт/шеринг:
   - інтегрувати існуючий експорт (якщо вже є у Web) як кнопку на сторінці Service Book.
- [x] Критерії готовності:
   - сервісна книга доступна як окремий розділ з нижньої навігації на мобільних брейкпоінтах.
   - сторінка коректно працює для авто з 0 записів.

#### 3.1.2. Interactions / New Interaction (відсутній у Web)
- Контекст Mobile:
  - `InteractionsScreen` (список взаємодій)
  - `NewInteractionScreen` (створення взаємодії/повідомлення, вибір recipient + related entity)
- Поточний стан Web:
  - є `/my-chats` (список чатів по appointment) + чат вкладкою в `AppointmentDetails`
- Що потрібно:
  - [x] Додати сторінку/маршрут для `Interactions`.
  - [x] Додати аналог `NewInteractionScreen` у Web:
    - [x] вибір отримувача (майстри/адміни)
    - [x] тип (message/question/request)
    - [x] прив’язка до сутності (vehicle/appointment) або “без сутності”
  - [ ] Узгодити, чи підтримуємо direct chat без appointment у Web (як fallback у Mobile) (опціонально).

#### 3.1.3. Deep-links до чату по запису (appointment-bound chat)
- [x] Deep-link формат: `/appointments/:id#chat` (або query `?tab=chat`) і автоскрол до чату.
- [x] Перехід з `Notifications` у Web одразу в чат запису (якщо нотифікація про повідомлення/чат).
- [x] Перехід з `/my-chats` у Web одразу у чат запису.

#### 3.1.4. Reminders parity (логіка + UX)
- [x] Додати “увімкнути/вимкнути” нагадування (як у Mobile) на сторінці `/reminders`.
- [x] Додати permission UX (Web Notifications permission, пояснення користувачу).
- [x] Зафіксувати канал доставки нагадувань:
  - [x] серверний scheduler + in-app notifications (MVP)
  - [ ] push (PWA Web Push) — після завершення Фази 4

#### 3.1.5. Profile parity (налаштування як у Mobile)
- [x] Notification settings UI (як у Mobile `NotificationSettings`).
- [x] Integration settings UI (Telegram) (як у Mobile `IntegrationSettings`) (Viber відкладено).
- [x] Language switcher / appearance (dark mode) parity (збереження у `user_settings` + глобальне застосування).

#### 3.1.6. Інтеграції (після завершення parity)

Telegram (повна прив’язка акаунта)
- [ ] Додати бекенд-ендпойнти для web-користувача:
  - [ ] `POST /api/telegram/link` (приймає code, прив’язує Telegram до поточного користувача)
  - [ ] `GET /api/telegram/link-status` (повертає чи прив’язано, telegram username/chat id)
  - [ ] `DELETE /api/telegram/unlink`
- [ ] Додати збереження зв’язку в БД (наприклад `users.telegram_chat_id`/`users.telegram_username` або окрема таблиця).
- [ ] Додати flow у бота @sanya_sto_bot:
  - [ ] після входу через телефон генерувати одноразовий code для прив’язки
  - [ ] показати code користувачу (copy-friendly)
- [ ] Web UI:
  - [ ] поле для введення code + кнопки connect/disconnect
  - [ ] відображати статус прив’язки

Viber (відкладено)
- [ ] Визначити механізм прив’язки (номер/код/бот).
- [ ] Додати бекенд-ендпойнти connect/disconnect/status.
- [ ] Додати UI у Web профілі.

#### 3.2. OCR і робота з фото
- [x] Визначити, де OCR має жити:
   - Вибрано варіант Б: OCR на сервері через `tesseract.js` (`/api/ocr/parse`).
- [x] Веб-UI для додавання фото:
   - `<input type="file" accept="image/*" capture="environment">` у Web (MyParts, завершення робіт).
- [x] Пайплайн обробки:
   - зменшення/компресія в браузері перед відправкою,
   - показ прев’ю зображення,
   - OCR на сервері → список знайдених запчастин,
   - підтвердження/збереження користувачем (MyParts, Completion dialog).
- [ ] Перевірка якості:
   - 10–20 реальних фото номерів/документів,
   - метрики: % успішних розпізнавань, середній час, відсоток ручних правок.

#### 3.3. Нагадування (Reminders)
- [x] Вирівняти модель нагадувань Web із сервером:
-   - типи, поля, прив’язка до авто, статус виконання, пріоритет.
- [ ] Веб-налаштування:
   - які типи нагадувань ввімкнені,
   - коли спрацьовують,
   - через які канали доставляються (in-app, email, push).
- [x] UX:
-   - список нагадувань,
   - створення/редагування,
   - позначення виконаних,
   - історія спрацювань (опціонально).

#### 3.4. Сповіщення (in-app)
- [x] Уніфікувати формат notification data (типи, посилання, referenceId).
- [x] Додати deep-linking:
   - натискання веде на відповідний екран (запис/авто/нагадування).
- [x] Пагінація/оновлення списку.

#### 3.5. Чати/взаємодії
- [x] Змінити фокус Web-чатів на “чат прив’язаний до запису (appointment)”, як у Mobile:
   - основний entrypoint — `AppointmentDetails` (кнопка/вкладка “Чат”).
- [x] Реалізувати екран/компонент `AppointmentChat` у Web:
   - список повідомлень,
   - відправка тексту,
   - відображення статусу доставки/помилки.
- [ ] (Опційно) Вкладення:
   - відправка фото з камери/галереї у Web, якщо це підтримує Mobile сценарій.
- [x] Deep-linking:
   - перехід в чат має відкривати конкретний запис: `/appointments/:id#chat` (або інший узгоджений формат).
- [ ] Критерії готовності (E2E):
   - клієнт відкриває запис → пише майстру → майстер бачить повідомлення в цьому ж записі.
   - нотифікація (in-app/push) по кліку веде в `AppointmentDetails` і відкриває вкладку чату.

### Фаза 4 — Push-сповіщення у PWA (3–7 днів)

Ціль: замінити “нативні” push на **Web Push** або **FCM Web**, і щоб це працювало в реальних умовах.

#### 4.1. Вибір провайдера
Варіант А: Web Push (VAPID, бібліотека web-push)
- Плюси: стандартизовано, без Firebase, працює в Chrome/Edge, на iOS PWA також можливо.
- Мінуси: потрібна реалізація на сервері, управління підписками.

Варіант Б: Firebase Cloud Messaging (Web)
- Плюси: єдина екосистема, якщо вже є Firebase.
- Мінуси: інтеграція/конфіг/ключі, залежність від Firebase.

Рекомендація для цього проєкту: почати з **Web Push (VAPID)**, бо зараз push у сервері заглушений і простіше зробити “чисту” реалізацію.

#### 4.2. Сервер: зберігання підписок
- [ ] Додати таблицю `web_push_subscriptions` (або розширити існуючу `push_tokens` під новий тип).
- [ ] Поля:
   - `id`, `user_id`, `endpoint`, `p256dh`, `auth`, `user_agent`, `created_at`, `last_used_at`, `is_active`.
- [ ] API:
   - `POST /api/web-push/subscribe`
   - `POST /api/web-push/unsubscribe`
   - `POST /api/web-push/test` (тільки для адміна/дев)

#### 4.3. Сервер: відправка
- [ ] Згенерувати VAPID keys (dev/prod).
- [ ] Додати env:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT` (mailto або url)
- [ ] Реалізувати сервіс `sendWebPushNotification(userId, payload)`.
- [ ] Підключити відправку у:
   - reminder scheduler,
   - зміни статусу запису,
   - інші критичні події.
- [ ] Логи та ретраї:
   - якщо subscription “gone” → деактивувати.

#### 4.4. Клієнт: підписка та UX
- [ ] Додати сторінку/секцію налаштувань сповіщень:
   - кнопка “Увімкнути push”
   - статус дозволу (default/granted/denied)
- [ ] Реєстрація subscription:
   - `Notification.requestPermission()`
   - `serviceWorkerRegistration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
   - надіслати subscription на сервер.
- [ ] Service Worker:
   - `self.addEventListener('push', ...)`
   - `self.addEventListener('notificationclick', ...)`
- [ ] Перевірка:
   - Android Chrome: отримання push у фоні, по кліку відкриває потрібний маршрут.
   - iOS: перевірка на встановленому PWA.

### Фаза 5 — Офлайн-дані та відкладені операції (3–10 днів, за пріоритетом)

Ціль: “працює без інтернету” для читання, і “не губить” дії користувача.

#### 5.1. Визначити офлайн-критичні сценарії
Приклад мінімуму:
- Відкривається додаток.
- Видно останні списки: авто, записи, сервісні записи.
- Можна створити “чернетку” запису, яка відправиться при відновленні мережі.

#### 5.2. Зберігання (IndexedDB)
- [ ] Вибрати схему кешу:
   - таблиці: `vehicles`, `appointments`, `service_records`, `notifications`.
- [ ] Реалізувати read-through:
   - при успішному API відповіді → зберегти у IndexedDB,
   - при офлайні → показати з кешу.
- [ ] Черга дій:
   - create/update операції зберігати як “pending actions”.
   - при online → відправити по черзі, показати статуси.

#### 5.3. Background sync (де доступно)
- [ ] Додати підтримку Background Sync, якщо браузер дозволяє.
- [ ] Fallback: синхронізація по події `online`.

### Фаза 6 — QA, тестування, вимірювання якості (паралельно, але формалізовано)

#### 6.1. Матриця ручних сценаріїв
- [ ] Скласти чеклист для:
   - клієнта
   - майстра
   - адміна
- [ ] Для кожного сценарію:
   - кроки
   - очікуваний результат
   - дані для тесту

#### 6.2. Автотести (мінімум)
- [ ] API тести (сервер вже має jest).
- [ ] UI smoke для Web (хоча б критичні маршрути).

#### 6.3. Lighthouse + реальні девайси
- [ ] Прогнати Lighthouse mobile для ключових сторінок.
- [ ] Перевірити на:
   - Android mid-range
   - iPhone (iOS)

### Фаза 7 — Реліз та поступова міграція користувачів (2–7 днів)

#### 7.1. Релізний процес
- [ ] Деплой Web клієнта з PWA.
- [ ] Окремо перевірити:
   - caching headers
   - HTTPS (обов’язково для PWA і push)
   - правильний scope SW

#### 7.2. Онбординг “встановіть PWA”
- [ ] Показувати підказку встановлення (тільки після кількох відвідувань або при логіні).
- [ ] Інструкція для iOS: “Share → Add to Home Screen”.

#### 7.3. Поступове вимкнення Mobile
- [ ] У Mobile додатку:
   - банер “переходимо на PWA”
   - кнопка “Відкрити PWA”
- [ ] Дедлайн виводу Mobile з активної підтримки.
- [ ] Зафіксувати політику: які баги ще фіксимо у Mobile, а які — ні.

### Фаза 8 — Прибирання “зайвого” після міграції (1–3 дні)

Ціль: прибрати все, що більше не використовується, щоб не тягнути техборг і плутанину.

#### 8.1. Прибирання Web (PWA)
- [x] Видалити застарілий SW у `client/public/sw.js` після переходу на один SW.
- [ ] Видалити дублікати/зайві файли PWA (залишити одне джерело manifest+icons).
- [ ] Прибрати неактуальні маршрути/сторінки, якщо вони були тимчасовими під міграцію.

#### 8.2. Прибирання Mobile (RN)
- [ ] Архівувати або видалити `mobile/` після повного паритету PWA.
- [ ] Прибрати скрипти/інструкції, які більше не потрібні (Gradle/Metro release notes).
- [ ] Прибрати CI кроки, які збирають Mobile, якщо Mobile виведено з експлуатації.

## 5. Критерії готовності (Definition of Done) для фінального “PWA замість Mobile”

- У Web/PWA є всі ключові сценарії, які є у Mobile.
- На Android PWA встановлюється і стабільно працює при поганому інтернеті.
- Push працює хоча б на Android (і на iOS — де підтримується).
- OCR/фото-флоу працює стабільно або має серверний fallback.
- UX на телефоні: нижня навігація, великі елементи, швидкі дії.
- Моніторинг/логи показують стабільність (немає масових помилок).

## 6. Рекомендований порядок реалізації (щоб швидко отримати цінність)

- [ ] Фаза 1 (PWA один SW/manifest) — фундамент.
- [ ] Фаза 2 (мобільний UX) — відчуття “додатка”.
- [ ] Фаза 3.1 (Master кабінет) + 3.1.1 (Service Book як окремий розділ) + 3.2 (OCR/фото) — найбільші “дірки”.
- [ ] Фаза 3.5 (чат прив’язаний до запису) — критично для комунікації “по конкретному ремонту”.
- [ ] Фаза 4 (push) — заміна нативних сповіщень.
- [ ] Фаза 5 (офлайн дані) — покращення в польових умовах.
- [ ] Фаза 7 (міграція користувачів) — фінальний перехід.
- [ ] Фаза 8 (cleanup) — прибрати все зайве після міграції.
