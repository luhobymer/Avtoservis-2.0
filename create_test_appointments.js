require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Помилка: SUPABASE_URL або SUPABASE_SERVICE_ROLE_KEY не знайдено в .env файлі');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestAppointments() {
  try {
    console.log('📅 Створення тестових записів на прийом...');
    
    // Отримуємо користувачів
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name')
      .limit(5);
    
    if (usersError || !users || users.length === 0) {
      console.error('❌ Не вдалося отримати користувачів:', usersError);
      return;
    }
    
    // Отримуємо транспортні засоби
    const { data: vehicles, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('vin, user_id, brand, model')
      .limit(5);
    
    if (vehiclesError || !vehicles || vehicles.length === 0) {
      console.error('❌ Не вдалося отримати транспортні засоби:', vehiclesError);
      return;
    }
    
    // Отримуємо послуги
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('*')
      .limit(5);
    
    if (servicesError || !services || services.length === 0) {
      console.error('❌ Не вдалося отримати послуги:', servicesError);
      return;
    }
    
    // Отримуємо механіків
    const { data: mechanics, error: mechanicsError } = await supabase
      .from('mechanics')
      .select('id, name')
      .limit(3);
    
    console.log(`✅ Знайдено: ${users.length} користувачів, ${vehicles.length} транспортних засобів, ${services.length} послуг, ${mechanics?.length || 0} механіків`);
    
    // Створюємо тестові записи
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dayAfterTomorrow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    const testAppointments = [
      {
        user_id: users[0]?.id,
        vehicle_vin: vehicles[0]?.vin,
        service_type: services[0]?.name || 'Технічний огляд',
        scheduled_time: tomorrow.toISOString(),
        appointment_date: tomorrow.toISOString().split('T')[0], // Тільки дата
        date: tomorrow.toISOString().split('T')[0], // Додаємо поле date
        time: '09:00:00', // Додаємо поле time
        status: 'pending'
      },
      {
        user_id: users[1]?.id,
        vehicle_vin: vehicles[1]?.vin,
        service_type: services[1]?.name || 'Заміна масла',
        scheduled_time: dayAfterTomorrow.toISOString(),
        appointment_date: dayAfterTomorrow.toISOString().split('T')[0],
        date: dayAfterTomorrow.toISOString().split('T')[0], // Додаємо поле date
        time: '10:00:00', // Додаємо поле time
        status: 'pending'
      },
      {
        user_id: users[2]?.id,
        vehicle_vin: vehicles[2]?.vin,
        service_type: services[2]?.name || 'Діагностика',
        scheduled_time: threeDaysLater.toISOString(),
        appointment_date: threeDaysLater.toISOString().split('T')[0],
        date: threeDaysLater.toISOString().split('T')[0], // Додаємо поле date
        time: '11:00:00', // Додаємо поле time
        status: 'pending'
      }
    ];
    
    for (const appointmentData of testAppointments) {
      console.log(`\n📅 Створення запису: ${appointmentData.service_type}`);
      
      const { data, error } = await supabase
        .from('appointments')
        .insert(appointmentData)
        .select();
      
      if (error) {
        console.error(`❌ Помилка при створенні запису:`, error);
      } else {
        console.log(`✅ Запис створено успішно`);
        console.log(`   Послуга: ${appointmentData.service_type}`);
        console.log(`   Час: ${appointmentData.scheduled_time}`);
        console.log(`   Статус: ${appointmentData.status}`);
      }
    }
    
    console.log('\n🎉 Створення тестових записів завершено!');
    
    // Показуємо статистику
    const { data: allAppointments, error: countError } = await supabase
      .from('appointments')
      .select('*')
      .order('scheduled_time', { ascending: true });
    
    if (countError) {
      console.error('❌ Помилка при підрахунку записів:', countError);
    } else {
      console.log(`\n📊 Загальна кількість записів у БД: ${allAppointments?.length || 0}`);
      if (allAppointments && allAppointments.length > 0) {
        console.log('\n📅 Список всіх записів:');
        allAppointments.slice(0, 5).forEach((appointment, index) => {
          const date = new Date(appointment.scheduled_time).toLocaleDateString('uk-UA');
          console.log(`  ${index + 1}. ${appointment.service_type} - ${date} (${appointment.status})`);
        });
        if (allAppointments.length > 5) {
          console.log(`  ... та ще ${allAppointments.length - 5} записів`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Загальна помилка:', error);
  }
}

createTestAppointments();