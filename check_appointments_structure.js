const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Помилка: SUPABASE_URL або SUPABASE_SERVICE_ROLE_KEY не знайдено в .env файлі');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAppointmentsStructure() {
  try {
    console.log('🔍 Перевірка структури таблиці appointments...');
    
    // Спробуємо отримати один запис для розуміння структури
    const { data: testData, error: testError } = await supabase
      .from('appointments')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.error('❌ Помилка при доступі до таблиці appointments:', testError);
    } else {
      console.log('✅ Таблиця appointments доступна');
      console.log('📊 Кількість записів:', testData?.length || 0);
      if (testData && testData.length > 0) {
        console.log('🔍 Структура (на основі першого запису):');
        console.log(Object.keys(testData[0]));
        console.log('\n📝 Приклад запису:');
        console.log(testData[0]);
      } else {
        console.log('⚠️ Таблиця порожня, спробуємо створити тестовий запис...');
        
        // Отримаємо користувача та транспортний засіб
        const { data: users } = await supabase
          .from('users')
          .select('id')
          .limit(1);
        
        const { data: vehicles } = await supabase
          .from('vehicles')
          .select('vin')
          .limit(1);
        
        if (users && users.length > 0 && vehicles && vehicles.length > 0) {
          const testAppointment = {
            user_id: users[0].id,
            vehicle_vin: vehicles[0].vin,
            service_type: 'Тестова послуга',
            scheduled_time: new Date().toISOString(),
            appointment_date: new Date().toISOString().split('T')[0],
            status: 'pending'
          };
          
          console.log('\n🧪 Спроба створення тестового запису:');
          console.log(testAppointment);
          
          const { data: newRecord, error: insertError } = await supabase
            .from('appointments')
            .insert(testAppointment)
            .select();
          
          if (insertError) {
            console.error('❌ Помилка при створенні тестового запису:', insertError);
          } else {
            console.log('✅ Тестовий запис створено успішно!');
            console.log('🔍 Структура створеного запису:');
            console.log(Object.keys(newRecord[0]));
          }
        } else {
          console.log('❌ Не вдалося знайти користувачів або транспортні засоби для тесту');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Загальна помилка:', error);
  }
}

checkAppointmentsStructure();