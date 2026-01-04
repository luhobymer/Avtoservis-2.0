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

async function checkAppointmentsServicesRelationship() {
  console.log('🔧 Перевіряємо зв\'язки appointments ↔ services...');
  
  try {
    // 1. Перевіряємо структуру appointments
    console.log('\n1. Перевіряємо структуру appointments...');
    
    const { data: appointments, error: appError } = await supabase
      .from('appointments')
      .select('id, service_type, user_id, vehicle_id')
      .limit(5);
    
    if (appError) {
      console.log('❌ Помилка при отриманні appointments:', appError.message);
      return;
    }
    
    console.log('📋 Appointments (перші 5):');
    console.log(appointments);
    
    // 2. Перевіряємо структуру services
    console.log('\n2. Перевіряємо структуру services...');
    
    const { data: services, error: servError } = await supabase
      .from('services')
      .select('id, name, description, price, duration')
      .limit(5);
    
    if (servError) {
      console.log('❌ Помилка при отриманні services:', servError.message);
      return;
    }
    
    console.log('🔧 Services (перші 5):');
    console.log(services);
    
    // 3. Аналізуємо зв'язки
    console.log('\n3. Аналізуємо зв\'язки appointments ↔ services...');
    
    // Перевіряємо, чи є service_id колонка в appointments
    const appointmentKeys = appointments.length > 0 ? Object.keys(appointments[0]) : [];
    const hasServiceId = appointmentKeys.includes('service_id');
    const hasServiceType = appointmentKeys.includes('service_type');
    
    console.log(`📊 Колонки в appointments: ${appointmentKeys.join(', ')}`);
    console.log(`🔗 Має service_id: ${hasServiceId ? '✅' : '❌'}`);
    console.log(`📝 Має service_type: ${hasServiceType ? '✅' : '❌'}`);
    
    // 4. Спробуємо JOIN запит
    console.log('\n4. Тестуємо JOIN запит...');
    
    if (hasServiceId) {
      // Якщо є service_id, використовуємо його для JOIN
      const { data: joinResult, error: joinError } = await supabase
        .from('appointments')
        .select(`
          id,
          service_id,
          services (
            id,
            name,
            price,
            duration
          )
        `)
        .limit(3);
      
      if (joinError) {
        console.log('❌ Помилка JOIN через service_id:', joinError.message);
      } else {
        console.log('✅ JOIN через service_id успішний!');
        console.log('📊 Результат JOIN:');
        console.log(JSON.stringify(joinResult, null, 2));
      }
    } else {
      console.log('⚠️ Колонка service_id відсутня в appointments');
      console.log('💡 Потрібно додати service_id для зв\'язку з services');
    }
    
    // 5. Перевіряємо унікальні service_type значення
    console.log('\n5. Аналізуємо service_type значення...');
    
    const { data: uniqueServiceTypes, error: typeError } = await supabase
      .from('appointments')
      .select('service_type')
      .not('service_type', 'is', null);
    
    if (typeError) {
      console.log('❌ Помилка отримання service_type:', typeError.message);
    } else {
      const types = [...new Set(uniqueServiceTypes.map(item => item.service_type))];
      console.log('📝 Унікальні service_type в appointments:');
      types.forEach(type => console.log(`   - ${type}`));
      
      // Порівняємо з назвами services
      const serviceNames = services.map(s => s.name);
      console.log('\n🔧 Назви в таблиці services:');
      serviceNames.forEach(name => console.log(`   - ${name}`));
      
      // Знайдемо збіги
      const matches = types.filter(type => serviceNames.includes(type));
      console.log(`\n🎯 Збігів між service_type та service names: ${matches.length}`);
      if (matches.length > 0) {
        console.log('✅ Збіги:');
        matches.forEach(match => console.log(`   - ${match}`));
      }
    }
    
    // 6. Статистика
    console.log('\n6. Статистика...');
    
    const { count: totalAppointments } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true });
    
    const { count: totalServices } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📈 Загальна кількість appointments: ${totalAppointments}`);
    console.log(`🔧 Загальна кількість services: ${totalServices}`);
    
    if (hasServiceId) {
      const { count: appointmentsWithServices } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .not('service_id', 'is', null);
      
      console.log(`🔗 Appointments з service_id: ${appointmentsWithServices}`);
      console.log(`📊 Відсоток зв\'язаних записів: ${((appointmentsWithServices / totalAppointments) * 100).toFixed(1)}%`);
    }
    
    console.log('\n✅ Перевірка зв\'язків appointments ↔ services завершена!');
    
  } catch (error) {
    console.log('❌ Загальна помилка:', error.message);
  }
}

checkAppointmentsServicesRelationship();