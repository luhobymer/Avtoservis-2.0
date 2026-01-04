require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTables() {
  const tablesToCheck = [
    'users', 'vehicles', 'appointments', 'services', 'service_records',
    'notifications', 'reminders', 'parts', 'mechanics', 'service_stations'
  ];
  
  console.log('Перевіряємо доступність таблиць...');
  
  for (const tableName of tablesToCheck) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`❌ ${tableName}: ${error.message}`);
      } else {
        console.log(`✅ ${tableName}: доступна (${data.length} записів показано)`);
        
        // Якщо це vehicles або service_records, покажемо структуру
        if (tableName === 'vehicles' || tableName === 'service_records') {
          if (data.length > 0) {
            console.log(`   Колонки в ${tableName}:`, Object.keys(data[0]));
          } else {
            // Спробуємо отримати структуру через порожній select
            const { data: emptyData, error: emptyError } = await supabase
              .from(tableName)
              .select('*')
              .eq('id', '00000000-0000-0000-0000-000000000000'); // Неіснуючий ID
            
            if (!emptyError) {
              console.log(`   ${tableName} існує але порожня`);
            }
          }
        }
      }
    } catch (err) {
      console.log(`❌ ${tableName}: ${err.message}`);
    }
  }
  
  // Додатково перевіримо чи можемо створити простий запит
  console.log('\nПеревіряємо простий запит до vehicles...');
  try {
    const { count, error } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log('Помилка підрахунку vehicles:', error.message);
    } else {
      console.log('Кількість записів у vehicles:', count);
    }
  } catch (err) {
    console.log('Помилка при підрахунку:', err.message);
  }
}

checkTables();