const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkExistingTables() {
  try {
    console.log('Перевіряю існуючі таблиці в базі даних...');
    
    // Отримуємо список всіх таблиць у схемі public
    const { data, error } = await supabase
      .rpc('get_table_list');
    
    if (error) {
      // Якщо RPC функція не існує, використовуємо альтернативний метод
      console.log('Використовую альтернативний метод перевірки...');
      
      // Список таблиць, які повинні існувати згідно з database_structure_complete.sql
      const expectedTables = [
        'users', 'refresh_tokens', 'vehicles', 'mileage_requests',
        'service_stations', 'mechanics', 'services', 'appointments',
        'service_history', 'service_records', 'parts', 'repair_works',
        'repair_parts', 'new_repair_works', 'new_repair_works_v2',
        'notifications', 'notification_settings', 'scheduled_notifications',
        'push_tokens', 'user_settings', 'insurance', 'photos',
        'documents', 'promotions', 'reviews', 'payments'
      ];
      
      const existingTables = [];
      const missingTables = [];
      
      // Перевіряємо кожну таблицю окремо
      for (const tableName of expectedTables) {
        try {
          const { data: tableData, error: tableError } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
          
          if (!tableError) {
            existingTables.push(tableName);
          } else {
            missingTables.push(tableName);
          }
        } catch (err) {
          missingTables.push(tableName);
        }
      }
      
      console.log('\n=== РЕЗУЛЬТАТ ПЕРЕВІРКИ ===');
      console.log(`Існуючі таблиці (${existingTables.length}):`, existingTables.sort());
      console.log(`Відсутні таблиці (${missingTables.length}):`, missingTables.sort());
      
      return { existingTables, missingTables };
    } else {
      console.log('Існуючі таблиці:', data);
      return { existingTables: data, missingTables: [] };
    }
  } catch (err) {
    console.error('Помилка при перевірці таблиць:', err.message);
    return { existingTables: [], missingTables: [] };
  }
}

if (require.main === module) {
  checkExistingTables();
}

module.exports = { checkExistingTables };