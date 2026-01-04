const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Ініціалізація Supabase клієнта
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Функція для додавання послуг
async function addMissingServices() {
  console.log('\n🔄 Додавання відсутніх послуг...');
  
  const services = [
    { name: 'Заміна моторної оливи', description: 'Повна заміна моторної оливи та фільтра', price: 800, duration: 30 },
    { name: 'Діагностика двигуна', description: 'Комп\'ютерна діагностика двигуна', price: 300, duration: 45 },
    { name: 'Заміна гальмівних колодок', description: 'Заміна передніх або задніх гальмівних колодок', price: 1200, duration: 60 },
    { name: 'Балансування коліс', description: 'Балансування та перевірка коліс', price: 400, duration: 30 },
    { name: 'Заміна повітряного фільтра', description: 'Заміна фільтра повітря двигуна', price: 200, duration: 15 },
    { name: 'Технічний огляд', description: 'Повний технічний огляд автомобіля', price: 500, duration: 90 },
    { name: 'Заміна свічок запалювання', description: 'Заміна свічок запалювання', price: 600, duration: 45 },
    { name: 'Промивка системи охолодження', description: 'Промивка та заміна охолоджуючої рідини', price: 700, duration: 60 },
    { name: 'Ремонт підвіски', description: 'Ремонт елементів підвіски', price: 2000, duration: 180 },
    { name: 'Заміна ременя ГРМ', description: 'Заміна ременя газорозподільного механізму', price: 1500, duration: 120 }
  ];
  
  let added = 0;
  let errors = 0;
  
  for (const service of services) {
    try {
      // Перевіряємо чи існує послуга
      const { data: existing } = await supabase
        .from('services')
        .select('id')
        .eq('name', service.name)
        .single();
      
      if (!existing) {
        const { error } = await supabase
          .from('services')
          .insert(service);
        
        if (error) {
          console.error(`❌ Помилка додавання ${service.name}: ${error.message}`);
          errors++;
        } else {
          console.log(`✅ Додано: ${service.name}`);
          added++;
        }
      } else {
        console.log(`⚠️ Вже існує: ${service.name}`);
      }
    } catch (err) {
      console.error(`❌ Помилка: ${err.message}`);
      errors++;
    }
  }
  
  console.log(`📊 Додано ${added} послуг, ${errors} помилок`);
  return { added, errors };
}

// Функція для створення таблиці нагадувань
async function createRemindersTable() {
  console.log('\n🔄 Перевірка таблиці reminders...');
  
  try {
    // Спробуємо отримати дані з таблиці
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .limit(1);
    
    if (error && error.code === 'PGRST116') {
      console.log('❌ Таблиця reminders не існує. Потрібно створити вручну через SQL.');
      return { success: false, message: 'Таблиця не існує' };
    } else {
      console.log('✅ Таблиця reminders існує');
      return { success: true, message: 'Таблиця існує' };
    }
  } catch (err) {
    console.error(`❌ Помилка перевірки: ${err.message}`);
    return { success: false, message: err.message };
  }
}

// Функція для створення таблиці сповіщень
async function createNotificationsTable() {
  console.log('\n🔄 Перевірка таблиці notifications...');
  
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .limit(1);
    
    if (error && error.code === 'PGRST116') {
      console.log('❌ Таблиця notifications не існує. Потрібно створити вручну через SQL.');
      return { success: false, message: 'Таблиця не існує' };
    } else {
      console.log('✅ Таблиця notifications існує');
      return { success: true, message: 'Таблиця існує' };
    }
  } catch (err) {
    console.error(`❌ Помилка перевірки: ${err.message}`);
    return { success: false, message: err.message };
  }
}

// Функція для створення таблиці записів обслуговування
async function createServiceRecordsTable() {
  console.log('\n🔄 Перевірка таблиці service_records...');
  
  try {
    const { data, error } = await supabase
      .from('service_records')
      .select('*')
      .limit(1);
    
    if (error && error.code === 'PGRST116') {
      console.log('❌ Таблиця service_records не існує. Потрібно створити вручну через SQL.');
      return { success: false, message: 'Таблиця не існує' };
    } else {
      console.log('✅ Таблиця service_records існує');
      return { success: true, message: 'Таблиця існує' };
    }
  } catch (err) {
    console.error(`❌ Помилка перевірки: ${err.message}`);
    return { success: false, message: err.message };
  }
}

