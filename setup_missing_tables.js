const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Повний SQL для створення всіх відсутніх таблиць
const COMPLETE_MISSING_TABLES_SQL = `
-- ========================================
-- СТВОРЕННЯ ВІДСУТНІХ ТАБЛИЦЬ
-- ========================================

-- Таблиця сервісних станцій (створюємо першою, оскільки на неї посилаються інші)
CREATE TABLE IF NOT EXISTS public.service_stations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  address text NOT NULL,
  phone text NULL,
  email text NULL,
  working_hours text NULL,
  created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT service_stations_pkey PRIMARY KEY (id)
);

-- Таблиця механіків
CREATE TABLE IF NOT EXISTS public.mechanics (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  specialization text NULL,
  phone text NULL,
  email text NULL,
  service_station_id bigint NULL,
  created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT mechanics_pkey PRIMARY KEY (id),
  CONSTRAINT mechanics_service_station_id_fkey FOREIGN KEY (service_station_id) REFERENCES service_stations(id)
);

-- Таблиця послуг
CREATE TABLE IF NOT EXISTS public.services (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text NOT NULL,
  description text NULL,
  price numeric(10,2) NULL,
  duration_minutes integer NULL,
  service_station_id bigint NULL,
  created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT services_pkey PRIMARY KEY (id),
  CONSTRAINT services_service_station_id_fkey FOREIGN KEY (service_station_id) REFERENCES service_stations(id)
);

-- Таблиця запитів на оновлення пробігу
CREATE TABLE IF NOT EXISTS public.mileage_requests (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  vehicle_vin text NOT NULL,
  current_mileage integer NOT NULL,
  photo_url text NULL,
  status text NULL DEFAULT 'pending'::text,
  admin_notes text NULL,
  created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT mileage_requests_pkey PRIMARY KEY (id),
  CONSTRAINT mileage_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT mileage_requests_vehicle_vin_fkey FOREIGN KEY (vehicle_vin) REFERENCES vehicles(vin),
  CONSTRAINT mileage_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);

-- ========================================
-- СТВОРЕННЯ ІНДЕКСІВ
-- ========================================

-- Індекси для service_stations
CREATE INDEX IF NOT EXISTS idx_service_stations_name ON public.service_stations USING btree (name);
CREATE INDEX IF NOT EXISTS idx_service_stations_address ON public.service_stations USING btree (address);

-- Індекси для mechanics
CREATE INDEX IF NOT EXISTS idx_mechanics_service_station_id ON public.mechanics USING btree (service_station_id);
CREATE INDEX IF NOT EXISTS idx_mechanics_name ON public.mechanics USING btree (name);

-- Індекси для services
CREATE INDEX IF NOT EXISTS idx_services_service_station_id ON public.services USING btree (service_station_id);
CREATE INDEX IF NOT EXISTS idx_services_name ON public.services USING btree (name);

-- Індекси для mileage_requests
CREATE INDEX IF NOT EXISTS idx_mileage_requests_user_id ON public.mileage_requests USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_mileage_requests_vehicle_vin ON public.mileage_requests USING btree (vehicle_vin);
CREATE INDEX IF NOT EXISTS idx_mileage_requests_status ON public.mileage_requests USING btree (status);

-- ========================================
-- ДОДАВАННЯ ТЕСТОВИХ ДАНИХ (ОПЦІОНАЛЬНО)
-- ========================================

-- Додаємо тестову сервісну станцію
INSERT INTO public.service_stations (name, address, phone, email, working_hours)
VALUES 
  ('Автосервіс "Майстер"', 'вул. Центральна, 123, Київ', '+380501234567', 'info@master-service.ua', 'Пн-Пт: 8:00-18:00, Сб: 9:00-15:00')
ON CONFLICT DO NOTHING;

-- Додаємо тестового механіка
INSERT INTO public.mechanics (name, specialization, phone, email, service_station_id)
VALUES 
  ('Іван Петренко', 'Двигуни та трансмісія', '+380501234568', 'ivan@master-service.ua', 1)
ON CONFLICT DO NOTHING;

-- Додаємо тестові послуги
INSERT INTO public.services (name, description, price, duration_minutes, service_station_id)
VALUES 
  ('Заміна масла', 'Заміна моторного масла та масляного фільтра', 800.00, 30, 1),
  ('Діагностика двигуна', 'Комп\'ютерна діагностика двигуна', 300.00, 45, 1),
  ('Заміна гальмівних колодок', 'Заміна передніх гальмівних колодок', 1200.00, 60, 1)
ON CONFLICT DO NOTHING;
`;

