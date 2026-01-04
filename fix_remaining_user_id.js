require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixRemainingUserId() {
  try {
    console.log('🔍 Отримання користувачів...');
    
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email')
      .limit(4);
    
    if (error) {
      console.error('❌ Помилка отримання користувачів:', error);
      return;
    }
    
    if (!users || users.length < 3) {
      console.error('❌ Недостатньо користувачів у базі даних');
      return;
    }
    
    // Використовуємо третього користувача для заміни USER_ID_4
    const fourthUserId = users[2].id; // Індекс 2 = третій користувач
    
    console.log(`🔄 Заміна USER_ID_4 на ${fourthUserId} (${users[2].email})`);
    
    // Читаємо SQL файл
    let sqlContent = fs.readFileSync('test_data_script_with_real_ids.sql', 'utf8');
    
    // Замінюємо USER_ID_4
    sqlContent = sqlContent.replace(/USER_ID_4/g, fourthUserId);
    
    // Зберігаємо оновлений файл
    fs.writeFileSync('test_data_script_with_real_ids.sql', sqlContent);
    
    console.log('✅ Останній плейсхолдер USER_ID_4 замінено!');
    console.log('📁 Файл test_data_script_with_real_ids.sql готовий до виконання');
    
  } catch (error) {
    console.error('❌ Помилка:', error.message);
  }
}

fixRemainingUserId();