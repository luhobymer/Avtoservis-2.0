const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Відсутні змінні середовища SUPABASE_URL або SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkVehiclesTableStructure() {
  console.log('🔍 Перевірка структури таблиці vehicles...');
  
  try {
    // Спроба отримати дані з таблиці vehicles
    console.log('\n1. Перевірка доступу до таблиці vehicles:');
    const { data: vehiclesData, error: vehiclesError } = await supabase
      .from('vehicles')
      .select('*')
      .limit(1);
    
    if (vehiclesError) {
      console.error('❌ Помилка доступу до таблиці vehicles:', vehiclesError.message);
      console.error('Код помилки:', vehiclesError.code);
      console.error('Деталі:', vehiclesError.details);
    } else {
      console.log('✅ Таблиця vehicles доступна');
      console.log('Кількість записів (перший запис):', vehiclesData?.length || 0);
      if (vehiclesData && vehiclesData.length > 0) {
        console.log('Структура першого запису:', Object.keys(vehiclesData[0]));
      }
    }
    
    // Спроба отримати дані з таблиці service_records
    console.log('\n2. Перевірка доступу до таблиці service_records:');
    const { data: serviceRecordsData, error: serviceRecordsError } = await supabase
      .from('service_records')
      .select('*')
      .limit(1);
    
    if (serviceRecordsError) {
      console.error('❌ Помилка доступу до таблиці service_records:', serviceRecordsError.message);
      console.error('Код помилки:', serviceRecordsError.code);
    } else {
      console.log('✅ Таблиця service_records доступна');
      console.log('Кількість записів (перший запис):', serviceRecordsData?.length || 0);
      if (serviceRecordsData && serviceRecordsData.length > 0) {
        console.log('Структура першого запису:', Object.keys(serviceRecordsData[0]));
      }
    }
    
    // Тест JOIN запиту між vehicles та service_records
    console.log('\n3. Тест JOIN запиту між vehicles та service_records:');
    const { data: joinData, error: joinError } = await supabase
      .from('service_records')
      .select(`
        *,
        vehicles!inner(
          id,
          make,
          model,
          user_id
        )
      `)
      .limit(1);
    
    if (joinError) {
      console.error('❌ Помилка JOIN запиту:', joinError.message);
      console.error('Код помилки:', joinError.code);
      console.error('Деталі:', joinError.details);
    } else {
      console.log('✅ JOIN запит успішний');
      console.log('Результат JOIN:', joinData?.length || 0, 'записів');
    }
    
    // Перевірка існування стовпців
    console.log('\n4. Перевірка існування стовпців через прямий запит:');
    const { data: columnTest, error: columnError } = await supabase
      .from('vehicles')
      .select('id, user_id, make, model')
      .limit(1);
    
    if (columnError) {
      console.error('❌ Помилка доступу до стовпців vehicles:', columnError.message);
      console.error('Код помилки:', columnError.code);
    } else {
      console.log('✅ Стовпці vehicles доступні');
      console.log('Отримані стовпці:', columnTest ? Object.keys(columnTest[0] || {}) : 'немає даних');
    }
    
  } catch (error) {
    console.error('❌ Загальна помилка:', error.message);
  }
}

checkVehiclesTableStructure();