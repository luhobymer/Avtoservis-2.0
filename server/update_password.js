const supabase = require('./config/supabase.js');
const bcrypt = require('bcryptjs');

async function updatePassword() {
  try {
    const email = 'luhobymer@gmail.com';
    const newPassword = '123456';
    
    // Хешуємо новий пароль
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    console.log('Оновлюємо пароль для користувача:', email);
    console.log('Новий пароль:', newPassword);
    
    // Оновлюємо пароль в базі даних
    const { data, error } = await supabase
      .from('users')
      .update({ password_hash: hashedPassword })
      .eq('email', email)
      .select();
    
    if (error) {
      console.error('Помилка оновлення пароля:', error);
      return;
    }
    
    console.log('Пароль успішно оновлено!');
    console.log('Оновлений користувач:', data[0]);
    
    // Тестуємо новий пароль
    const isValid = await bcrypt.compare(newPassword, hashedPassword);
    console.log('Перевірка нового пароля:', isValid ? 'УСПІШНО' : 'ПОМИЛКА');
    
  } catch (err) {
    console.error('Помилка:', err.message);
  }
}

updatePassword();