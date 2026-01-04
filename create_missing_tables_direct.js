const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createMissingTablesDirect() {
  try {
    console.log('Створюю відсутні таблиці через прямі запити...');
    
    // Створюємо таблиці по одній
    const tables = [
      {
        name: 'mileage_requests',
        sql: `CREATE TABLE IF NOT EXISTS public.mileage_requests (
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
        )`
      },
      {
        name: 'service_stations',
        sql: `CREATE TABLE IF NOT EXISTS public.service_stations (
          id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
          name text NOT NULL,
          address text NOT NULL,
          phone text NULL,
          email text NULL,
          working_hours text NULL,
          created_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT service_stations_pkey PRIMARY KEY (id)
        )`
      },
      {
        name: 'mechanics',
        sql: `CREATE TABLE IF NOT EXISTS public.mechanics (
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
        )`
      },
      {
        name: 'services',
        sql: `CREATE TABLE IF NOT EXISTS public.services (
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
        )`
      }
    ];
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const table of tables) {
      try {
        console.log(`Створюю таблицю ${table.name}...`);
        
        // Спробуємо виконати через різні методи
        let success = false;
        
        // Метод 1: Спроба через rpc
        try {
          const { data, error } = await supabase.rpc('exec_sql', {
            sql_query: table.sql
          });
          
          if (!error) {
            console.log(`✅ Таблиця ${table.name} створена через RPC`);
            successCount++;
            success = true;
          }
        } catch (rpcError) {
          // RPC не працює, продовжуємо
        }
        
        // Метод 2: Спроба через прямий запит (якщо RPC не спрацював)
        if (!success) {
          try {
            // Спробуємо створити таблицю через insert (це не спрацює, але покаже чи таблиця існує)
            const { data, error } = await supabase
              .from(table.name)
              .select('*')
              .limit(1);
            
            if (!error) {
              console.log(`ℹ️  Таблиця ${table.name} вже існує`);
              successCount++;
            } else {
              console.log(`❌ Таблиця ${table.name} не існує і не може бути створена автоматично`);
              errorCount++;
            }
          } catch (directError) {
            console.log(`❌ Помилка при перевірці таблиці ${table.name}:`, directError.message);
            errorCount++;
          }
        }
        
      } catch (err) {
        console.error(`❌ Помилка при створенні таблиці ${table.name}:`, err.message);
        errorCount++;
      }
    }
    
    // Створюємо індекси
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_mileage_requests_user_id ON public.mileage_requests USING btree (user_id)',
      'CREATE INDEX IF NOT EXISTS idx_mileage_requests_vehicle_vin ON public.mileage_requests USING btree (vehicle_vin)',
      'CREATE INDEX IF NOT EXISTS idx_mileage_requests_status ON public.mileage_requests USING btree (status)',
      'CREATE INDEX IF NOT EXISTS idx_service_stations_name ON public.service_stations USING btree (name)',
      'CREATE INDEX IF NOT EXISTS idx_service_stations_address ON public.service_stations USING btree (address)',
      'CREATE INDEX IF NOT EXISTS idx_mechanics_service_station_id ON public.mechanics USING btree (service_station_id)',
      'CREATE INDEX IF NOT EXISTS idx_mechanics_name ON public.mechanics USING btree (name)',
      'CREATE INDEX IF NOT EXISTS idx_services_service_station_id ON public.services USING btree (service_station_id)',
      'CREATE INDEX IF NOT EXISTS idx_services_name ON public.services USING btree (name)'
    ];
    
    console.log('\nСтворюю індекси...');
    for (const indexSQL of indexes) {
      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: indexSQL
        });
        
        if (!error) {
          console.log('✅ Індекс створено');
        }
      } catch (err) {
        // Ігноруємо помилки індексів
      }
    }
    
    console.log('\n=== ПІДСУМОК ===');
    console.log(`Успішно оброблено: ${successCount} таблиць`);
    console.log(`Помилок: ${errorCount}`);
    
    if (errorCount > 0) {
      console.log('\n⚠️  РЕКОМЕНДАЦІЇ:');
      console.log('1. Відкрийте Supabase Dashboard');
      console.log('2. Перейдіть до SQL Editor');
      console.log('3. Виконайте вміст файлу missing_tables.sql');
      console.log('\nАбо скопіюйте та виконайте наступні команди:');
      
      const sqlContent = fs.readFileSync('missing_tables.sql', 'utf8');
      console.log('\n--- SQL ДЛЯ ВИКОНАННЯ ---');
      console.log(sqlContent);
    } else {
      console.log('\n✅ Всі таблиці створено успішно!');
    }
    
  } catch (err) {
    console.error('Критична помилка:', err.message);
  }
}

if (require.main === module) {
  createMissingTablesDirect();
}

module.exports = { createMissingTablesDirect };
