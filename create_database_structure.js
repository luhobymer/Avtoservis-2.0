const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Помилка: SUPABASE_URL або SUPABASE_SERVICE_ROLE_KEY не знайдені в .env файлі');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createDatabaseStructure() {
  try {
    console.log('🔌 Підключення до Supabase...');
    
    console.log('📋 Читання SQL файлу структури...');
    const sql = fs.readFileSync('database_structure_complete.sql', 'utf8');
    
    console.log('🔨 Створення структури бази даних через RPC...');
    
    // Розділяємо SQL на окремі команди, враховуючи багаторядкові команди
    const lines = sql.split('\n');
    const statements = [];
    let currentStatement = '';
    let inStatement = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Пропускаємо коментарі та порожні рядки
      if (trimmedLine.startsWith('--') || trimmedLine === '') {
        continue;
      }
      
      // Початок нової команди
      if (trimmedLine.toUpperCase().startsWith('CREATE TABLE') || 
          trimmedLine.toUpperCase().startsWith('CREATE EXTENSION') || 
          trimmedLine.toUpperCase().startsWith('ALTER TABLE')) {
        if (currentStatement.trim()) {
          statements.push(currentStatement.trim());
        }
        currentStatement = line;
        inStatement = true;
      } else if (inStatement) {
        currentStatement += '\n' + line;
      }
      
      // Кінець команди
      if (trimmedLine.endsWith(';') && inStatement) {
        statements.push(currentStatement.trim());
        currentStatement = '';
        inStatement = false;
      }
    }
    
    // Додаємо останню команду, якщо вона є
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    console.log(`🔍 Знайдено ${statements.length} SQL команд`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
         console.log(`📝 Виконання команди ${i + 1}/${statements.length}`);
         
         const { data, error } = await supabase.rpc('execute_sql', {
           sql_query: statement
         });
         
         if (error) {
           throw error;
         }
         
         console.log(`✅ Команда ${i + 1} виконана успішно`);
         successCount++;
         
         // Невелика затримка між командами
         await new Promise(resolve => setTimeout(resolve, 100));
         
       } catch (err) {
         console.error(`❌ Критична помилка в команді ${i + 1}:`, err.message);
         errorCount++;
       }
    }
    
    console.log('\n📊 Підсумок створення структури:');
    console.log(`✅ Успішно: ${successCount}`);
    console.log(`❌ Помилки: ${errorCount}`);
    console.log(`📋 Всього: ${successCount + errorCount}`);
    
    if (errorCount > 0) {
      console.log('\n⚠️  Деякі команди завершилися з помилками. Перевірте логи вище.');
    } else {
      console.log('\n🎉 Структура бази даних створена успішно!');
    }
    
  } catch (error) {
    console.error('❌ Критична помилка:', error.message || error);
    console.error('Деталі помилки:', error);
    process.exit(1);
  }
}

createDatabaseStructure();