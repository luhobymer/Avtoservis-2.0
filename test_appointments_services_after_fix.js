const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testAppointmentsServicesRelationship() {
  console.log('🔍 Тестування зв\'язків appointments ↔ services після виправлень...');
  console.log('============================================================');

  try {
    // 1. Перевірка структури appointments
    console.log('\n1. Перевірка структури таблиці appointments:');
    const { data: appointmentsStructure, error: structureError } = await supabase
      .from('appointments')
      .select('*')
      .limit(1);
    
    if (structureError) {
      console.log('❌ Помилка отримання структури appointments:', structureError.message);
    } else {
      console.log('✅ Таблиця appointments доступна');
      if (appointmentsStructure.length > 0) {
        console.log('📋 Колонки в appointments:', Object.keys(appointmentsStructure[0]));
      }
    }

    // 2. Перевірка даних в services
    console.log('\n2. Перевірка даних в services:');
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('id, name, price')
      .order('id');
    
    if (servicesError) {
      console.log('❌ Помилка отримання services:', servicesError.message);
    } else {
      console.log(`✅ Знайдено ${services.length} послуг:`);
      services.forEach(service => {
        console.log(`  - ID: ${service.id}, Назва: ${service.name}, Ціна: ${service.price}`);
      });
    }

    // 3. Перевірка appointments
    console.log('\n3. Перевірка записів appointments:');
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('id, user_id, service_type, service_id, scheduled_time, status')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (appointmentsError) {
      console.log('❌ Помилка отримання appointments:', appointmentsError.message);
    } else {
      console.log(`✅ Знайдено ${appointments.length} записів appointments:`);
      appointments.forEach(appointment => {
        console.log(`  - ID: ${appointment.id}`);
        console.log(`    Service Type: ${appointment.service_type}`);
        console.log(`    Service ID: ${appointment.service_id}`);
        console.log(`    Status: ${appointment.status}`);
        console.log(`    Scheduled: ${appointment.scheduled_time}`);
        console.log('    ---');
      });
    }

    // 4. Тестування JOIN appointments ↔ services
    console.log('\n4. Тестування JOIN appointments ↔ services:');
    const { data: joinData, error: joinError } = await supabase
      .from('appointments')
      .select(`
        id,
        service_type,
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
      console.log('❌ JOIN все ще не працює:', joinError.message);
      console.log('Деталі:', joinError);
    } else {
      console.log('✅ JOIN працює успішно!');
      console.log(`📊 Отримано ${joinData.length} записів з JOIN:`);
      joinData.forEach(appointment => {
        console.log(`  - Appointment ID: ${appointment.id}`);
        console.log(`    Service Type: ${appointment.service_type}`);
        console.log(`    Service ID: ${appointment.service_id}`);
        if (appointment.services) {
          console.log(`    Service Name: ${appointment.services.name}`);
          console.log(`    Service Price: ${appointment.services.price}`);
        } else {
          console.log(`    Service: не знайдено (service_id: ${appointment.service_id})`);
        }
        console.log('    ---');
      });
    }

    // 5. Створення тестового запису (якщо є послуги)
    if (services && services.length > 0) {
      console.log('\n5. Створення тестового запису appointment:');
      
      // Спочатку отримаємо користувача
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id')
        .limit(1);
      
      if (usersError || !users || users.length === 0) {
        console.log('❌ Не знайдено користувачів для тестового запису');
      } else {
        // Отримаємо транспортний засіб
        const { data: vehicles, error: vehiclesError } = await supabase
          .from('vehicles')
          .select('vin')
          .limit(1);
        
        if (vehiclesError || !vehicles || vehicles.length === 0) {
          console.log('❌ Не знайдено транспортних засобів для тестового запису');
        } else {
          const testAppointment = {
            user_id: users[0].id,
            vehicle_vin: vehicles[0].vin,
            service_type: 'Тестова послуга',
            service_id: services[0].id, // Використовуємо першу доступну послугу
            scheduled_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Завтра
            status: 'pending'
          };
          
          const { data: newAppointment, error: createError } = await supabase
            .from('appointments')
            .insert([testAppointment])
            .select();
          
          if (createError) {
            console.log('❌ Помилка створення тестового запису:', createError.message);
            console.log('Деталі:', createError);
          } else {
            console.log('✅ Тестовий запис створено успішно!');
            console.log('📝 Новий appointment:', newAppointment[0]);
            
            // Тестуємо JOIN з новим записом
            console.log('\n6. Тестування JOIN з новим записом:');
            const { data: newJoinData, error: newJoinError } = await supabase
              .from('appointments')
              .select(`
                id,
                service_type,
                service_id,
                services (
                  id,
                  name,
                  price
                )
              `)
              .eq('id', newAppointment[0].id);
            
            if (newJoinError) {
              console.log('❌ JOIN з новим записом не працює:', newJoinError.message);
            } else {
              console.log('✅ JOIN з новим записом працює!');
              console.log('📊 Результат JOIN:', newJoinData[0]);
            }
          }
        }
      }
    }

  } catch (error) {
    console.log('❌ Загальна помилка:', error.message);
  }

  console.log('\n============================================================');
  console.log('🎯 Тестування завершено.');
}

testAppointmentsServicesRelationship();