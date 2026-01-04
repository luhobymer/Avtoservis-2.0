const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function checkForeignKeys() {
  try {
    console.log('🔍 Перевірка зовнішніх ключів між таблицями appointments та vehicles...');
    console.log('=' .repeat(60));
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase конфігурація не знайдена в .env файлі');
      return;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // 1. Перевіряємо структуру таблиці appointments
    console.log('\n1. Структура таблиці appointments:');
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('*')
      .limit(1);
    
    if (appointmentsError) {
      console.error('❌ Помилка отримання appointments:', appointmentsError);
    } else if (appointments && appointments.length > 0) {
      console.log('✅ Колонки appointments:', Object.keys(appointments[0]));
      
      // Перевіряємо наявність колонок, що можуть посилатися на vehicles
      const vehicleColumns = Object.keys(appointments[0]).filter(key => 
        key.includes('vehicle') || key.includes('car') || key.includes('auto')
      );
      console.log('🚗 Колонки пов\'язані з vehicles:', vehicleColumns);
    }
    
    // 2. Перевіряємо структуру таблиці vehicles
    console.log('\n2. Структура таблиці vehicles:');
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('*')
      .limit(1);
    
    if (vehiclesError) {
      console.error('❌ Помилка отримання vehicles:', vehiclesError);
    } else if (vehicles && vehicles.length > 0) {
      console.log('✅ Колонки vehicles:', Object.keys(vehicles[0]));
    }
    
    // 3. Перевіряємо зв'язки через JOIN
    console.log('\n3. Перевірка зв\'язків через JOIN:');
    
    // Спробуємо різні варіанти JOIN
    const joinQueries = [
      { name: 'appointments.vehicle_id = vehicles.id', query: 'appointments(*, vehicles(*))' },
      { name: 'appointments.car_id = vehicles.id', query: 'appointments(*, vehicles!car_id(*))' },
      { name: 'appointments.auto_id = vehicles.id', query: 'appointments(*, vehicles!auto_id(*))' }
    ];
    
    for (const joinQuery of joinQueries) {
      try {
        console.log(`\n   Тестуємо зв'язок: ${joinQuery.name}`);
        const { data, error } = await supabase
          .from('appointments')
          .select(joinQuery.query)
          .limit(1);
        
        if (error) {
          console.log(`   ❌ Помилка: ${error.message}`);
        } else {
          console.log(`   ✅ Успішно! Знайдено ${data.length} записів`);
          if (data.length > 0) {
            console.log(`   📋 Структура:`, Object.keys(data[0]));
          }
        }
      } catch (e) {
        console.log(`   ❌ Виняток: ${e.message}`);
      }
    }
    
    // 4. Перевіряємо кількість записів
    console.log('\n4. Статистика таблиць:');
    
    const { count: appointmentsCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true });
    
    const { count: vehiclesCount } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Кількість appointments: ${appointmentsCount}`);
    console.log(`📊 Кількість vehicles: ${vehiclesCount}`);
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ Перевірка зовнішніх ключів завершена.');
    
  } catch (error) {
    console.error('❌ Загальна помилка:', error.message);
  }
}

checkForeignKeys();