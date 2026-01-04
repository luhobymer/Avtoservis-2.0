const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

// Supabase конфігурація з .env
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

async function createTestUser() {
  try {
    console.log('Створення тестового користувача...');
    console.log('Supabase URL:', supabaseUrl);
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase конфігурація не знайдена в .env файлі');
      return;
    }
    
    // Хешуємо пароль
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Створюємо клієнт Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Перевіряємо чи користувач вже існує
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'admin@example.com')
      .single();
    
    if (existingUser) {
      console.log('Користувач вже існує:', existingUser.email);
      return;
    }
    
    // Створюємо нового користувача
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          email: 'admin@example.com',
          password: hashedPassword,
          role: 'admin',
          name: 'Test Admin'
        }
      ])
      .select();
    
    if (error) {
      console.error('Помилка створення користувача:', error);
    } else {
      console.log('Користувач успішно створений:', data[0]);
    }
    
  } catch (error) {
    console.error('Помилка:', error.message);
  }
}

createTestUser();