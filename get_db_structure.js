const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

async function getDBStructure() {
  try {
    console.log('Підключення до Supabase з service role...');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Помилка: SUPABASE_URL або SUPABASE_SERVICE_ROLE_KEY не знайдені в .env файлі');
      return;
    }
    
    // Використовуємо service role для повного доступу
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    console.log('Отримання структури таблиць через прямі запити...');
    
    // Список таблиць, які ми знаємо з файлів
    const knownTables = [
      'users', 'refresh_tokens', 'vehicles', 'mileage_requests',
      'service_stations', 'mechanics', 'services', 'appointments',
      'service_history', 'service_records', 'parts', 'repair_works',
      'repair_parts', 'new_repair_works', 'new_repair_works_v2',
      'notifications', 'notification_settings', 'scheduled_notifications',
      'push_tokens', 'user_settings', 'insurance', 'photos',
      'documents', 'promotions', 'reviews', 'payments'
    ];
    
    const tableStructures = {};
    const existingTables = [];
    
    // Перевіряємо кожну таблицю
    for (const tableName of knownTables) {
      console.log(`Перевірка таблиці: ${tableName}`);
      
      try {
        // Спробуємо отримати дані з таблиці
         const { data, error, count } = await supabase
           .from(tableName)
           .select('*', { count: 'exact' })
           .limit(5);
        
        if (error) {
          if (error.code === 'PGRST106' || error.message.includes('does not exist')) {
            console.log(`  ❌ Таблиця ${tableName} не існує`);
            continue;
          } else {
            console.log(`  ⚠️  Таблиця ${tableName} існує, але є помилка доступу:`, error.message);
          }
        } else {
          console.log(`  ✅ Таблиця ${tableName} існує, записів: ${count || 0}`);
        }
        
        existingTables.push(tableName);
         tableStructures[tableName] = {
           exists: true,
           row_count: count || 0,
           access_error: error ? error.message : null,
           sample_data: data || []
         };
        
      } catch (tableErr) {
        console.log(`  ❌ Помилка при перевірці ${tableName}:`, tableErr.message);
        tableStructures[tableName] = {
          exists: false,
          error: tableErr.message
        };
      }
    }
    
    console.log('\n=== РЕЗУЛЬТАТИ ПЕРЕВІРКИ ===');
    console.log(`Перевірено таблиць: ${knownTables.length}`);
    console.log(`Існуючих таблиць: ${existingTables.length}`);
    console.log(`Відсутніх таблиць: ${knownTables.length - existingTables.length}`);
    
    // Створюємо детальний звіт
    const report = {
      timestamp: new Date().toISOString(),
      supabase_url: supabaseUrl,
      total_tables_checked: knownTables.length,
      existing_tables: existingTables.length,
      missing_tables: knownTables.length - existingTables.length,
      tables: tableStructures,
      existing_tables_list: existingTables,
      missing_tables_list: knownTables.filter(table => !existingTables.includes(table))
    };
    
    // Зберігаємо результат
    fs.writeFileSync('./current_db_structure.json', JSON.stringify(report, null, 2));
    console.log('\nЗвіт збережено у файл current_db_structure.json');
    
    // Виводимо детальний звіт
    console.log('\n=== ІСНУЮЧІ ТАБЛИЦІ ===');
    existingTables.forEach(table => {
      const info = tableStructures[table];
      console.log(`${table}: ${info.row_count} записів${info.access_error ? ' (помилка доступу)' : ''}`);
    });
    
    if (report.missing_tables_list.length > 0) {
      console.log('\n=== ВІДСУТНІ ТАБЛИЦІ ===');
      report.missing_tables_list.forEach(table => {
        console.log(`❌ ${table}`);
      });
    }
    
    // Створюємо SQL скрипт для створення відсутніх таблиць
    if (report.missing_tables_list.length > 0) {
      console.log('\n=== РЕКОМЕНДАЦІЇ ===');
      console.log('Для створення відсутніх таблиць виконайте SQL скрипт:');
      console.log('database_structure_complete.sql');
    }
    
    return report;
    
  } catch (err) {
    console.error('Загальна помилка:', err.message);
    console.log('\nВикористовуємо статичну структуру з файлу database_structure_complete.sql');
    
    // Створюємо базовий звіт з помилкою
    const errorReport = {
      timestamp: new Date().toISOString(),
      error: err.message,
      status: 'failed',
      recommendation: 'Використовуйте файл database_structure_complete.sql для створення структури БД'
    };
    
    fs.writeFileSync('./current_db_structure.json', JSON.stringify(errorReport, null, 2));
    return errorReport;
  }
}

// Запускаємо функцію
getDBStructure().then(result => {
  console.log('\n=== ЗАВЕРШЕНО ===');
  if (result && result.existing_tables) {
    console.log(`Структура БД перевірена. Знайдено ${result.existing_tables} з ${result.total_tables_checked} таблиць.`);
  }
}).catch(err => {
  console.error('Критична помилка:', err);
});