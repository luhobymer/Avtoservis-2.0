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

async function fixAppointmentsServicesRelationship() {
  console.log('🔧 Виправляємо зв\'язки appointments ↔ services...');
  
  try {
    // 1. Перевіряємо поточний стан
    console.log('\n1. Перевіряємо поточний стан...');
    
    const { data: appointments, error: appError } = await supabase
      .from('appointments')
      .select('id, service_type')
      .limit(10);
    
    if (appError) {
      console.log('❌ Помилка при отриманні appointments:', appError.message);
      return;
    }
    
    const { data: services, error: servError } = await supabase
      .from('services')
      .select('id, name')
      .limit(10);
    
    if (servError) {
      console.log('❌ Помилка при отриманні services:', servError.message);
      return;
    }
    
    console.log(`📋 Знайдено ${appointments.length} appointments`);
    console.log(`🔧 Знайдено ${services.length} services`);
    
    // 2. Створюємо мапу service_type → service_id
    console.log('\n2. Створюємо мапу зв\'язків...');
    
    const serviceMap = {};
    services.forEach(service => {
      serviceMap[service.name] = service.id;
    });
    
    console.log('🗺️ Мапа service_type → service_id:');
    Object.entries(serviceMap).forEach(([name, id]) => {
      console.log(`   ${name} → ${id}`);
    });
    
    // 3. Перевіряємо, чи існує колонка service_id
    console.log('\n3. Перевіряємо структуру appointments...');
    
    const appointmentKeys = appointments.length > 0 ? Object.keys(appointments[0]) : [];
    const hasServiceId = appointmentKeys.includes('service_id');
    
    console.log(`🔍 Колонки в appointments: ${appointmentKeys.join(', ')}`);
    console.log(`🔗 Має service_id: ${hasServiceId ? '✅' : '❌'}`);
    
    // 4. Якщо service_id відсутня, додаємо її (через SQL)
    if (!hasServiceId) {
      console.log('\n4. Додаємо колонку service_id...');
      
      // Використовуємо RPC для виконання SQL
      const addColumnSQL = `
        ALTER TABLE appointments 
        ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id);
      `;
      
      try {
        const { error: alterError } = await supabase.rpc('exec_sql', {
          sql_query: addColumnSQL
        });
        
        if (alterError) {
          console.log('❌ Помилка додавання колонки service_id:', alterError.message);
          console.log('💡 Спробуємо альтернативний підхід...');
        } else {
          console.log('✅ Колонка service_id додана успішно!');
        }
      } catch (err) {
        console.log('❌ Помилка виконання SQL:', err.message);
        console.log('💡 Продовжуємо без додавання колонки...');
      }
    }
    
    // 5. Оновлюємо service_id для існуючих appointments
    console.log('\n5. Оновлюємо зв\'язки appointments → services...');
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const appointment of appointments) {
      const serviceId = serviceMap[appointment.service_type];
      
      if (serviceId) {
        try {
          const { error: updateError } = await supabase
            .from('appointments')
            .update({ service_id: serviceId })
            .eq('id', appointment.id);
          
          if (updateError) {
            console.log(`❌ Помилка оновлення appointment ${appointment.id}:`, updateError.message);
            errorCount++;
          } else {
            console.log(`✅ Appointment ${appointment.id}: ${appointment.service_type} → ${serviceId}`);
            updatedCount++;
          }
        } catch (err) {
          console.log(`❌ Помилка оновлення appointment ${appointment.id}:`, err.message);
          errorCount++;
        }
      } else {
        console.log(`⚠️ Не знайдено service для '${appointment.service_type}' в appointment ${appointment.id}`);
      }
    }
    
    console.log(`\n📊 Результати оновлення:`);
    console.log(`✅ Успішно оновлено: ${updatedCount}`);
    console.log(`❌ Помилки: ${errorCount}`);
    
    // 6. Тестуємо JOIN запит
    console.log('\n6. Тестуємо JOIN запит appointments ↔ services...');
    
    const { data: joinResult, error: joinError } = await supabase
      .from('appointments')
      .select(`
        id,
        service_type,
        services (
          id,
          name,
          price,
          duration
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
    
    // 7. Фінальна статистика
    console.log('\n7. Фінальна статистика...');
    
    const { count: totalAppointments } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true });
    
    const { count: appointmentsWithServices } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .not('service_id', 'is', null);
    
    console.log(`📈 Загальна кількість appointments: ${totalAppointments}`);
    console.log(`🔗 Appointments з service_id: ${appointmentsWithServices}`);
    console.log(`📊 Відсоток зв\'язаних записів: ${((appointmentsWithServices / totalAppointments) * 100).toFixed(1)}%`);
    
    console.log('\n✅ Виправлення зв\'язків appointments ↔ services завершено!');
    
  } catch (error) {
    console.log('❌ Загальна помилка:', error.message);
  }
}

fixAppointmentsServicesRelationship();