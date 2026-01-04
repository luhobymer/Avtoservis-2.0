const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Відсутні змінні середовища SUPABASE_URL або SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkServiceRecordsStructure() {
  console.log('🔍 Перевірка структури таблиці service_records...');
  
  try {
    // Отримання всіх стовпців таблиці service_records
    console.log('\n1. Отримання структури таблиці service_records:');
    const { data: serviceRecordsData, error: serviceRecordsError } = await supabase
      .from('service_records')
      .select('*')
      .limit(1);
    
    if (serviceRecordsError) {
      console.error('❌ Помилка доступу до service_records:', serviceRecordsError.message);
      console.error('Код помилки:', serviceRecordsError.code);
    } else {
      console.log('✅ Таблиця service_records доступна');
      if (serviceRecordsData && serviceRecordsData.length > 0) {
        console.log('📋 Доступні стовпці в таблиці service_records:');
        Object.keys(serviceRecordsData[0]).forEach((column, index) => {
          console.log(`  ${index + 1}. ${column}: ${typeof serviceRecordsData[0][column]} = ${serviceRecordsData[0][column]}`);
        });
      } else {
        console.log('📋 Таблиця service_records порожня');
        // Спробуємо отримати структуру через порожній запит
        const { data: emptyData, error: emptyError } = await supabase
          .from('service_records')
          .select('*')
          .eq('id', '00000000-0000-0000-0000-000000000000');
        
        if (!emptyError) {
          console.log('📋 Структура таблиці service_records доступна (порожня)');
        }
      }
    }
    
    // Перевірка конкретних стовпців
    console.log('\n2. Перевірка конкретних стовпців service_records:');
    const columnsToCheck = [
      'id', 
      'vehicle_id', 
      'vehicle_vin', 
      'service_history_id',
      'service_date',
      'mileage',
      'description',
      'work_description',
      'service_id',
      'mechanic_id'
    ];
    
    for (const column of columnsToCheck) {
      try {
        const { data, error } = await supabase
          .from('service_records')
          .select(column)
          .limit(1);
        
        if (error) {
          console.log(`❌ Стовпець '${column}': ${error.message} (код: ${error.code})`);
        } else {
          console.log(`✅ Стовпець '${column}': доступний`);
        }
      } catch (err) {
        console.log(`❌ Стовпець '${column}': помилка - ${err.message}`);
      }
    }
    
    // Перевірка зв'язку з vehicles
    console.log('\n3. Перевірка можливих зв\'язків з vehicles:');
    
    // Спроба через vehicle_id
    try {
      const { data: joinById, error: joinByIdError } = await supabase
        .from('service_records')
        .select(`
          id,
          vehicle_id,
          vehicles!service_records_vehicle_id_fkey(
            vin,
            make,
            model
          )
        `)
        .limit(1);
      
      if (joinByIdError) {
        console.log('❌ Зв\'язок через vehicle_id:', joinByIdError.message);
      } else {
        console.log('✅ Зв\'язок через vehicle_id працює');
      }
    } catch (err) {
      console.log('❌ Помилка зв\'язку через vehicle_id:', err.message);
    }
    
    // Спроба через vehicle_vin
    try {
      const { data: joinByVin, error: joinByVinError } = await supabase
        .from('service_records')
        .select(`
          id,
          vehicle_vin
        `)
        .limit(1);
      
      if (joinByVinError) {
        console.log('❌ Стовпець vehicle_vin:', joinByVinError.message);
      } else {
        console.log('✅ Стовпець vehicle_vin доступний');
      }
    } catch (err) {
      console.log('❌ Помилка vehicle_vin:', err.message);
    }
    
  } catch (error) {
    console.error('❌ Загальна помилка:', error.message);
    console.error('Стек помилки:', error.stack);
  }
}

checkServiceRecordsStructure();