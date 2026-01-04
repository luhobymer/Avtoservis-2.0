require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkVehiclesStructure() {
  try {
    console.log('Перевіряю структуру таблиці vehicles...');
    
    // Перевіримо приклад даних з таблиці vehicles
    const { data: sampleData, error: dataError } = await supabase
      .from('vehicles')
      .select('*')
      .limit(5);

    if (dataError) {
      console.error('Помилка при отриманні даних vehicles:', dataError);
    } else {
      console.log(`\nЗнайдено ${sampleData.length} записів у таблиці vehicles`);
      if (sampleData.length > 0) {
        console.log('\nПриклад даних з таблиці vehicles:');
        console.table(sampleData);
        console.log('\nКолонки в таблиці vehicles:');
        console.log(Object.keys(sampleData[0]));
      } else {
        console.log('Таблиця vehicles порожня');
      }
    }

    // Перевіримо також appointments
    const { data: appointmentsData, error: appointmentsError } = await supabase
      .from('appointments')
      .select('*')
      .limit(5);

    if (appointmentsError) {
      console.error('Помилка при отриманні даних appointments:', appointmentsError);
    } else {
      console.log(`\nЗнайдено ${appointmentsData.length} записів у таблиці appointments`);
      if (appointmentsData.length > 0) {
        console.log('\nПриклад даних з таблиці appointments:');
        console.table(appointmentsData);
        console.log('\nКолонки в таблиці appointments:');
        console.log(Object.keys(appointmentsData[0]));
      } else {
        console.log('Таблиця appointments порожня');
      }
    }

    // Перевіримо services для порівняння
    const { data: servicesData, error: servicesError } = await supabase
      .from('services')
      .select('*')
      .limit(3);

    if (servicesError) {
      console.error('Помилка при отриманні даних services:', servicesError);
    } else {
      console.log(`\nЗнайдено ${servicesData.length} записів у таблиці services`);
      if (servicesData.length > 0) {
        console.log('\nПриклад даних з таблиці services:');
        console.table(servicesData);
        console.log('\nКолонки в таблиці services:');
        console.log(Object.keys(servicesData[0]));
      }
    }

    // Спробуємо простий JOIN тільки якщо є дані
    if (appointmentsData && appointmentsData.length > 0) {
      const { data: joinData, error: joinError } = await supabase
        .from('appointments')
        .select(`
          *,
          vehicles(*)
        `)
        .limit(3);

      if (joinError) {
        console.error('\nПомилка при JOIN запиті:', joinError);
      } else {
        console.log('\nРезультат JOIN appointments з vehicles:');
        console.table(joinData);
      }
    }

  } catch (error) {
    console.error('Загальна помилка:', error.message);
  }
}

checkVehiclesStructure();