const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔍 Налаштування Supabase:');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey ? 'Встановлено' : 'Відсутній');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Помилка: SUPABASE_URL або SUPABASE_ANON_KEY не знайдено в .env файлі');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  try {
    console.log('\n🔍 Перевірка таблиці users...');
    
    // Спробуємо отримати кількість записів
    const { count, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Помилка при підрахунку записів:', countError);
    } else {
      console.log(`📊 Загальна кількість користувачів: ${count}`);
    }
    
    // Спробуємо отримати всі записи
    const { data: users, error } = await supabase
      .from('users')
      .select('*');
    
    if (error) {
      console.error('❌ Помилка при отриманні користувачів:', error);
      return;
    }
    
    console.log(`\n✅ Отримано ${users ? users.length : 0} користувачів:`);
    
    if (users && users.length > 0) {
      users.forEach((user, index) => {
        console.log(`\n👤 Користувач ${index + 1}:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Ім'я: ${user.name || 'Не вказано'}`);
        console.log(`   Роль: ${user.role || 'Не вказано'}`);
        console.log(`   Створено: ${user.created_at}`);
      });
    } else {
      console.log('📭 Користувачів не знайдено');
    }
    
  } catch (error) {
    console.error('❌ Загальна помилка:', error);
  }
}

checkUsers();