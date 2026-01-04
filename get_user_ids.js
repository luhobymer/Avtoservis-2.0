const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Помилка: SUPABASE_URL або SUPABASE_ANON_KEY не знайдено в .env файлі');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getUserIds() {
  try {
    console.log('🔍 Отримання користувачів з бази даних...');
    
    // Отримуємо всіх користувачів (обмежуємо до 10 для безпеки)
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, role')
      .limit(10);

    if (error) {
      console.error('❌ Помилка при отриманні користувачів:', error);
      return;
    }

    if (!users || users.length === 0) {
      console.log('⚠️ Користувачів не знайдено в базі даних.');
      console.log('💡 Рекомендація: Створіть тестових користувачів або використайте існуючих.');
      return;
    }

    console.log(`✅ Знайдено ${users.length} користувачів:`);
    users.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.email} (${user.name || 'Без імені'}) [${user.role}] - ID: ${user.id}`);
    });

    // Читаємо SQL файл
    if (!fs.existsSync('test_data_script.sql')) {
      console.error('❌ Файл test_data_script.sql не знайдено!');
      return;
    }
    
    const sqlContent = fs.readFileSync('test_data_script.sql', 'utf8');
    
    // Замінюємо плейсхолдери на реальні ID
    let updatedSql = sqlContent;
    
    // Використовуємо перших 4 користувачів для заміни плейсхолдерів
    const usersToUse = users.slice(0, 4);
    usersToUse.forEach((user, index) => {
      const placeholder = `USER_ID_${index + 1}`;
      const regex = new RegExp(placeholder, 'g');
      updatedSql = updatedSql.replace(regex, user.id);
      console.log(`🔄 Замінено ${placeholder} на ${user.id} (${user.email})`);
    });

    // Зберігаємо оновлений файл
    fs.writeFileSync('test_data_script_with_real_ids.sql', updatedSql);
    
    console.log('\n✅ SQL скрипт оновлено з реальними ID користувачів!');
    console.log('📁 Збережено як: test_data_script_with_real_ids.sql');
    console.log('\n📋 Наступні кроки:');
    console.log('1. Перевірте файл test_data_script_with_real_ids.sql');
    console.log('2. Виконайте SQL скрипт у вашій базі даних Supabase');
    console.log('3. Перевірте, що дані успішно додано');
    
  } catch (error) {
    console.error('❌ Загальна помилка:', error);
  }
}

getUserIds();