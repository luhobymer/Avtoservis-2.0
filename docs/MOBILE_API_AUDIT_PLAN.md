# План перевірки відповідності запитів мобільного додатка до сервера

## Загальна інформація

**Мета:** Перевірити відповідність API запитів мобільного додатка до серверних endpoints та виправити невідповідності в мобільному додатку.

**Принцип:** Сервер залишається незмінним, всі корекції виконуються тільки в мобільному додатку.

**Базовий URL сервера:** `http://192.168.1.13:3000`

## 1. Структура API endpoints на сервері

### 1.1 Автентифікація (`/api/auth`)
- `POST /api/auth/register` - Реєстрація користувача
- `POST /api/auth/login` - Вхід користувача
- `POST /api/auth/logout` - Вихід користувача
- `POST /api/auth/refresh` - Оновлення токена
- `POST /api/auth/forgot-password` - Відновлення паролю
- `POST /api/auth/reset-password` - Скидання паролю

### 1.2 Користувачі (`/api/users`)
- `GET /api/users/profile` - Отримання профілю користувача
- `PUT /api/users/profile` - Оновлення профілю користувача
- `DELETE /api/users/profile` - Видалення профілю користувача

### 1.3 Автомобілі (`/api/vehicles`)
- `GET /api/vehicles` - Отримання списку автомобілів користувача
- `GET /api/vehicles/:vin` - Отримання автомобіля за VIN
- `POST /api/vehicles` - Додавання нового автомобіля
- `PUT /api/vehicles/:vin` - Оновлення автомобіля
- `DELETE /api/vehicles/:vin` - Видалення автомобіля

### 1.4 Записи на обслуговування (`/api/appointments`)
- `GET /api/appointments` - Отримання записів користувача
- `GET /api/appointments/:id` - Отримання запису за ID
- `POST /api/appointments` - Створення нового запису
- `PUT /api/appointments/:id` - Оновлення запису
- `DELETE /api/appointments/:id` - Видалення запису

### 1.5 Послуги (`/api/services`)
- `GET /api/services` - Отримання всіх послуг (публічний)
- `GET /api/services/:id` - Отримання послуги за ID (публічний)
- `POST /api/services` - Створення послуги (тільки адмін)
- `PUT /api/services/:id` - Оновлення послуги (тільки адмін)
- `DELETE /api/services/:id` - Видалення послуги (тільки адмін)

### 1.6 Механіки (`/api/mechanics`)
- `GET /api/mechanics` - Отримання списку механіків
- `GET /api/mechanics/:id` - Отримання механіка за ID
- `POST /api/mechanics` - Додавання механіка (тільки адмін)
- `PUT /api/mechanics/:id` - Оновлення механіка (тільки адмін)
- `DELETE /api/mechanics/:id` - Видалення механіка (тільки адмін)

### 1.7 Станції обслуговування (`/api/stations`)
- `GET /api/stations` - Отримання списку станцій
- `GET /api/stations/:id` - Отримання станції за ID
- `POST /api/stations` - Додавання станції (тільки адмін)
- `PUT /api/stations/:id` - Оновлення станції (тільки адмін)
- `DELETE /api/stations/:id` - Видалення станції (тільки адмін)

### 1.8 Нагадування (`/api/reminders`)
- `GET /api/reminders` - Отримання нагадувань користувача
- `POST /api/reminders` - Створення нагадування
- `PUT /api/reminders/:id` - Оновлення нагадування
- `DELETE /api/reminders/:id` - Видалення нагадування

### 1.9 Сповіщення (`/api/notifications`)
- `GET /api/notifications` - Отримання сповіщень користувача
- `POST /api/notifications` - Створення сповіщення
- `PUT /api/notifications/:id` - Позначити як прочитане
- `DELETE /api/notifications/:id` - Видалення сповіщення

## 2. Аналіз мобільних API файлів

