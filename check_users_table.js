require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUsersTable() {
  try {
    // Перевіряємо структуру таблиці users
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('Error accessing users table:', error);
      return;
    }
    
    console.log('Users table exists and accessible');
    console.log('Sample data structure:', data);
    
    // Спробуємо створити тестового користувача
    const testUser = {
      email: 'test-structure@example.com',
      password: 'test123',
      name: 'Test User'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('users')
      .insert([testUser])
      .select();
    
    if (insertError) {
      console.log('Insert error:', insertError);
    } else {
      console.log('Insert successful:', insertData);
      
      // Видаляємо тестового користувача
      await supabase
        .from('users')
        .delete()
        .eq('email', 'test-structure@example.com');
    }
    
  } catch (err) {
    console.error('Script error:', err);
  }
}

checkUsersTable();