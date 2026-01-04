const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Відсутні змінні середовища SUPABASE_URL або SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testRLSPolicies() {
  console.log('🔍 Тестування RLS політик...');
  
  try {
    // 1. Перевірка створених політик
    console.log('\n1. Перевірка створених RLS політик:');
    const { data: policies, error: policiesError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd
          FROM pg_policies 
          WHERE schemaname = 'public'
          ORDER BY tablename, policyname;
        `
      });
    
    if (policiesError) {
      console.error('❌ Помилка отримання політик:', policiesError.message);
    } else {
      console.log('✅ Знайдено політик:', policies?.length || 0);
      if (policies && policies.length > 0) {
        const groupedPolicies = {};
        policies.forEach(policy => {
          if (!groupedPolicies[policy.tablename]) {
            groupedPolicies[policy.tablename] = [];
          }
          groupedPolicies[policy.tablename].push(policy.policyname);
        });
        
        Object.keys(groupedPolicies).forEach(table => {
          console.log(`📋 ${table}: ${groupedPolicies[table].length} політик`);
          groupedPolicies[table].forEach(policyName => {
            console.log(`   - ${policyName}`);
          });
        });
      }
    }
    
    // 2. Перевірка увімкнення RLS
    console.log('\n2. Перевірка увімкнення RLS для таблиць:');
    const { data: rlsStatus, error: rlsError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            schemaname,
            tablename,
            rowsecurity
          FROM pg_tables 
          WHERE schemaname = 'public'
          ORDER BY tablename;
        `
      });
    
    if (rlsError) {
      console.error('❌ Помилка перевірки RLS:', rlsError.message);
    } else {
      console.log('✅ Статус RLS для таблиць:');
      rlsStatus?.forEach(table => {
        const status = table.rowsecurity ? '🟢 Увімкнено' : '🔴 Вимкнено';
        console.log(`   ${table.tablename}: ${status}`);
      });
    }
    
    // 3. Підрахунок політик по таблицях
    console.log('\n3. Підрахунок політик по таблицях:');
    const { data: policiesCount, error: countError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT 
            tablename,
            COUNT(*) as policies_count
          FROM pg_policies 
          WHERE schemaname = 'public'
          GROUP BY tablename
          ORDER BY policies_count DESC;
        `
      });
    
    if (countError) {
      console.error('❌ Помилка підрахунку політик:', countError.message);
    } else {
      console.log('✅ Кількість політик по таблицях:');
      policiesCount?.forEach(table => {
        console.log(`   ${table.tablename}: ${table.policies_count} політик`);
      });
    }
    
    // 4. Тестування доступу до даних (без аутентифікації)
    console.log('\n4. Тестування доступу до даних без аутентифікації:');
    
    // Створюємо клієнт без service role для тестування RLS
    const publicClient = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY || '');
    
    const tablesToTest = [
      'vehicles',
      'appointments', 
      'notifications',
      'reminders',
      'service_records',
      'parts',
      'services',
      'service_stations',
      'mechanics'
    ];
    
    for (const table of tablesToTest) {
      try {
        const { data, error } = await publicClient
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          if (error.code === '42501') {
            console.log(`✅ ${table}: RLS працює (доступ заборонено)`);
          } else {
            console.log(`⚠️ ${table}: ${error.message}`);
          }
        } else {
          console.log(`🔴 ${table}: RLS не працює (дані доступні без аутентифікації)`);
        }
      } catch (err) {
        console.log(`❌ ${table}: Помилка тестування - ${err.message}`);
      }
    }
    
    // 5. Перевірка публічних таблиць (які повинні бути доступні всім)
    console.log('\n5. Перевірка публічних таблиць:');
    const publicTables = ['parts', 'services', 'service_stations', 'mechanics'];
    
    for (const table of publicTables) {
      try {
        const { data, error } = await publicClient
          .from(table)
          .select('id')
          .limit(1);
        
        if (error) {
          console.log(`❌ ${table}: Помилка доступу - ${error.message}`);
        } else {
          console.log(`✅ ${table}: Публічний доступ працює`);
        }
      } catch (err) {
        console.log(`❌ ${table}: Помилка - ${err.message}`);
      }
    }
    
    console.log('\n🎉 Тестування RLS політик завершено!');
    
  } catch (error) {
    console.error('❌ Загальна помилка:', error.message);
    console.error('Стек помилки:', error.stack);
  }
}

testRLSPolicies();