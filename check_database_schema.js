const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function checkDatabaseSchema() {
  try {
    console.log('🔍 Детальна перевірка схеми бази даних...');
    console.log('=' .repeat(60));
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase конфігурація не знайдена в .env файлі');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. Отримуємо всі колонки таблиці appointments
    console.log('\n1. Детальна структура таблиці appointments:');
    const { data: appointmentsData, error: appointmentsError } = await supabase
      .from('appointments')
      .select('*')
      .limit(3);
    
    if (appointmentsError) {
      console.error('❌ Помилка отримання appointments:', appointmentsError);
    } else if (appointmentsData && appointmentsData.length > 0) {
      console.log('✅ Приклад запису appointments:');
      console.log(JSON.stringify(appointmentsData[0], null, 2));
      
      // Аналізуємо колонки
      const columns = Object.keys(appointmentsData[0]);
      console.log('\n📋 Всі колонки appointments:', columns);
      
      // Шукаємо колонки, що можуть бути зовнішніми ключами
      const foreignKeyColumns = columns.filter(col => 
        col.endsWith('_id') || col.includes('vehicle') || col.includes('car')
      );
      console.log('🔗 Потенційні зовнішні ключі:', foreignKeyColumns);
    }
    
    // 2. Отримуємо всі колонки таблиці vehicles
    console.log('\n2. Детальна структура таблиці vehicles:');
    const { data: vehiclesData, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('*')
      .limit(3);
    
    if (vehiclesError) {
      console.error('❌ Помилка отримання vehicles:', vehiclesError);
    } else if (vehiclesData && vehiclesData.length > 0) {
      console.log('✅ Приклад запису vehicles:');
      console.log(JSON.stringify(vehiclesData[0], null, 2));
      
      const columns = Object.keys(vehiclesData[0]);
      console.log('\n📋 Всі колонки vehicles:', columns);
    }
    
    // 3. Спробуємо простий JOIN без вкладених об'єктів
    console.log('\n3. Тестування простих JOIN запитів:');
    
    // Спробуємо отримати appointments з vehicle_id
    try {
      const { data: joinData, error: joinError } = await supabase
        .from('appointments')
        .select(`
          id,
          date,
          time,
          status,
          vehicle_id
        `)
        .limit(5);
      
      if (joinError) {
        console.log('❌ Помилка простого запиту appointments:', joinError.message);
      } else {
        console.log('✅ Простий запит appointments успішний:');
        console.log('📊 Кількість записів:', joinData.length);
        if (joinData.length > 0) {
          console.log('📋 Приклад:', joinData[0]);
          
          // Перевіряємо унікальні vehicle_id
          const vehicleIds = [...new Set(joinData.map(item => item.vehicle_id).filter(id => id))];
          console.log('🚗 Унікальні vehicle_id в appointments:', vehicleIds);
        }
      }
    } catch (e) {
      console.log('❌ Виняток при простому запиті:', e.message);
    }
    
    // 4. Перевіряємо чи існують записи vehicles з відповідними ID
    console.log('\n4. Перевірка відповідності vehicle_id:');
    
    try {
      const { data: vehicleIds } = await supabase
        .from('vehicles')
        .select('id')
        .limit(10);
      
      if (vehicleIds) {
        console.log('✅ ID vehicles в базі:', vehicleIds.map(v => v.id));
      }
    } catch (e) {
      console.log('❌ Помилка отримання vehicle IDs:', e.message);
    }
    
    // 5. Спробуємо ручний JOIN
    console.log('\n5. Ручний JOIN appointments + vehicles:');
    
    try {
      // Отримуємо appointments
      const { data: appointments } = await supabase
        .from('appointments')
        .select('*')
        .limit(3);
      
      if (appointments && appointments.length > 0) {
        for (const appointment of appointments) {
          console.log(`\n📅 Appointment ID: ${appointment.id}`);
          console.log(`   Vehicle ID: ${appointment.vehicle_id}`);
          
          if (appointment.vehicle_id) {
            // Отримуємо відповідний vehicle
            const { data: vehicle, error: vehicleError } = await supabase
              .from('vehicles')
              .select('*')
              .eq('id', appointment.vehicle_id)
              .single();
            
            if (vehicleError) {
              console.log(`   ❌ Vehicle не знайдено: ${vehicleError.message}`);
            } else {
              console.log(`   ✅ Vehicle знайдено: ${vehicle.make} ${vehicle.model}`);
            }
          }
        }
      }
    } catch (e) {
      console.log('❌ Помилка ручного JOIN:', e.message);
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ Детальна перевірка схеми завершена.');
    
  } catch (error) {
    console.error('❌ Загальна помилка:', error.message);
  }
}

checkDatabaseSchema();