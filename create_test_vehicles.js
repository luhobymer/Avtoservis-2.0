const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Помилка: SUPABASE_URL або SUPABASE_SERVICE_ROLE_KEY не знайдено в .env файлі');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestVehicles() {
  try {
    console.log('🚗 Створення тестових транспортних засобів...');
    
    // Спочатку отримаємо список користувачів
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .limit(4);
    
    if (usersError) {
      console.error('❌ Помилка при отриманні користувачів:', usersError);
      return;
    }
    
    if (!users || users.length === 0) {
      console.error('❌ Не знайдено користувачів у базі даних');
      return;
    }
    
    console.log(`✅ Знайдено ${users.length} користувачів`);
    
    const testVehicles = [
      {
        user_id: users[0]?.id,
        vin: 'WBAVA31070NL12345',
        brand: 'BMW',
        make: 'BMW',
        model: 'X3',
        year: 2020,
        color: 'Чорний',
        registration_number: 'AA1234BB',
        body_type: 'SUV',
        engine_type: 'Бензин',
        engine_volume: 2.0,
        mileage: 45000
      },
      {
        user_id: users[1]?.id,
        vin: 'WVWZZZ1JZ3W123456',
        brand: 'Volkswagen',
        make: 'Volkswagen',
        model: 'Passat',
        year: 2019,
        color: 'Сірий',
        registration_number: 'BB5678CC',
        body_type: 'Седан',
        engine_type: 'Дизель',
        engine_volume: 2.0,
        mileage: 62000
      },
      {
        user_id: users[2]?.id,
        vin: 'KMHJ281DPMU123456',
        brand: 'Hyundai',
        make: 'Hyundai',
        model: 'Elantra',
        year: 2021,
        color: 'Білий',
        registration_number: 'CC9012DD',
        body_type: 'Седан',
        engine_type: 'Бензин',
        engine_volume: 1.6,
        mileage: 28000
      }
    ];
    
    for (const vehicleData of testVehicles) {
      console.log(`\n🚗 Створення транспортного засобу: ${vehicleData.brand} ${vehicleData.model}`);
      
      // Перевіримо, чи не існує вже такий VIN
      const { data: existingVehicle } = await supabase
        .from('vehicles')
        .select('id')
        .eq('vin', vehicleData.vin)
        .single();
      
      if (existingVehicle) {
        console.log(`⚠️  Транспортний засіб з VIN ${vehicleData.vin} вже існує`);
        continue;
      }
      
      const { data, error } = await supabase
        .from('vehicles')
        .insert(vehicleData)
        .select();
      
      if (error) {
        console.error(`❌ Помилка при створенні ${vehicleData.brand} ${vehicleData.model}:`, error);
      } else {
        console.log(`✅ Транспортний засіб створено успішно`);
        console.log(`   ID: ${data[0]?.id || 'Невідомо'}`);
        console.log(`   VIN: ${data[0]?.vin || vehicleData.vin}`);
        console.log(`   Власник: ${users.find(u => u.id === vehicleData.user_id)?.email}`);
      }
    }
    
    console.log('\n🎉 Створення тестових транспортних засобів завершено!');
    
    // Показуємо статистику
    const { data: allVehicles, error: countError } = await supabase
      .from('vehicles')
      .select('vin, brand, model');
    
    if (countError) {
      console.error('❌ Помилка при підрахунку транспортних засобів:', countError);
    } else {
      console.log(`\n📊 Загальна кількість транспортних засобів у БД: ${allVehicles?.length || 0}`);
      if (allVehicles && allVehicles.length > 0) {
        console.log('\n🚗 Список всіх транспортних засобів:');
        allVehicles.forEach((vehicle, index) => {
          console.log(`  ${index + 1}. ${vehicle.brand} ${vehicle.model} (VIN: ${vehicle.vin})`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Загальна помилка:', error);
  }
}

createTestVehicles();