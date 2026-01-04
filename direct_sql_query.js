const https = require('https');
require('dotenv').config();

async function directSQLQuery() {
  try {
    console.log('Виконання прямого SQL запиту до Supabase...');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Помилка: SUPABASE_URL або SUPABASE_SERVICE_ROLE_KEY не знайдені в .env файлі');
      return;
    }
    
    // Спроба додати відсутні колонки через RPC alter_table_add_column
    console.log('\n=== Додавання колонок у appointments через RPC ===');
    const addCols = [
      { table: 'appointments', column: 'completion_date', type: 'timestamptz' },
      { table: 'appointments', column: 'cancellation_reason', type: 'text' },
      { table: 'appointments', column: 'cancellation_date', type: 'timestamptz' },
    ];
    for (const payload of addCols) {
      const r = await rpcCall(supabaseUrl, supabaseServiceKey, 'alter_table_add_column', payload);
      if (r.error) {
        console.log(`❌ ${payload.column}: ${r.error}`);
      } else {
        console.log(`✅ ${payload.column}: успішно`);
      }
    }

    // Список SQL запитів для перевірки таблиць
    const queries = [
      {
        name: 'Список всіх таблиць',
        sql: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;`
      },
      {
        name: 'Кількість записів у кожній таблиці',
        sql: `
          SELECT 
            schemaname,
            tablename,
            n_tup_ins as total_inserts,
            n_tup_upd as total_updates,
            n_tup_del as total_deletes,
            n_live_tup as live_rows,
            n_dead_tup as dead_rows
          FROM pg_stat_user_tables 
          ORDER BY n_live_tup DESC;
        `
      },
      {
        name: 'Структура таблиці users',
        sql: `
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = 'users'
          ORDER BY ordinal_position;
        `
      },
      {
        name: 'Структура таблиці appointments',
        sql: `
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_schema='public' AND table_name='appointments'
          ORDER BY ordinal_position;
        `
      },
      {
        name: 'Перевірка існування service_records',
        sql: `
          SELECT to_regclass('public.service_records') AS service_records_exists;
        `
      },
      {
        name: 'RLS політики для service_records',
        sql: `
          SELECT policyname, cmd
          FROM pg_policies
          WHERE schemaname='public' AND tablename='service_records'
          ORDER BY policyname;
        `
      }
    ];
    
    const results = {};
    
    for (const query of queries) {
      console.log(`\n=== ${query.name} ===`);
      
      try {
        const result = await executeSQL(supabaseUrl, supabaseServiceKey, query.sql);
        results[query.name] = result;
        
        if (result.error) {
          console.log(`❌ Помилка: ${result.error}`);
        } else {
          console.log(`✅ Успішно виконано. Отримано ${result.data?.length || 0} записів`);
          
          // Виводимо перші кілька записів
          if (result.data && result.data.length > 0) {
            console.log('Перші записи:');
            result.data.slice(0, 5).forEach((row, index) => {
              console.log(`  ${index + 1}. ${JSON.stringify(row)}`);
            });
            
            if (result.data.length > 5) {
              console.log(`  ... та ще ${result.data.length - 5} записів`);
            }
          }
        }
        
      } catch (err) {
        console.log(`❌ Критична помилка: ${err.message}`);
        results[query.name] = { error: err.message };
      }
    }
    
    // Зберігаємо результати
    const fs = require('fs');
    fs.writeFileSync('./direct_sql_results.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      supabase_url: supabaseUrl,
      results: results
    }, null, 2));
    
    console.log('\n=== РЕЗУЛЬТАТИ ЗБЕРЕЖЕНО ===');
    console.log('Результати збережено у файл direct_sql_results.json');
    
    return results;
    
  } catch (err) {
    console.error('Загальна помилка:', err.message);
    return { error: err.message };
  }
}

function executeSQL(supabaseUrl, serviceKey, sql) {
  return new Promise((resolve, reject) => {
    const url = new URL('/rest/v1/rpc/exec_sql', supabaseUrl);
    
    const postData = JSON.stringify({
      sql: sql
    });
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Profile': 'public',
        'Content-Profile': 'public',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ data: result, status: res.statusCode });
          } else {
            resolve({ error: result.message || `HTTP ${res.statusCode}`, status: res.statusCode });
          }
        } catch (parseErr) {
          resolve({ error: `Parse error: ${parseErr.message}`, raw_data: data });
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    req.write(postData);
    req.end();
  });
}

// Запускаємо функцію
directSQLQuery().then(result => {
  console.log('\n=== ЗАВЕРШЕНО ===');
  console.log('Прямий SQL запит завершено.');
}).catch(err => {
  console.error('Критична помилка:', err);
});
function rpcCall(supabaseUrl, serviceKey, fnName, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(`/rest/v1/rpc/${fnName}`, supabaseUrl);
    const postData = JSON.stringify(payload || {});
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data || '{}');
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ data: result, status: res.statusCode });
          } else {
            resolve({ error: result.message || `HTTP ${res.statusCode}`, status: res.statusCode, raw: data });
          }
        } catch (err) {
          resolve({ error: `Parse error: ${err.message}`, raw: data });
        }
      });
    });
    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}
