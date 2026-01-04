const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Відсутні змінні середовища SUPABASE_URL або SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkVehiclesRealStructure() {
  console.log('🔍 Перевірка реальної структури таблиці vehicles...');
  
  try {
    // Спроба отримати всі стовпці без вказування конкретних назв
    console.log('\n1. Отримання всіх стовпців таблиці vehicles:');
    const { data: allColumns, error: allError } = await supabase
      .from('vehicles')
      .select('*')
      .limit(1);
    
    if (allError) {
      console.error('❌ Помилка отримання всіх стовпців:', allError.message);
    } else {
      console.log('✅ Успішно отримано дані з vehicles');
      if (allColumns && allColumns.length > 0) {
        console.log('📋 Доступні стовпці в таблиці vehicles:');
        Object.keys(allColumns[0]).forEach((column, index) => {
          console.log(`  ${index + 1}. ${column}: ${typeof allColumns[0][column]} = ${allColumns[0][column]}`);
        });
      } else {
        console.log('📋 Таблиця vehicles порожня, але структура доступна');
        // Спробуємо отримати структуру через порожній запит
        const { data: emptyData, error: emptyError } = await supabase
          .from('vehicles')
          .select('*')
          .eq('make', 'NONEXISTENT_MAKE_FOR_STRUCTURE_CHECK');
        
        if (!emptyError) {
          console.log('📋 Структура таблиці (через порожній запит): доступна');
        }
      }
    }
    
    // Перевірка конкретних стовпців один за одним
    console.log('\n2. Перевірка конкретних стовпців:');
    const columnsToCheck = ['id', 'user_id', 'vin', 'make', 'model', 'year'];
    
    for (const column of columnsToCheck) {
      try {
        const { data, error } = await supabase
          .from('vehicles')
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
    
    // Перевірка через RPC функцію
    console.log('\n3. Спроба отримання структури через RPC:');
    try {
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_table_structure', { table_name: 'vehicles' });
      
      if (rpcError) {
        console.log('❌ RPC функція недоступна:', rpcError.message);
      } else {
        console.log('✅ Структура через RPC:', rpcData);
      }
    } catch (rpcErr) {
      console.log('❌ RPC помилка:', rpcErr.message);
    }
    
    // Перевірка через прямий SQL (якщо доступний)
    console.log('\n4. Альтернативна перевірка структури:');
    try {
      // Спроба отримати дані без вказування стовпців
      const { data: rawData, error: rawError } = await supabase
        .from('vehicles')
        .select()
        .limit(1);
      
      if (rawError) {
        console.log('❌ Альтернативний запит:', rawError.message);
      } else {
        console.log('✅ Альтернативний запит успішний');
        console.log('Тип даних:', typeof rawData, 'Довжина:', rawData?.length);
      }
    } catch (altErr) {
      console.log('❌ Альтернативна помилка:', altErr.message);
    }
    
  } catch (error) {
    console.error('❌ Загальна помилка:', error.message);
    console.error('Стек помилки:', error.stack);
  }
}

checkVehiclesRealStructure();