async function setupMissingTables() {
  console.log('🚀 НАЛАШТУВАННЯ ВІДСУТНІХ ТАБЛИЦЬ');
  console.log('=====================================\n');
  
  try {
    // Спочатку перевіряємо, які таблиці відсутні
    console.log('1️⃣ Перевіряю існуючі таблиці...');
    
    const expectedTables = ['mileage_requests', 'service_stations', 'mechanics', 'services'];
    const existingTables = [];
    const missingTables = [];
    
    for (const tableName of expectedTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (!error) {
          existingTables.push(tableName);
          console.log(`   ✅ ${tableName} - існує`);
        } else {
          missingTables.push(tableName);
          console.log(`   ❌ ${tableName} - відсутня`);
        }
      } catch (err) {
        missingTables.push(tableName);
        console.log(`   ❌ ${tableName} - відсутня`);
      }
    }
    
    console.log(`\n📊 Результат перевірки:`);
    console.log(`   Існуючі таблиці: ${existingTables.length}`);
    console.log(`   Відсутні таблиці: ${missingTables.length}`);
    
    if (missingTables.length === 0) {
      console.log('\n🎉 Всі необхідні таблиці вже існують!');
      return;
    }
    
    // Записуємо SQL у файл
    console.log('\n2️⃣ Створюю SQL файл...');
    fs.writeFileSync('setup_missing_tables.sql', COMPLETE_MISSING_TABLES_SQL);
    console.log('   ✅ Файл setup_missing_tables.sql створено');
    
    console.log('\n3️⃣ Інструкції для створення таблиць:');
    console.log('=====================================');
    console.log('\n🔧 ВАРІАНТ 1: Через Supabase Dashboard (РЕКОМЕНДОВАНО)');
    console.log('   1. Відкрийте https://supabase.com/dashboard');
    console.log('   2. Оберіть ваш проект');
    console.log('   3. Перейдіть до "SQL Editor"');
    console.log('   4. Створіть новий запит');
    console.log('   5. Скопіюйте вміст файлу setup_missing_tables.sql');
    console.log('   6. Вставте код та натисніть "Run"');
    
    console.log('\n🔧 ВАРІАНТ 2: Через командний рядок (якщо є доступ до psql)');
    console.log('   psql -h <your-supabase-host> -U postgres -d postgres -f setup_missing_tables.sql');
    
    console.log('\n🔧 ВАРІАНТ 3: Через pgAdmin або інший PostgreSQL клієнт');
    console.log('   Відкрийте файл setup_missing_tables.sql та виконайте SQL команди');
    
    console.log('\n📋 Що буде створено:');
    missingTables.forEach(table => {
      console.log(`   • Таблиця: ${table}`);
    });
    console.log('   • Відповідні індекси для оптимізації');
    console.log('   • Тестові дані (опціонально)');
    
    console.log('\n⚠️  ВАЖЛИВО:');
    console.log('   • Переконайтеся, що таблиці users та vehicles вже існують');
    console.log('   • Виконайте SQL команди в правильному порядку');
    console.log('   • Перевірте результат після виконання');
    
    console.log('\n4️⃣ Після створення таблиць запустіть:');
    console.log('   node check_existing_tables.js');
    console.log('   для перевірки результату\n');
    
  } catch (err) {
    console.error('❌ Помилка:', err.message);
  }
}

if (require.main === module) {
  setupMissingTables();
}

module.exports = { setupMissingTables };