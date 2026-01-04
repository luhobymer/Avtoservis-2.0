const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAppointmentsServicesRelationship() {
  console.log('🔍 Тестування зв\'язків між appointments та services...');
  console.log('============================================================');

  try {
    // 1. Перевіримо структуру таблиці appointments
    console.log('\n1. Структура таблиці appointments:');
    const { data: appointmentsStructure, error: structureError } = await supabase
      .rpc('get_table_columns', { table_name: 'appointments' });
    
    if (structureError) {
      console.log('❌ Помилка отримання структури appointments:', structureError.message);
    } else {
      console.log('✅ Структура appointments:', appointmentsStructure);
    }

    // 2. Перевіримо наявність даних в appointments
    console.log('\n2. Дані в таблиці appointments:');
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('*')
      .limit(5);
    
    if (appointmentsError) {
      console.log('❌ Помилка отримання appointments:', appointmentsError.message);
    } else {
      console.log(`✅ Знайдено ${appointments.length} записів appointments`);
      if (appointments.length > 0) {
        console.log('Приклад запису:', appointments[0]);
      }
    }

    // 3. Перевіримо наявність даних в services
    console.log('\n3. Дані в таблиці services:');
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('*')
      .limit(5);
    
    if (servicesError) {
      console.log('❌ Помилка отримання services:', servicesError.message);
    } else {
      console.log(`✅ Знайдено ${services.length} записів services`);
      if (services.length > 0) {
        console.log('Приклад запису:', services[0]);
      }
    }

    // 4. Спробуємо JOIN між appointments та services
    console.log('\n4. Тестування JOIN appointments ↔ services:');
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
          price,
          duration
        )
      `)
      .limit(5);
    
    if (joinError) {
      console.log('❌ Помилка JOIN appointments ↔ services:', joinError.message);
      console.log('Деталі помилки:', joinError);
    } else {
      console.log(`✅ JOIN успішний! Отримано ${joinData.length} записів`);
      if (joinData.length > 0) {
        console.log('Приклад JOIN результату:', JSON.stringify(joinData[0], null, 2));
      }
    }

    // 5. Перевіримо foreign key constraints
    console.log('\n5. Перевірка foreign key constraints:');
    const { data: constraints, error: constraintsError } = await supabase
      .rpc('get_foreign_keys', { table_name: 'appointments' });
    
    if (constraintsError) {
      console.log('❌ Помилка отримання constraints:', constraintsError.message);
    } else {
      console.log('✅ Foreign key constraints:', constraints);
    }

    // 6. Альтернативний спосіб - ручний JOIN через SQL
    console.log('\n6. Альтернативний JOIN через SQL:');
    const { data: sqlJoin, error: sqlError } = await supabase
      .rpc('manual_appointments_services_join');
    
    if (sqlError) {
      console.log('❌ Помилка SQL JOIN:', sqlError.message);
    } else {
      console.log('✅ SQL JOIN успішний:', sqlJoin);
    }

  } catch (error) {
    console.error('❌ Загальна помилка:', error);
  }

  console.log('\n============================================================');
  console.log('🎯 Тестування завершено.');
}

// Запуск тестування
testAppointmentsServicesRelationship();