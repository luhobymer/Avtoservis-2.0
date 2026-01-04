const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAppointmentsServicesRelationship() {
  console.log('🔧 Виправлення зв\'язків між appointments та services...');
  console.log('============================================================');

  try {
    // 1. Перевіримо поточну структуру appointments
    console.log('\n1. Перевірка структури appointments:');
    const { data: structure, error: structureError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'appointments')
      .eq('table_schema', 'public');
    
    if (structureError) {
      console.log('❌ Помилка отримання структури:', structureError.message);
    } else {
      console.log('✅ Структура appointments:', structure);
      const hasServiceId = structure.some(col => col.column_name === 'service_id');
      console.log(`service_id існує: ${hasServiceId}`);
    }

    // 2. Перевіримо дані в services
    console.log('\n2. Перевірка даних в services:');
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('id, name')
      .limit(5);
    
    if (servicesError) {
      console.log('❌ Помилка отримання services:', servicesError.message);
    } else {
      console.log(`✅ Знайдено ${services.length} послуг:`);
      services.forEach(service => {
        console.log(`  - ID: ${service.id}, Назва: ${service.name}`);
      });
    }

    // 3. Спробуємо додати колонку service_id, якщо її немає
    console.log('\n3. Додавання колонки service_id (якщо потрібно):');
    try {
      const { error: addColumnError } = await supabase.rpc('exec_sql', {
        sql: `
          DO $$
          BEGIN
              IF NOT EXISTS (
                  SELECT 1 
                  FROM information_schema.columns 
                  WHERE table_name = 'appointments' 
                      AND column_name = 'service_id'
                      AND table_schema = 'public'
              ) THEN
                  ALTER TABLE appointments ADD COLUMN service_id INTEGER;
                  RAISE NOTICE 'Додано колонку service_id';
              ELSE
                  RAISE NOTICE 'Колонка service_id вже існує';
              END IF;
          END $$;
        `
      });
      
      if (addColumnError) {
        console.log('❌ Помилка додавання колонки:', addColumnError.message);
      } else {
        console.log('✅ Колонка service_id перевірена/додана');
      }
    } catch (err) {
      console.log('⚠️ Не вдалося виконати SQL через RPC, спробуємо альтернативний метод');
    }

    // 4. Альтернативний метод - пряме додавання через Supabase SQL
    console.log('\n4. Альтернативне додавання service_id:');
    try {
      // Спробуємо вставити тестовий запис з service_id
      const testInsert = {
        user_id: 'c66a6048-7573-4a01-b55c-7af0f2993f00', // ID з test@example.com
        vehicle_id: null, // Поки що null
        service_id: 1, // ID першої послуги
        scheduled_time: new Date().toISOString(),
        status: 'pending',
        notes: 'Тестовий запис для перевірки зв\'язків'
      };
      
      const { data: insertData, error: insertError } = await supabase
        .from('appointments')
        .insert([testInsert])
        .select();
      
      if (insertError) {
        console.log('❌ Помилка вставки тестового запису:', insertError.message);
        console.log('Деталі:', insertError);
      } else {
        console.log('✅ Тестовий запис створено:', insertData[0]);
      }
    } catch (err) {
      console.log('❌ Помилка при створенні тестового запису:', err.message);
    }

    // 5. Тестуємо JOIN після змін
    console.log('\n5. Тестування JOIN appointments ↔ services:');
    const { data: joinData, error: joinError } = await supabase
      .from('appointments')
      .select(`
        id,
        service_id,
        scheduled_time,
        status,
        services (
          id,
          name,
          price
        )
      `)
      .limit(5);
    
    if (joinError) {
      console.log('❌ JOIN все ще не працює:', joinError.message);
      console.log('Деталі:', joinError);
    } else {
      console.log(`✅ JOIN працює! Отримано ${joinData.length} записів`);
      if (joinData.length > 0) {
        console.log('Приклад результату:', JSON.stringify(joinData[0], null, 2));
      }
    }

    // 6. Перевіримо appointments без JOIN
    console.log('\n6. Перевірка appointments без JOIN:');
    const { data: simpleAppointments, error: simpleError } = await supabase
      .from('appointments')
      .select('*')
      .limit(5);
    
    if (simpleError) {
      console.log('❌ Помилка отримання appointments:', simpleError.message);
    } else {
      console.log(`✅ Знайдено ${simpleAppointments.length} записів appointments`);
      if (simpleAppointments.length > 0) {
        console.log('Приклад запису:', simpleAppointments[0]);
      }
    }

  } catch (error) {
    console.error('❌ Загальна помилка:', error);
  }

  console.log('\n============================================================');
  console.log('🎯 Виправлення завершено.');
}

// Запуск виправлення
fixAppointmentsServicesRelationship();