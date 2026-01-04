require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function executeTestData() {
  try {
    console.log('🔍 Перевірка наявності таблиць...');
    
    // Перевіряємо, чи існують таблиці
    try {
      const { data: tables } = await supabase
        .from('service_stations')
        .select('id')
        .limit(1);
    } catch (error) {
      if (error.message.includes('does not exist')) {
        console.log('⚠️  Таблиці не існують. Спочатку потрібно створити структуру бази даних.');
        console.log('📝 Запустіть: node create_database_structure.js');
        console.log('💡 Не забудьте встановити SUPABASE_DB_PASSWORD в .env файлі');
        return;
      }
    }
    
    console.log('📋 Читання SQL файлу...');
    const sql = fs.readFileSync('test_data_script_with_real_ids.sql', 'utf8');
    
    // Розділяємо SQL на окремі INSERT запити
    const insertStatements = [];
    const lines = sql.split('\n');
    let currentStatement = '';
    let inInsert = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Пропускаємо коментарі та порожні рядки
      if (trimmedLine.startsWith('--') || trimmedLine === '') {
        continue;
      }
      
      // Початок INSERT запиту
      if (trimmedLine.startsWith('INSERT INTO')) {
        if (currentStatement && inInsert) {
          insertStatements.push(currentStatement.trim());
        }
        currentStatement = trimmedLine;
        inInsert = true;
      } else if (inInsert) {
        currentStatement += ' ' + trimmedLine;
        
        // Кінець INSERT запиту (рядок закінчується на ;)
        if (trimmedLine.endsWith(';')) {
          insertStatements.push(currentStatement.trim());
          currentStatement = '';
          inInsert = false;
        }
      }
    }
    
    // Додаємо останній запит, якщо він є
    if (currentStatement && inInsert) {
      insertStatements.push(currentStatement.trim());
    }
    
    console.log(`🔍 Знайдено ${insertStatements.length} INSERT запитів`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < insertStatements.length; i++) {
      const statement = insertStatements[i];
      
      // Витягуємо назву таблиці
      const tableMatch = statement.match(/INSERT INTO\s+(\w+)/);
      if (!tableMatch) {
        console.log(`⚠️  Пропускаємо запит ${i + 1}: не вдалося визначити таблицю`);
        continue;
      }
      
      const tableName = tableMatch[1];
      console.log(`\n📝 Виконання запиту ${i + 1}/${insertStatements.length}: ${tableName}`);
      
      try {
        // Парсимо INSERT запит для отримання даних
        const valuesMatch = statement.match(/VALUES\s*\(([^)]+(?:\)\s*,\s*\([^)]+)*)\)/i);
        if (!valuesMatch) {
          console.error(`❌ Не вдалося розпарсити VALUES для таблиці ${tableName}`);
          errorCount++;
          continue;
        }
        
        // Отримуємо колонки
        const columnsMatch = statement.match(/\(([^)]+)\)\s+VALUES/i);
        if (!columnsMatch) {
          console.error(`❌ Не вдалося розпарсити колонки для таблиці ${tableName}`);
          errorCount++;
          continue;
        }
        
        const columns = columnsMatch[1].split(',').map(col => col.trim());
        
        // Розбираємо VALUES на окремі рядки
        const valuesString = valuesMatch[1];
        const valueRows = [];
        let currentRow = '';
        let parenCount = 0;
        let inQuotes = false;
        let quoteChar = '';
        
        for (let i = 0; i < valuesString.length; i++) {
          const char = valuesString[i];
          
          if (!inQuotes && (char === '\'' || char === '"')) {
            inQuotes = true;
            quoteChar = char;
          } else if (inQuotes && char === quoteChar && valuesString[i-1] !== '\\') {
            inQuotes = false;
            quoteChar = '';
          }
          
          if (!inQuotes) {
            if (char === '(') parenCount++;
            else if (char === ')') parenCount--;
          }
          
          currentRow += char;
          
          if (!inQuotes && parenCount === 0 && char === ')') {
            valueRows.push(currentRow.trim());
            currentRow = '';
            // Пропускаємо кому та пробіли до наступної дужки
            while (i + 1 < valuesString.length && (valuesString[i + 1] === ',' || valuesString[i + 1] === ' ')) {
              i++;
            }
          }
        }
        
        // Конвертуємо кожен рядок в об'єкт
        const dataToInsert = valueRows.map(row => {
          const values = [];
          let currentValue = '';
          let parenCount = 0;
          let inQuotes = false;
          let quoteChar = '';
          
          // Видаляємо зовнішні дужки
          const cleanRow = row.slice(1, -1);
          
          for (let i = 0; i < cleanRow.length; i++) {
            const char = cleanRow[i];
            
            if (!inQuotes && (char === '\'' || char === '"')) {
              inQuotes = true;
              quoteChar = char;
            } else if (inQuotes && char === quoteChar && cleanRow[i-1] !== '\\') {
              inQuotes = false;
              quoteChar = '';
            }
            
            if (!inQuotes) {
              if (char === '{') parenCount++;
              else if (char === '}') parenCount--;
            }
            
            if (!inQuotes && parenCount === 0 && char === ',') {
              values.push(currentValue.trim());
              currentValue = '';
            } else {
              currentValue += char;
            }
          }
          
          if (currentValue.trim()) {
            values.push(currentValue.trim());
          }
          
          // Створюємо об'єкт з колонок та значень
          const rowObject = {};
          columns.forEach((col, index) => {
            let value = values[index];
            if (value) {
              // Видаляємо лапки з рядків
              if ((value.startsWith('\'') && value.endsWith('\'')) || 
                  (value.startsWith('"') && value.endsWith('"'))) {
                value = value.slice(1, -1);
              }
              // Конвертуємо числа
              if (!isNaN(value) && !isNaN(parseFloat(value)) && value !== '') {
                value = parseFloat(value);
              }
              // Конвертуємо булеві значення
              if (value === 'true') value = true;
              if (value === 'false') value = false;
              if (value === 'NULL' || value === 'null') value = null;
            }
            rowObject[col] = value;
          });
          
          return rowObject;
        });
        
        // Вставляємо дані через Supabase клієнт
        const { data, error } = await supabase
          .from(tableName)
          .insert(dataToInsert);
        
        if (error) {
          console.error(`❌ Помилка в таблиці ${tableName}:`, error.message);
          errorCount++;
        } else {
          console.log(`✅ Успішно додано ${dataToInsert.length} записів в таблицю ${tableName}`);
          successCount++;
        }
        
        // Невелика затримка між запитами
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (err) {
        console.error(`❌ Критична помилка в таблиці ${tableName}:`, err.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Підсумок виконання:');
    console.log(`✅ Успішно: ${successCount}`);
    console.log(`❌ Помилки: ${errorCount}`);
    console.log(`📋 Всього: ${successCount + errorCount}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Всі тестові дані успішно додано в базу даних!');
    } else {
      console.log('\n⚠️  Деякі запити завершилися з помилками. Перевірте логи вище.');
    }
    
  } catch (error) {
    console.error('❌ Критична помилка:', error.message);
  }
}

executeTestData();