### 2.1 Файли для перевірки:
- `mobile/api/axiosConfig.js` - Конфігурація HTTP клієнта
- `mobile/api/appointmentsApi.js` - API для записів на обслуговування
- `mobile/api/vehiclesApi.js` - API для автомобілів
- `mobile/api/servicesApi.js` - API для послуг
- `mobile/api/notificationsApi.js` - API для сповіщень
- `mobile/api/appointmentsService.js` - Сервіс для записів
- `mobile/api/vehiclesService.js` - Сервіс для автомобілів
- `mobile/api/serviceRecordsService.js` - Сервіс для записів обслуговування
- `mobile/api/notificationsService.js` - Сервіс для сповіщень
- `mobile/api/reminderService.js` - Сервіс для нагадувань
- `mobile/api/userSettingsService.js` - Сервіс для налаштувань користувача
- `mobile/api/vehicleCatalogApi.js` - API для каталогу автомобілів
- `mobile/api/scheduleService.js` - Сервіс для розкладу
- `mobile/api/mileageRequestService.js` - Сервіс для запитів пробігу
- `mobile/api/interactionService.js` - Сервіс для взаємодій
- `mobile/api/pushNotificationsService.js` - Сервіс для push-сповіщень

## 3. Детальний план перевірки

### 3.0 Етап 0: Очищення заголовків (ЗАВЕРШЕНО ✅)

**Завдання:** Видалення дублювання заголовків `Authorization`, `apikey` та `Prefer` у всіх API сервісах.

**Виправлені файли:**
- ✅ `vehiclesApi.js` - видалено дублювання `Authorization` та `apikey`
- ✅ `vehiclesService.js` - видалено дублювання заголовків
- ✅ `appointmentsApi.js` - видалено дублювання заголовків
- ✅ `appointmentsService.js` - видалено дублювання заголовків
- ✅ `servicesApi.js` - видалено дублювання заголовків
- ✅ `notificationsService.js` - видалено дублювання заголовків
- ✅ `reminderService.js` - видалено дублювання заголовків
- ✅ `scheduleService.js` - видалено дублювання заголовків
- ✅ `interactionService.js` - видалено дублювання заголовків

**Результат:** Всі API сервіси тепер використовують `axiosConfig.js` для автоматичного додавання заголовків авторизації, що забезпечує:
- Консистентність у всіх запитах
- Відсутність дублювання заголовків
- Простоту підтримки коду
- Сумісність з сервером

### 3.0.1 Етап 0.1: Виправлення Supabase-style параметрів (ЗАВЕРШЕНО ✅)

**Завдання:** Заміна Supabase-style query параметрів на стандартні REST API параметри.

**Виправлені файли:**
- ✅ `scheduleService.js` - замінено `select=*`, `eq.`, `gte.`, `lte.`, `like.`, `order=` на стандартні параметри
- ✅ `interactionService.js` - замінено `select=*`, `eq.`, `order=` на стандартні параметри
- ✅ `vehiclesService.js` - замінено `id=eq.` на REST шляхи `/api/vehicles/:id`
- ✅ `appointmentsService.js` - видалено `select=*`, `order=` параметри

**Результат:** Всі API сервіси тепер використовують стандартні REST API конвенції:
- Стандартні query параметри замість Supabase-style
- REST шляхи з ID в URL замість query фільтрів
- Сумісність з серверними endpoints
- Чистий та зрозумілий код

### 3.0.2 Етап 0.2: Виправлення Error Handling (ЗАВЕРШЕНО ✅)

**Завдання:** Замінити fallback на тестові дані на proper error handling з викиданням помилок

**Виправлені файли:**
- ✅ `vehiclesApi.js` - видалено fallback на тестові дані, додано proper error handling
- ✅ `vehicleCatalogApi.js` - видалено fallback на тестові дані марок автомобілів, додано proper error handling
- ✅ `serviceRecordsService.js` - видалено fallback на тестові дані сервісних записів, додано proper error handling
- ✅ `appointmentsApi.js` - видалено fallback на тестові дані записів, додано proper error handling
- ✅ `vehiclesService.js` - виправлено неконсистентність endpoint'ів (додано `/api` префікс)

**Результат:** Усі API сервіси тепер правильно обробляють помилки, викидаючи зрозумілі повідомлення про помилки замість повернення тестових даних.

### 3.0.3 Етап 0.3: Виправлення Дублювання та Неконсистентності

**Дата:** 2025-01-27

**Виправлені файли:**
- `scheduleService.js` - виправлено неконсистентність endpoint'ів `/api/masters` → `/api/mechanics`
- `appointmentsApi.js` - видалено залишки тестових даних після попереднього виправлення

**Виявлені проблеми:**
- Дублювання функціональності між `vehiclesApi.js` та `vehiclesService.js`
- Дублювання функціональності між `appointmentsApi.js` та `appointmentsService.js`
- Неконсистентність у назвах endpoint'ів (`/api/masters` vs `/api/mechanics`)

