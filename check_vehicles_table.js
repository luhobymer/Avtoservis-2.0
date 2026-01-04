const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Помилка: SUPABASE_URL або SUPABASE_SERVICE_ROLE_KEY не знайдено в .env файлі');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkVehiclesTable() {
  try {
    console.log('🔍 Перевірка структури таблиці vehicles...');
    
    // Спробуємо отримати структуру таблиці через SQL запит
    const { data: columns, error: columnsError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = 'vehicles' AND table_schema = 'public'
          ORDER BY ordinal_position;
        `
      });
    
    if (columnsError) {
      console.log('⚠️ Не вдалося отримати структуру через RPC, спробуємо інший спосіб...');
      
      // Спробуємо просто вибрати з таблиці
      const { data: testData, error: testError } = await supabase
        .from('vehicles')
        .select('*')
        .limit(1);
      
      if (testError) {
        console.error('❌ Помилка при доступі до таблиці vehicles:', testError);
        
        // Перевіримо, чи існує таблиця взагалі
        const { data: tableExists, error: tableError } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_name', 'vehicles')
          .eq('table_schema', 'public');
        
        if (tableError) {
          console.error('❌ Помилка при перевірці існування таблиці:', tableError);
        } else if (!tableExists || tableExists.length === 0) {
          console.log('❌ Таблиця vehicles не існує в схемі public');
        } else {
          console.log('✅ Таблиця vehicles існує, але є проблеми з доступом');
        }
      } else {
        console.log('✅ Таблиця vehicles доступна');
        console.log('📊 Кількість записів:', testData?.length || 0);
        if (testData && testData.length > 0) {
          console.log('🔍 Структура (на основі першого запису):');
          console.log(Object.keys(testData[0]));
        }
      }
    } else {
      console.log('✅ Структура таблиці vehicles:');
      columns.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
    }
    
    // Перевіримо також користувачів
    console.log('\n🔍 Перевірка користувачів...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email')
      .limit(3);
    
    if (usersError) {
      console.error('❌ Помилка при отриманні користувачів:', usersError);
    } else {
      console.log(`✅ Знайдено ${users?.length || 0} користувачів`);
      if (users && users.length > 0) {
        users.forEach(user => {
          console.log(`  - ${user.email} (ID: ${user.id})`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Загальна помилка:', error);
  }
}

checkVehiclesTable();