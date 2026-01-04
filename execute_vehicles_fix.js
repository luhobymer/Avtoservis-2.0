const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase конфігурація з .env файлу
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Помилка: SUPABASE_URL або SUPABASE_SERVICE_ROLE_KEY не знайдено в .env файлі');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeVehiclesFix() {
  console.log('🔧 Починаємо виправлення зв\'язків appointments ↔ vehicles...');
  
  try {
    // 1. Перевіряємо поточний стан таблиць
    console.log('\n1. Перевіряємо поточний стан таблиць...');
    
    const { data: appointments, error: appError } = await supabase
      .from('appointments')
      .select('id, vehicle_id, vehicle_vin')
      .limit(5);
    
    if (appError) {
      console.log('❌ Помилка при отриманні appointments:', appError.message);
      return;
    }
    
    console.log('📋 Поточні appointments (перші 5):');
    console.log(appointments);
    
    const { data: vehicles, error: vehError } = await supabase
      .from('vehicles')
      .select('vin, make, model, brand, year')
      .limit(5);
    
    if (vehError) {
      console.log('❌ Помилка при отриманні vehicles:', vehError.message);
      return;
    }
    
    console.log('\n🚗 Поточні vehicles (перші 5):');
    console.log(vehicles);
    
    // 2. Оновлюємо vehicle_id для appointments на основі vehicle_vin
    console.log('\n2. Оновлюємо зв\'язки appointments → vehicles...');
    
    for (const appointment of appointments) {
      if (appointment.vehicle_vin && !appointment.vehicle_id) {
        // Знаходимо відповідний vehicle за VIN
        const matchingVehicle = vehicles.find(v => v.vin === appointment.vehicle_vin);
        
        if (matchingVehicle) {
          const { error: updateError } = await supabase
            .from('appointments')
            .update({ vehicle_id: matchingVehicle.vin })
            .eq('id', appointment.id);
          
          if (updateError) {
            console.log(`❌ Помилка оновлення appointment ${appointment.id}:`, updateError.message);
          } else {
            console.log(`✅ Appointment ${appointment.id} оновлено: vehicle_id = ${matchingVehicle.vin}`);
          }
        } else {
          console.log(`⚠️ Не знайдено vehicle з VIN ${appointment.vehicle_vin} для appointment ${appointment.id}`);
        }
      }
    }
    
    // 3. Перевіряємо результат JOIN запиту
    console.log('\n3. Тестуємо JOIN запит appointments ↔ vehicles...');
    
    const { data: joinResult, error: joinError } = await supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        service_type,
        status,
        vehicles (
          vin,
          make,
          model,
          brand,
          year
        )
      `)
      .limit(5);
    
    if (joinError) {
      console.log('❌ Помилка JOIN запиту:', joinError.message);
    } else {
      console.log('✅ JOIN запит успішний!');
      console.log('📊 Результат JOIN (перші 5 записів):');
      console.log(JSON.stringify(joinResult, null, 2));
    }
    
    // 4. Статистика
    console.log('\n4. Фінальна статистика...');
    
    const { count: totalAppointments } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true });
    
    const { count: appointmentsWithVehicles } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .not('vehicle_id', 'is', null);
    
    console.log(`📈 Загальна кількість appointments: ${totalAppointments}`);
    console.log(`🔗 Appointments з vehicle_id: ${appointmentsWithVehicles}`);
    console.log(`📊 Відсоток зв\'язаних записів: ${((appointmentsWithVehicles / totalAppointments) * 100).toFixed(1)}%`);
    
    console.log('\n✅ Виправлення зв\'язків appointments ↔ vehicles завершено!');
    
  } catch (error) {
    console.log('❌ Загальна помилка:', error.message);
  }
}

executeVehiclesFix();