**Результат:** Виправлено неконсистентність endpoint'ів у `scheduleService.js`. Видалено залишки тестових даних з `appointmentsApi.js`. Виявлено дублювання функціональності між API файлами, що потребує подальшого рефакторингу.

### 3.1 Етап 1: Перевірка базової конфігурації

#### 3.1.1 axiosConfig.js
**Що перевіряти:**
- ✅ Базовий URL (`http://192.168.1.13:3000`)
- ✅ Налаштування headers для автентифікації
- ✅ Interceptors для обробки токенів
- ✅ Обробка помилок 401/403
- ✅ Логіка refresh токенів

**Потенційні проблеми:**
- Неправильний базовий URL
- Відсутність або неправильне додавання Authorization header
- Неправильна обробка expired токенів
- Відсутність обробки network errors

### 3.2 Етап 2: Перевірка автентифікації

#### 3.2.1 Перевірити наявність auth API файлу
**Файл:** `mobile/api/authApi.js` (якщо існує)
**Endpoints для перевірки:**
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`

**Що перевіряти:**
- Правильність URL endpoints
- Структура request body
- Обробка response
- Збереження токенів

### 3.3 Етап 3: Перевірка API для автомобілів

#### 3.3.1 vehiclesApi.js
**Функції для перевірки:**
- `getUserVehicles()` → `GET /api/vehicles`
- `getVehicleByVin()` → `GET /api/vehicles/:vin`
- `addVehicle()` → `POST /api/vehicles`
- `updateVehicle()` → `PUT /api/vehicles/:vin`
- `deleteVehicle()` → `DELETE /api/vehicles/:vin`

**Що перевіряти:**
- ✅ Правильність URL endpoints
- ✅ Параметри запитів (query params, path params)
- ✅ Структура request body
- ✅ Headers (Authorization) - **ВИПРАВЛЕНО**
- ❌ Обробка response (перевірити структуру даних)
- ❌ Error handling

**Виявлені проблеми:**
- Використання Supabase-style query params (`select=*`) замість стандартних REST
- ✅ Дублювання headers (`Authorization` та `apikey`) - **ВИПРАВЛЕНО**
- Fallback на тестові дані замість proper error handling

#### 3.3.2 vehiclesService.js
**Що перевіряти:**
- Використання vehiclesApi функцій
- Додаткова бізнес-логіка
- Кешування даних
- Валідація даних

### 3.4 Етап 4: Перевірка API для записів на обслуговування

#### 3.4.1 appointmentsApi.js
**Функції для перевірки:**
- `getUserAppointments()` → `GET /api/appointments`
- `getAppointmentById()` → `GET /api/appointments/:id`
- `createAppointment()` → `POST /api/appointments`
- `updateAppointment()` → `PUT /api/appointments/:id`
- `deleteAppointment()` → `DELETE /api/appointments/:id`

**Що перевіряти:**
- ✅ Правильність URL endpoints
- ❌ Параметри запитів (перевірити Supabase-style params)
- ❌ Структура request body для створення/оновлення
- ✅ Headers (Authorization) - **ВИПРАВЛЕНО**
- ❌ Обробка response
- ❌ Error handling

**Виявлені проблеми:**
- Використання Supabase query params (`select=*`, `order=scheduled_time.desc`)
- ✅ Дублювання headers - **ВИПРАВЛЕНО**
- Fallback на тестові дані

#### 3.4.2 appointmentsService.js
**Що перевіряти:**
- Використання appointmentsApi функцій
- Бізнес-логіка для записів
- Валідація даних перед відправкою

### 3.5 Етап 5: Перевірка API для послуг

#### 3.5.1 servicesApi.js
**Функції для перевірки:**
- `getAllServices()` → `GET /api/services`
- `getServiceById()` → `GET /api/services/:id`
- `getUserServiceRecords()` - потрібно з'ясувати endpoint
- `addServiceRecord()` - потрібно з'ясувати endpoint

**Що перевіряти:**
- ❌ Правильність URL endpoints (плутанина між services та service records)
- ❌ Параметри запитів
- ❌ Структура request body
- ✅ Headers
- ❌ Обробка response

**Виявлені проблеми:**
- Плутанина між `/api/services` (послуги) та service records (записи обслуговування)
- Використання Supabase-style query params

### 3.6 Етап 6: Перевірка додаткових API

#### 3.6.1 notificationsApi.js
**Endpoints:** `/api/notifications`

#### 3.6.2 serviceRecordsService.js
**Потрібно з'ясувати:** Чи є окремий endpoint для service records

#### 3.6.3 reminderService.js
**Endpoints:** `/api/reminders`

#### 3.6.4 userSettingsService.js
**Endpoints:** `/api/users/profile` або `/api/users/settings`

#### 3.6.5 vehicleCatalogApi.js
**Потрібно з'ясувати:** Чи є endpoints для каталогу автомобілів

## 4. Пріоритети виправлень

### 4.1 Критичні (Пріоритет 1)
1. **axiosConfig.js** - Базова конфігурація HTTP клієнта
2. **vehiclesApi.js** - Основний функціонал для автомобілів
3. **appointmentsApi.js** - Основний функціонал для записів

### 4.2 Важливі (Пріоритет 2)
1. **servicesApi.js** - API для послуг
2. **notificationsApi.js** - Сповіщення
3. **Auth API** - Автентифікація (якщо існує окремий файл)

### 4.3 Додаткові (Пріоритет 3)
1. **serviceRecordsService.js** - Записи обслуговування
2. **reminderService.js** - Нагадування
3. **userSettingsService.js** - Налаштування користувача
4. **vehicleCatalogApi.js** - Каталог автомобілів

## 5. Типові проблеми та їх виправлення

### 5.1 Supabase-style query parameters
**Проблема:** Використання `select=*`, `order=field.desc`, `id=eq.value`
**Виправлення:** Замінити на стандартні REST API параметри або видалити

**Приклад:**
```javascript
// Неправильно (Supabase style)
const response = await axiosAuth.get('/api/vehicles', {
  params: {
    select: '*',
    order: 'created_at.desc'
  }
});

