const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Помилка: SUPABASE_URL або SUPABASE_ANON_KEY не знайдено в .env файлі');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestUsers() {
  try {
    console.log('🚀 Створення тестових користувачів...');
    
    const testUsers = [
      {
        email: 'client1@test.com',
        name: 'Іван Петренко',
        role: 'client',
        phone: '+380501234567'
      },
      {
        email: 'client2@test.com',
        name: 'Марія Іваненко',
        role: 'client',
        phone: '+380502345678'
      },
      {
        email: 'mechanic1@test.com',
        name: 'Олександр Коваленко',
        role: 'mechanic',
        phone: '+380503456789'
      },
      {
        email: 'admin1@test.com',
        name: 'Адміністратор Системи',
        role: 'admin',
        phone: '+380504567890'
      }
    ];
    
    const password = 'testpassword123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    console.log('🔐 Пароль для всіх тестових користувачів:', password);
    
    for (const userData of testUsers) {
      console.log(`\n👤 Створення користувача: ${userData.email}`);
      
      const { data, error } = await supabase
        .from('users')
        .insert({
          email: userData.email,
          name: userData.name,
          role: userData.role,
          phone: userData.phone,
          password_hash: hashedPassword
        })
        .select();
      
      if (error) {
        console.error(`❌ Помилка при створенні ${userData.email}:`, error);
      } else {
        console.log(`✅ Користувач ${userData.email} створено успішно`);
        console.log(`   ID: ${data[0].id}`);
        console.log(`   Роль: ${data[0].role}`);
      }
    }
    
    console.log('\n🎉 Створення тестових користувачів завершено!');
    console.log('\n📋 Дані для входу:');
    console.log('   Пароль для всіх: testpassword123');
    testUsers.forEach(user => {
      console.log(`   ${user.email} (${user.role})`);
    });
    
  } catch (error) {
    console.error('❌ Загальна помилка:', error);
  }
}

createTestUsers();