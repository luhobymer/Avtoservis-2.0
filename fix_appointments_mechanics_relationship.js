const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase URL або ключ не знайдено в .env файлі');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndFixAppointmentsMechanicsRelationship() {
  console.log('🔍 Перевірка зв\'язку між appointments та mechanics...');
  
  try {
    // 1. Перевірка існування таблиць
    console.log('\n1. Перевірка існування таблиць:');
    
    const { data: appointmentsExists, error: appointmentsError } = await supabase
      .from('appointments')
      .select('count', { count: 'exact', head: true });
    
    if (appointmentsError) {
      console.error('❌ Таблиця appointments не існує:', appointmentsError.message);
      return;
    }
    console.log('✅ Таблиця appointments існує');
    
    const { data: mechanicsExists, error: mechanicsError } = await supabase
      .from('mechanics')
      .select('count', { count: 'exact', head: true });
    
    if (mechanicsError) {
      console.error('❌ Таблиця mechanics не існує:', mechanicsError.message);
      return;
    }
    console.log('✅ Таблиця mechanics існує');
    
    // 2. Перевірка структури таблиці appointments
    console.log('\n2. Перевірка структури таблиці appointments:');
    
    const { data: appointmentSample, error: sampleError } = await supabase
      .from('appointments')
      .select('*')
      .limit(1)
      .single();
    
    if (sampleError && sampleError.code !== 'PGRST116') {
      console.error('❌ Помилка при отриманні зразка appointments:', sampleError.message);
    } else {
      console.log('✅ Структура appointments:', appointmentSample ? Object.keys(appointmentSample) : 'Таблиця порожня');
      if (appointmentSample && appointmentSample.mechanic_id !== undefined) {
        console.log('✅ Стовпець mechanic_id існує в appointments');
      } else {
        console.log('❌ Стовпець mechanic_id відсутній в appointments');
      }
    }
    
    // 3. Перевірка структури таблиці mechanics
    console.log('\n3. Перевірка структури таблиці mechanics:');
    
    const { data: mechanicSample, error: mechanicSampleError } = await supabase
      .from('mechanics')
      .select('*')
      .limit(1)
      .single();
    
    if (mechanicSampleError && mechanicSampleError.code !== 'PGRST116') {
      console.error('❌ Помилка при отриманні зразка mechanics:', mechanicSampleError.message);
    } else {
      console.log('✅ Структура mechanics:', mechanicSample ? Object.keys(mechanicSample) : 'Таблиця порожня');
    }
    
    // 4. Тестування запиту з JOIN
    console.log('\n4. Тестування запиту з JOIN:');
    
    try {
      const { data: joinTest, error: joinError } = await supabase
        .from('appointments')
        .select(`
          *,
          mechanics(*)
        `)
        .limit(1);
      
      if (joinError) {
        console.error('❌ Помилка JOIN запиту:', joinError.message);
        console.error('Деталі помилки:', joinError);
      } else {
        console.log('✅ JOIN запит успішний');
        console.log('Результат:', joinTest);
      }
    } catch (error) {
      console.error('❌ Критична помилка JOIN:', error.message);
    }
    
    // 5. Альтернативний запит без JOIN
    console.log('\n5. Альтернативний запит appointments без JOIN:');
    
    try {
      const { data: simpleAppointments, error: simpleError } = await supabase
        .from('appointments')
        .select('*')
        .limit(5);
      
      if (simpleError) {
        console.error('❌ Помилка простого запиту appointments:', simpleError.message);
      } else {
        console.log('✅ Простий запит appointments успішний');
        console.log('Кількість записів:', simpleAppointments?.length || 0);
        if (simpleAppointments && simpleAppointments.length > 0) {
          console.log('Приклад запису:', simpleAppointments[0]);
        }
      }
    } catch (error) {
      console.error('❌ Критична помилка простого запиту:', error.message);
    }
    
    // 6. Перевірка mechanics
    console.log('\n6. Перевірка таблиці mechanics:');
    
    try {
      const { data: mechanicsData, error: mechanicsDataError } = await supabase
        .from('mechanics')
        .select('*')
        .limit(5);
      
      if (mechanicsDataError) {
        console.error('❌ Помилка запиту mechanics:', mechanicsDataError.message);
      } else {
        console.log('✅ Запит mechanics успішний');
        console.log('Кількість механіків:', mechanicsData?.length || 0);
        if (mechanicsData && mechanicsData.length > 0) {
          console.log('Приклад механіка:', mechanicsData[0]);
        }
      }
    } catch (error) {
      console.error('❌ Критична помилка запиту mechanics:', error.message);
    }
    
    // 7. Рекомендації
    console.log('\n7. Рекомендації:');
    console.log('- Якщо JOIN не працює, можливо потрібно оновити схему в Supabase');
    console.log('- Перевірте чи існує foreign key constraint в базі даних');
    console.log('- Можливо потрібно виконати REFRESH SCHEMA в Supabase Dashboard');
    
  } catch (error) {
    console.error('❌ Загальна помилка:', error.message);
    console.error('Стек помилки:', error.stack);
  }
}

checkAndFixAppointmentsMechanicsRelationship();