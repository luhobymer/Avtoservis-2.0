require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkVehiclesTable() {
  try {
    console.log('Перевіряємо доступ до таблиці vehicles...');
    
    // Спроба отримати структуру таблиці
    const { data, error } = await supabase
      .from('vehicles')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Помилка доступу до таблиці vehicles:', error);
      return;
    }
    
    console.log('Таблиця vehicles доступна:', data);
    
    // Перевіряємо чи існують записи
    const { count, error: countError } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Помилка підрахунку записів vehicles:', countError);
    } else {
      console.log('Кількість записів у vehicles:', count);
    }
    
  } catch (err) {
    console.error('Загальна помилка:', err);
  }
}

checkVehiclesTable();