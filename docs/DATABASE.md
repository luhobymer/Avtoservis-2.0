# База даних проекту Avtoservis

## Налаштування бази даних

### Основні параметри
- **Тип бази даних**: MySQL
- **Назва бази даних**: avtserv
- **Хост**: 127.0.0.1
- **Порт**: 3306
- **Користувач**: root
- **Пароль**: (порожній)

### Змінні середовища (.env)
```
# MySQL Database Configuration
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=avtserv
MYSQL_USER=root
MYSQL_PASSWORD=

# JWT Secret
JWT_SECRET=avtoservis_jwt_secret_key_2024

# Server Port
PORT=5001
```

### Конфігурація підключення
```javascript
module.exports = {
  database: 'avtserv',
  username: 'root',
  password: '',
  host: '127.0.0.1',
  port: 3306,
  dialect: 'mysql',
  logging: false,
  dialectOptions: {
    connectTimeout: 60000
  }
};
```

## Структура моделей даних

### User
- name: STRING, обов'язкове
- email: STRING, обов'язкове, унікальне, валідація email
- password: STRING, обов'язкове
- role: ENUM('client', 'admin'), за замовчуванням 'client'
- phone: STRING, обов'язкове

### Vehicle
- make: STRING, обов'язкове
- model: STRING, обов'язкове
- year: INTEGER, обов'язкове
- vin: STRING, обов'язкове, унікальне
- licensePlate: STRING, обов'язкове
- mileage: INTEGER, обов'язкове
- lastService: DATE, необов'язкове

### Appointment
- serviceType: STRING, обов'язкове
- description: TEXT, обов'язкове
- status: ENUM('scheduled', 'in-progress', 'completed', 'cancelled'), за замовчуванням 'scheduled'
- scheduledDate: DATE, обов'язкове
- estimatedCompletionDate: DATE, обов'язкове
- actualCompletionDate: DATE, необов'язкове
- notes: JSON, необов'язкове

### ServiceRecord
- serviceType: STRING, обов'язкове
- description: TEXT, обов'язкове
- mileage: INTEGER, обов'язкове

## Аналіз поточного функціоналу

### Сервісні записи (ServiceRecords)
- Відображення історії обслуговування в ServiceHistoryScreen.js
- Статистика обслуговування в AdminStatisticsScreen.js та StatisticsScreen.js
- Управління сервісними записами в AdminPanel.jsx

### Запчастини (Parts)
- Відсутній повноцінний функціонал управління запчастинами
- Частково реалізовано в статистиці (partsInventory)

### Ремонтні роботи (RepairWorks)
- Частково реалізовано в історії обслуговування
- Потребує розширення для зв'язку з запчастинами

### Платежі (Payments)
- Базова інформація про вартість послуг
- Потребує розширення для повноцінного управління платежами

### Фотографії (Photos)
- Функціонал відсутній
- Потрібно додати можливість завантаження та перегляду фото

### Страхування (Insurance)
- Функціонал відсутній
- Потрібно додати управління страховою інформацією

## Необхідні SQL-запити для оновлення структури БД

```sql
-- Таблиця ServiceRecords
CREATE TABLE IF NOT EXISTS service_records (
    id SERIAL PRIMARY KEY,
    car_id INTEGER REFERENCES cars(id),
    service_date DATE NOT NULL,
    mileage INTEGER,
    work_performed TEXT,
    cost DECIMAL(10,2),
    recommendations TEXT,
    next_service_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблиця Parts
CREATE TABLE IF NOT EXISTS parts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    part_number VARCHAR(100),
    manufacturer VARCHAR(255),
    price DECIMAL(10,2),
    quantity_in_stock INTEGER DEFAULT 0,
    minimum_stock_level INTEGER DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблиця RepairWorks
CREATE TABLE IF NOT EXISTS repair_works (
    id SERIAL PRIMARY KEY,
    service_record_id INTEGER REFERENCES service_records(id),
    work_type VARCHAR(255) NOT NULL,
    description TEXT,
    labor_hours DECIMAL(4,2),
    labor_cost DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблиця WorkParts (зв'язок між роботами та запчастинами)
CREATE TABLE IF NOT EXISTS work_parts (
    id SERIAL PRIMARY KEY,
    repair_work_id INTEGER REFERENCES repair_works(id),
    part_id INTEGER REFERENCES parts(id),
    quantity_used INTEGER NOT NULL,
    unit_price DECIMAL(10,2),
    total_cost DECIMAL(10,2)
);

-- Таблиця Payments
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    service_record_id INTEGER REFERENCES service_records(id),
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('cash', 'card', 'transfer', 'other') DEFAULT 'cash',
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    transaction_id VARCHAR(255),
    notes TEXT
);

-- Таблиця Photos
CREATE TABLE IF NOT EXISTS photos (
    id SERIAL PRIMARY KEY,
    service_record_id INTEGER REFERENCES service_records(id),
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    description TEXT,
    photo_type ENUM('before', 'during', 'after', 'damage', 'part', 'other') DEFAULT 'other',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблиця Insurance
CREATE TABLE IF NOT EXISTS insurance (
    id SERIAL PRIMARY KEY,
    car_id INTEGER REFERENCES cars(id),
    insurance_company VARCHAR(255) NOT NULL,
    policy_number VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    coverage_type VARCHAR(255),
    premium_amount DECIMAL(10,2),
    deductible DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Збережені налаштування

Налаштування бази даних збережені в наступних файлах:
- `.env.backup` - містить змінні середовища для підключення до бази даних
- `database-config.backup.js` - містить конфігурацію підключення до бази даних
- `models-structure.backup.js` - містить структуру моделей даних