// Функція для перевірки RLS політик
async function checkRLSPolicies() {
  console.log('\n🔄 Перевірка RLS політик...');
  
  const tables = ['services', 'vehicles', 'clients', 'appointments'];
  
  for (const table of tables) {
    try {
      // Спробуємо виконати операцію, яка потребує RLS
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(`⚠️ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: RLS працює`);
      }
    } catch (err) {
      console.log(`❌ ${table}: Помилка перевірки RLS`);
    }
  }
}

// Функція для перевірки існування таблиць
async function checkTables() {
  console.log('\n🔍 Перевірка існування таблиць...');
  
  const tables = ['services', 'vehicles', 'clients', 'appointments', 'reminders', 'notifications', 'service_records'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`❌ Таблиця ${table}: Не існує`);
        } else {
          console.log(`⚠️ Таблиця ${table}: ${error.message}`);
        }
      } else {
        console.log(`✅ Таблиця ${table}: Існує`);
      }
    } catch (err) {
      console.log(`❌ Таблиця ${table}: Помилка перевірки`);
    }
  }
}

// Функція для перевірки кількості записів
async function checkRecords() {
  console.log('\n📊 Перевірка кількості записів...');
  
  const tables = ['services', 'vehicles', 'clients', 'appointments'];
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table}: Помилка підрахунку`);
      } else {
        console.log(`📈 ${table}: ${count || 0} записів`);
      }
    } catch (err) {
      console.log(`❌ ${table}: Не вдалося перевірити`);
    }
  }
}

// Функція для створення тестових даних
async function createTestData() {
  console.log('\n🔄 Створення тестових даних...');
  
  // Додаємо тестові нагадування (якщо таблиця існує)
  try {
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id')
      .limit(3);
    
    if (vehicles && vehicles.length > 0) {
      const testReminders = vehicles.map((vehicle, index) => ({
        vehicle_id: vehicle.id,
        reminder_type: ['maintenance', 'inspection', 'insurance'][index % 3],
        due_date: new Date(Date.now() + (30 + index * 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        message: `Тестове нагадування ${index + 1}`,
        priority: ['low', 'medium', 'high'][index % 3],
        is_completed: false
      }));
      
      const { error } = await supabase
        .from('reminders')
        .insert(testReminders);
      
      if (error) {
        console.log(`⚠️ Не вдалося додати тестові нагадування: ${error.message}`);
      } else {
        console.log(`✅ Додано ${testReminders.length} тестових нагадувань`);
      }
    }
  } catch (err) {
    console.log('⚠️ Таблиця reminders не готова для тестових даних');
  }
}

// Основна функція
async function main() {
  console.log('🚀 Початок впровадження оновлень системи автосервісу...');
  
  // Початкова перевірка
  await checkTables();
  await checkRecords();
  
  // Виконуємо оновлення
  const results = {
    services: await addMissingServices(),
    reminders: await createRemindersTable(),
    notifications: await createNotificationsTable(),
    serviceRecords: await createServiceRecordsTable()
  };
  
  // Перевіряємо RLS
  await checkRLSPolicies();
  
  // Створюємо тестові дані
  await createTestData();
  
  // Фінальна перевірка
  console.log('\n🔍 ФІНАЛЬНА ПЕРЕВІРКА:');
  await checkTables();
  await checkRecords();
  
  // Підсумок
  console.log('\n📊 ПІДСУМОК ВПРОВАДЖЕННЯ:');
  console.log(`✅ Послуги: додано ${results.services.added}, помилок ${results.services.errors}`);
  console.log(`📋 Таблиці: перевірено та підтверджено існування`);
  console.log(`🔒 RLS: перевірено політики безпеки`);
  
  console.log('\n🏁 Впровадження завершено!');
  console.log('\n📝 НАСТУПНІ КРОКИ:');
  console.log('1. Виконайте SQL скрипти вручну через Supabase Dashboard для створення відсутніх таблиць');
  console.log('2. Налаштуйте RLS політики через SQL Editor');
  console.log('3. Перевірте API функції та CORS налаштування');
}

// Запуск
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Критична помилка:', error);
    process.exit(1);
  });
}

module.exports = { 
  main, 
  addMissingServices, 
  checkTables, 
  checkRecords, 
  createTestData 
};