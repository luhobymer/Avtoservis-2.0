const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixAppointmentsStructure() {
  console.log('🔧 Виправлення структури таблиці appointments...');
  
  try {
    // Спочатку перевіримо поточну структуру
    console.log('📋 Перевірка поточної структури appointments...');
    
    const { data: currentStructure, error: structureError } = await supabase
      .from('appointments')
      .select('*')
      .limit(1);
    
    if (structureError) {
      console.error('❌ Помилка при перевірці структури:', structureError);
      return;
    }
    
    console.log('✅ Поточна структура appointments отримана');
    
    // SQL для оновлення структури appointments
    const updateSQL = `
      -- Додаємо відсутні колонки до appointments
      DO $$
      BEGIN
        -- Додаємо service_id якщо не існує
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'appointments' AND column_name = 'service_id') THEN
          ALTER TABLE appointments ADD COLUMN service_id UUID REFERENCES services(id) ON DELETE CASCADE;
          RAISE NOTICE 'Додано колонку service_id';
        END IF;
        
        -- Додаємо mechanic_id якщо не існує
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'appointments' AND column_name = 'mechanic_id') THEN
          ALTER TABLE appointments ADD COLUMN mechanic_id UUID REFERENCES mechanics(id) ON DELETE SET NULL;
          RAISE NOTICE 'Додано колонку mechanic_id';
        END IF;
        
        -- Додаємо station_id якщо не існує
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'appointments' AND column_name = 'station_id') THEN
          ALTER TABLE appointments ADD COLUMN station_id UUID REFERENCES service_stations(id) ON DELETE CASCADE;
          RAISE NOTICE 'Додано колонку station_id';
        END IF;
        
        -- Додаємо notes якщо не існує
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'appointments' AND column_name = 'notes') THEN
          ALTER TABLE appointments ADD COLUMN notes TEXT;
          RAISE NOTICE 'Додано колонку notes';
        END IF;
        
        -- Додаємо completion_notes якщо не існує
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'appointments' AND column_name = 'completion_notes') THEN
          ALTER TABLE appointments ADD COLUMN completion_notes TEXT;
          RAISE NOTICE 'Додано колонку completion_notes';
        END IF;
        
        -- Змінюємо тип vehicle_vin на vehicle_id якщо потрібно
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'appointments' AND column_name = 'vehicle_vin') THEN
          -- Додаємо vehicle_id
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'appointments' AND column_name = 'vehicle_id') THEN
            ALTER TABLE appointments ADD COLUMN vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE;
            RAISE NOTICE 'Додано колонку vehicle_id';
          END IF;
        END IF;
      END
      $$;
      
      -- Створюємо індекси якщо не існують
      CREATE INDEX IF NOT EXISTS idx_appointments_service_id ON appointments(service_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_mechanic_id ON appointments(mechanic_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_station_id ON appointments(station_id);
      CREATE INDEX IF NOT EXISTS idx_appointments_vehicle_id ON appointments(vehicle_id);
    `;
    
    console.log('🔄 Виконання SQL для оновлення структури...');
    
    // Виконуємо SQL через RPC
    const { data: result, error: sqlError } = await supabase.rpc('exec_sql', {
      sql: updateSQL
    });
    
    if (sqlError) {
      console.error('❌ Помилка при виконанні SQL:', sqlError);
      
      // Зберігаємо SQL у файл для ручного виконання
      const fs = require('fs');
      fs.writeFileSync('fix_appointments_structure.sql', updateSQL);
      console.log('💾 SQL збережено у файл fix_appointments_structure.sql');
      console.log('📝 Виконайте цей SQL вручну через Supabase Dashboard:');
      console.log('   1. Відкрийте Supabase Dashboard');
      console.log('   2. Перейдіть до SQL Editor');
      console.log('   3. Скопіюйте та виконайте SQL з файлу fix_appointments_structure.sql');
      return;
    }
    
    console.log('✅ Структура appointments успішно оновлена!');
    console.log('📊 Результат:', result);
    
    // Перевіряємо оновлену структуру
    console.log('🔍 Перевірка оновленої структури...');
    
    const { data: columns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'appointments')
      .eq('table_schema', 'public')
      .order('ordinal_position');
    
    if (!columnsError && columns) {
      console.log('📋 Колонки таблиці appointments:');
      columns.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Загальна помилка:', error);
  }
}

fixAppointmentsStructure();
