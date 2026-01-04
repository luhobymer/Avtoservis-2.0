const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

async function getTableData() {
  try {
    console.log('Підключення до Supabase для отримання даних...');
    
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
    
    console.log('Отримання даних з таблиць через SQL запити...');
    
    const knownTables = [
      'users', 'refresh_tokens', 'vehicles', 'mileage_requests',
      'service_stations', 'mechanics', 'services', 'appointments',
      'service_history', 'service_records', 'parts', 'repair_works',
      'repair_parts', 'new_repair_works', 'new_repair_works_v2',
      'notifications', 'notification_settings', 'scheduled_notifications',
      'push_tokens', 'user_settings', 'insurance', 'photos',
      'documents', 'promotions', 'reviews', 'payments'
    ];
    
    const tableData = {};
    
    // Спочатку отримаємо загальну статистику
    console.log('\n=== ОТРИМАННЯ СТАТИСТИКИ ТАБЛИЦЬ ===');
    
    for (const tableName of knownTables) {
      try {
        console.log(`Перевірка таблиці: ${tableName}`);
        
        // Спробуємо через звичайний select з підрахунком
        const { count, error: selectError } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (selectError) {
          console.log(`  ❌ Помилка доступу до ${tableName}: ${selectError.message}`);
          tableData[tableName] = {
            exists: false,
            error: selectError.message,
            row_count: 0
          };
          continue;
        }
        
        tableData[tableName] = {
          exists: true,
          row_count: count || 0,
          data_source: 'supabase_api'
        };
        
        console.log(`  ✅ ${tableName}: ${count || 0} записів`);
        
      } catch (err) {
        console.log(`  ❌ Критична помилка для ${tableName}: ${err.message}`);
        tableData[tableName] = {
          exists: false,
          error: err.message,
          row_count: 0
        };
      }
    }
    
    // Тепер отримаємо зразки даних з таблиць, які мають записи
    console.log('\n=== ОТРИМАННЯ ЗРАЗКІВ ДАНИХ ===');
    
    const tablesWithData = Object.entries(tableData)
      .filter(([name, info]) => info.exists && info.row_count > 0)
      .map(([name]) => name);
    
    if (tablesWithData.length === 0) {
      console.log('Всі таблиці порожні або недоступні.');
    } else {
      console.log(`Знайдено ${tablesWithData.length} таблиць з даними:`);
      tablesWithData.forEach(table => {
        console.log(`  - ${table}: ${tableData[table].row_count} записів`);
      });
      
      // Отримуємо зразки даних
      for (const tableName of tablesWithData) {
        try {
          console.log(`\nОтримання зразка даних з ${tableName}...`);
          
          const { data: sampleData, error: sampleError } = await supabase
            .from(tableName)
            .select('*')
            .limit(3);
          
          if (sampleError) {
            console.log(`  ⚠️  Помилка отримання даних з ${tableName}: ${sampleError.message}`);
            tableData[tableName].sample_error = sampleError.message;
          } else {
            tableData[tableName].sample_data = sampleData || [];
            console.log(`  ✅ Отримано ${sampleData?.length || 0} зразків з ${tableName}`);
            
            // Виводимо структуру першого запису
            if (sampleData && sampleData.length > 0) {
              const firstRecord = sampleData[0];
              const columns = Object.keys(firstRecord);
              console.log(`     Колонки: ${columns.join(', ')}`);
            }
          }
          
        } catch (err) {
          console.log(`  ❌ Критична помилка отримання даних з ${tableName}: ${err.message}`);
          tableData[tableName].sample_error = err.message;
        }
      }
    }
    
    // Створюємо детальний звіт
    const report = {
      timestamp: new Date().toISOString(),
      supabase_url: supabaseUrl,
      total_tables_checked: knownTables.length,
      tables_with_data: tablesWithData.length,
      empty_tables: Object.values(tableData).filter(t => t.exists && t.row_count === 0).length,
      inaccessible_tables: Object.values(tableData).filter(t => !t.exists).length,
      total_records: Object.values(tableData).reduce((sum, t) => sum + (t.row_count || 0), 0),
      tables: tableData,
      tables_with_data_list: tablesWithData,
      summary: {
        populated_tables: tablesWithData,
        empty_but_accessible: Object.entries(tableData)
          .filter(([name, info]) => info.exists && info.row_count === 0)
          .map(([name]) => name),
        inaccessible: Object.entries(tableData)
          .filter(([name, info]) => !info.exists)
          .map(([name]) => name)
      }
    };
    
    // Зберігаємо результат
    fs.writeFileSync('./table_data_report.json', JSON.stringify(report, null, 2));
    console.log('\n=== ЗВІТ ЗБЕРЕЖЕНО ===');
    console.log('Детальний звіт збережено у файл table_data_report.json');
    
    // Виводимо підсумок
    console.log('\n=== ПІДСУМОК ===');
    console.log(`Всього таблиць перевірено: ${report.total_tables_checked}`);
    console.log(`Таблиць з даними: ${report.tables_with_data}`);
    console.log(`Порожніх таблиць: ${report.empty_tables}`);
    console.log(`Недоступних таблиць: ${report.inaccessible_tables}`);
    console.log(`Загальна кількість записів: ${report.total_records}`);
    
    if (tablesWithData.length > 0) {
      console.log('\nТаблиці з даними:');
      tablesWithData.forEach(table => {
        const info = tableData[table];
        console.log(`  📊 ${table}: ${info.row_count} записів`);
      });
    }
    
    return report;
    
  } catch (err) {
    console.error('Загальна помилка:', err.message);
    
    const errorReport = {
      timestamp: new Date().toISOString(),
      error: err.message,
      status: 'failed'
    };
    
    fs.writeFileSync('./table_data_report.json', JSON.stringify(errorReport, null, 2));
    return errorReport;
  }
}

// Запускаємо функцію
getTableData().then(result => {
  console.log('\n=== ЗАВЕРШЕНО ===');
  if (result && result.tables_with_data !== undefined) {
    console.log(`Аналіз даних завершено. Знайдено ${result.tables_with_data} таблиць з даними з ${result.total_tables_checked} перевірених.`);
  }
}).catch(err => {
  console.error('Критична помилка:', err);
});