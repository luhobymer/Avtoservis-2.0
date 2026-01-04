const supabase = require('./config/supabase.js');
const bcrypt = require('bcryptjs');

async function checkPassword() {
  try {
    // Отримуємо користувача
    const { data: user, error } = await supabase
      .from('users')
      .select('email, password_hash')
      .eq('email', 'luhobymer@gmail.com')
      .single();
    
    if (error || !user) {
      console.log('Користувач не знайдений');
      return;
    }
    
    console.log('Email:', user.email);
    console.log('Password hash exists:', !!user.password_hash);
    console.log('Password hash length:', user.password_hash ? user.password_hash.length : 0);
    
    // Тестуємо різні паролі
    const testPasswords = ['123456', 'password', 'admin', 'test'];
    
    for (const password of testPasswords) {
      const isValid = await bcrypt.compare(password, user.password_hash);
      console.log(`Password '${password}': ${isValid ? 'VALID' : 'INVALID'}`);
    }
    
  } catch (err) {
    console.error('Помилка:', err.message);
  }
}

checkPassword();