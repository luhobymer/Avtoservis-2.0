const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkServicesStructure() {
  console.log('=== Перевірка структури таблиці services ===');
  
  try {
    // Перевіряємо, чи існує таблиця services
    console.log('1. Перевірка існування таблиці services...');
    const { data: tableExists, error: tableError } = await supabase
      .from('services')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('Помилка при доступі до таблиці services:', tableError);
      return;
    }
    
    console.log('✓ Таблиця services існує');
    console.log('Приклад даних:', tableExists);
    
    // Перевіряємо які колонки є в таблиці через select *
    console.log('\n2. Перевірка всіх даних з таблиці services...');
    const { data: allServices, error: allError } = await supabase
      .from('services')
      .select('*');
    
    if (allError) {
      console.error('Помилка при отриманні даних services:', allError);
    } else {
      console.log(`Знайдено ${allServices.length} записів у таблиці services`);
      if (allServices.length > 0) {
        console.log('Структура першого запису:');
        console.log('Колонки:', Object.keys(allServices[0]));
        console.log('Перший запис:', allServices[0]);
      }
    }
    
    // Перевіряємо конкретно колонку duration
    console.log('\n3. Перевірка колонки duration...');
    const { data: durationTest, error: durationError } = await supabase
      .from('services')
      .select('id, name, duration')
      .limit(5);
    
    if (durationError) {
      console.error('Помилка при отриманні duration:', durationError);
    } else {
      console.log('✓ Колонка duration існує');
      console.log('Дані з duration:', durationTest);
    }
    
    // Перевіряємо колонку duration_minutes
    console.log('\n4. Перевірка колонки duration_minutes...');
    const { data: durationMinutesTest, error: durationMinutesError } = await supabase
      .from('services')
      .select('id, name, duration_minutes')
      .limit(5);
    
    if (durationMinutesError) {
      console.error('Помилка при отриманні duration_minutes:', durationMinutesError);
    } else {
      console.log('✓ Колонка duration_minutes існує');
      console.log('Дані з duration_minutes:', durationMinutesTest);
    }
    
  } catch (error) {
    console.error('Загальна помилка:', error);
  }
}

// Також перевіримо таблицю appointments
async function checkAppointmentsStructure() {
  console.log('\n=== Перевірка структури таблиці appointments ===');
  
  try {
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('*')
      .limit(1);
    
    if (appointmentsError) {
      console.error('Помилка при доступі до таблиці appointments:', appointmentsError);
    } else {
      console.log('✓ Таблиця appointments існує');
      if (appointments.length > 0) {
        console.log('Колонки appointments:', Object.keys(appointments[0]));
      }
    }
    
    // Перевіряємо зв'язки з vehicles
    console.log('\n5. Перевірка зв\'язків appointments-vehicles...');
    const { data: appointmentsWithVehicles, error: vehiclesError } = await supabase
      .from('appointments')
      .select('id, vehicle_id, vehicles(*)')
      .limit(3);
    
    if (vehiclesError) {
      console.error('Помилка при отриманні зв\'язків з vehicles:', vehiclesError);
    } else {
      console.log('✓ Зв\'язок appointments-vehicles працює');
      console.log('Приклад даних:', appointmentsWithVehicles);
    }
    
  } catch (error) {
    console.error('Помилка при перевірці appointments:', error);
  }
}

async function main() {
  await checkServicesStructure();
  await checkAppointmentsStructure();
}

main();