// Правильно (REST API)
const response = await axiosAuth.get('/api/vehicles');
```

### 5.2 Дублювання headers
**Проблема:** Додавання `apikey` header разом з `Authorization`
**Виправлення:** Використовувати тільки `Authorization: Bearer {token}`

**Приклад:**
```javascript
// Неправильно
const headers = {
  'Authorization': `Bearer ${token}`,
  'apikey': token
};

// Правильно
const headers = {
  'Authorization': `Bearer ${token}`
};
```

### 5.3 Fallback на тестові дані
**Проблема:** При помилці API повертаються тестові дані
**Виправлення:** Proper error handling з повідомленнями користувачу

**Приклад:**
```javascript
// Неправильно
try {
  const response = await api.call();
  return response.data;
} catch (error) {
  console.log('Error, using test data');
  return testData;
}

// Правильно
try {
  const response = await api.call();
  return response.data;
} catch (error) {
  console.error('API Error:', error);
  throw new Error('Не вдалося завантажити дані. Перевірте підключення до інтернету.');
}
```

### 5.4 Неправильні endpoints
**Проблема:** Плутанина між різними типами даних (services vs service records)
**Виправлення:** Чітко розділити endpoints відповідно до серверної структури

## 6. Результати аудиту

### 6.1 Виконані виправлення

#### 6.1.1 Видалення тестових даних
- **vehiclesApi.js**: Замінено тестові дані на викидання помилок
- **vehicleCatalogApi.js**: Замінено тестові дані на викидання помилок  
- **serviceRecordsService.js**: Замінено тестові дані на викидання помилок
- **appointmentsApi.js**: Замінено тестові дані на викидання помилок

#### 6.1.2 Виправлення endpoint'ів
- **vehiclesService.js**: Додано префікс `/api` до всіх endpoint'ів
- **scheduleService.js**: Змінено `/api/masters` на `/api/mechanics` для консистентності

#### 6.1.3 Виправлення логування
- **vehicleCatalogApi.js**: Замінено `console.log` на `console.error` для помилок
- **notificationsApi.js**: Замінено `console.log` на `console.error` для помилок
- **serviceRecordsService.js**: Замінено `console.log` на `console.error` для помилок

#### 6.1.4 Перевірка заголовків
- **axiosConfig.js**: Підтверджено правильне налаштування `Content-Type: application/json` для всіх POST/PUT запитів

### 6.2 Виявлені проблеми

#### 6.2.1 Критичне дублювання функціональності

**Appointments (Записи на обслуговування):**
- **appointmentsApi.js**: Базові CRUD операції (getUserAppointments, getAppointmentDetails, createAppointment, updateAppointment)
- **appointmentsService.js**: Розширений функціонал (getAllAppointments, confirmAppointment, startAppointment, completeAppointment, cancelAppointment)
- **Використання**: appointmentsApi.js використовується в DashboardScreen, appointmentsService.js - в MasterDashboardScreen та CreateAppointmentScreen

**Vehicles (Автомобілі):**
- **vehiclesApi.js**: Функції для користувачів (getUserVehicles, getVehicleDetails, updateVehicle, deleteVehicle)
- **vehiclesService.js**: Адміністративні функції (getAllVehicles, createVehicle, getVehicleServiceRecords)
- **Використання**: vehiclesApi.js використовується в користувацьких екранах, vehiclesService.js - в адміністративних

#### 6.2.2 Архітектурні проблеми
- **Неконсистентні назви функцій**: getUserVehicles vs getAllVehicles, getUserAppointments vs getAllAppointments
- **Змішування ролей**: Деякі файли містять як користувацькі, так і адміністративні функції
- **Відсутність чіткого розділення**: Немає явного розділення між API для різних ролей користувачів

#### 6.2.3 Рекомендації щодо рефакторингу
1. **Розділити за ролями**: Створити окремі файли для користувацьких та адміністративних API
2. **Стандартизувати назви**: Використовувати консистентні назви функцій
3. **Об'єднати дублюючий код**: Винести спільну логіку в базові сервіси

#### 6.2.4 Неконсистентність у форматуванні дат
- Різні файли використовують різні підходи до роботи з датами
- Рекомендується стандартизувати використання часових зон

#### 6.2.5 Безпека
- Не виявлено жорстко закодованих секретів або API ключів
- Правильна обробка HTTP статус кодів в axiosConfig.js
- Відсутні проблеми з async/await використанням

## 7. План виконання

### 7.1 Фаза 1: Аналіз та документування (1-2 дні)
1. Детальний аналіз кожного API файлу
2. Порівняння з серверними endpoints
3. Документування всіх невідповідностей
4. Створення списку змін

### 7.2 Фаза 2: Виправлення критичних проблем (2-3 дні)
1. Виправлення axiosConfig.js
2. Виправлення vehiclesApi.js
3. Виправлення appointmentsApi.js
4. Тестування основного функціоналу

### 7.3 Фаза 3: Виправлення важливих проблем (2-3 дні)
1. Виправлення servicesApi.js
2. Виправлення notificationsApi.js
3. Додавання/виправлення auth API
4. Тестування розширеного функціоналу

### 7.4 Фаза 4: Виправлення додаткових проблем (1-2 дні)
1. Виправлення решти API файлів
2. Оптимізація та рефакторинг
3. Фінальне тестування

### 7.5 Фаза 5: Тестування та валідація (1-2 дні)
1. Комплексне тестування всіх API
2. Тестування на різних пристроях
3. Перевірка error handling
4. Документування змін

## 8. Критерії успіху

### 7.1 Технічні критерії
- ✅ Всі API запити використовують правильні endpoints
- ✅ Правильна структура request/response
- ✅ Proper error handling без fallback на тестові дані
- ✅ Консистентне використання headers
- ✅ Відсутність Supabase-specific параметрів

### 7.2 Функціональні критерії
- ✅ Успішна автентифікація користувачів
- ✅ Завантаження та відображення автомобілів
- ✅ Створення та управління записами на обслуговування
- ✅ Отримання списку послуг
- ✅ Робота сповіщень та нагадувань

### 7.3 Критерії якості
- ✅ Відсутність console.error в production
- ✅ Зрозумілі повідомлення про помилки для користувачів
- ✅ Швидкий час відгуку API
- ✅ Стабільна робота без crashes

## 9. Інструменти для тестування

### 8.1 Автоматизоване тестування
- Jest для unit тестів API функцій
- Postman/Insomnia для тестування endpoints
- React Native Testing Library для integration тестів

### 8.2 Ручне тестування
- Тестування на Android емуляторі
- Тестування на iOS симуляторі
- Тестування на реальних пристроях
- Тестування різних network conditions

### 8.3 Моніторинг
- Логування API запитів та відповідей
- Моніторинг performance metrics
- Tracking помилок та crashes

## 10. Документація змін

Після кожного виправлення необхідно документувати:
- Що було змінено
- Чому було змінено
- Як це впливає на функціонал
- Результати тестування

Цей план забезпечить систематичну перевірку та виправлення всіх невідповідностей між мобільним додатком та сервером, гарантуючи стабільну роботу API.