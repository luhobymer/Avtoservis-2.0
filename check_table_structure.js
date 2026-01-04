const supabase = require('./server/config/supabase');

async function checkTableStructure() {
  console.log('=== Перевірка структури таблиці users ===');
  
  try {
    // Перевіряємо, чи існує таблиця users
    console.log('1. Перевірка існування таблиці users...');
    const { data: tableExists, error: tableError } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('Помилка при доступі до таблиці users:', tableError);
      return;
    }
    
    console.log('✓ Таблиця users існує');
    
    // Перевіряємо структуру таблиці через information_schema
    console.log('\n2. Перевірка структури таблиці...');
    const { data: columns, error: columnsError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
          ORDER BY ordinal_position;
        `
      });
    
    if (columnsError) {
      console.error('Помилка при отриманні структури таблиці:', columnsError);
    } else {
      console.log('Структура таблиці users:');
      console.table(columns);
    }
    
    // Перевіряємо RLS політики
    console.log('\n3. Перевірка RLS політик...');
    const { data: policies, error: policiesError } = await supabase
      .rpc('exec_sql', {
        sql: `
          SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
          FROM pg_policies 
          WHERE schemaname = 'public' 
          AND tablename = 'users';
        `
      });
    
    if (policiesError) {
      console.error('Помилка при отриманні RLS політик:', policiesError);
    } else {
      console.log('RLS політики для таблиці users:');
      console.table(policies);
    }
    
    // Спробуємо створити тестового користувача
    console.log('\n4. Тест створення користувача...');
    const testUser = {
      email: 'test_structure@example.com',
      name: 'Test User',
      role: 'client'
    };
    
    const { data: createResult, error: createError } = await supabase
      .from('users')
      .insert([testUser])
      .select()
      .single();
    
    if (createError) {
      console.error('Помилка при створенні тестового користувача:', createError);
    } else {
      console.log('✓ Тестовий користувач створений успішно:', createResult);
      
      // Видаляємо тестового користувача
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', createResult.id);
      
      if (deleteError) {
        console.error('Помилка при видаленні тестового користувача:', deleteError);
      } else {
        console.log('✓ Тестовий користувач видалений');
      }
    }
    
  } catch (error) {
    console.error('Загальна помилка:', error);
  }
}

checkTableStructure();