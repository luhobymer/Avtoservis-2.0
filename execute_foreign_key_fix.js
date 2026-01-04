const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase URL або ключ не знайдено в .env файлі');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeForeignKeyFix() {
  console.log('🔧 Виправлення foreign key constraints для appointments...');
  
  try {
    // 1. Видалення існуючих constraints
    console.log('\n1. Видалення існуючих constraints...');
    
    const dropConstraints = [
      'ALTER TABLE appointments DROP CONSTRAINT IF EXISTS fk_appointments_mechanic_id',
      'ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_mechanic_id_fkey'
    ];
    
    for (const sql of dropConstraints) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) {
          console.log(`⚠️ ${sql}: ${error.message}`);
        } else {
          console.log(`✅ ${sql}`);
        }
      } catch (err) {
        console.log(`⚠️ ${sql}: ${err.message}`);
      }
    }
    
    // 2. Перевірка некоректних значень
    console.log('\n2. Перевірка некоректних значень mechanic_id...');
    
    const { data: invalidMechanicIds, error: checkError } = await supabase
      .from('appointments')
      .select(`
        id,
        mechanic_id
      `)
      .not('mechanic_id', 'is', null);
    
    if (checkError) {
      console.error('❌ Помилка при перевірці mechanic_id:', checkError.message);
    } else {
      console.log(`✅ Знайдено ${invalidMechanicIds?.length || 0} записів з mechanic_id`);
      
      if (invalidMechanicIds && invalidMechanicIds.length > 0) {
        // Перевіряємо які mechanic_id існують
        const { data: existingMechanics, error: mechanicsError } = await supabase
          .from('mechanics')
          .select('id');
        
        if (mechanicsError) {
          console.error('❌ Помилка при отриманні mechanics:', mechanicsError.message);
        } else {
          const validMechanicIds = existingMechanics.map(m => m.id);
          const invalidAppointments = invalidMechanicIds.filter(a => 
            !validMechanicIds.includes(a.mechanic_id)
          );
          
          console.log(`✅ Знайдено ${invalidAppointments.length} записів з некоректним mechanic_id`);
          
          // Очищаємо некоректні значення
          if (invalidAppointments.length > 0) {
            for (const appointment of invalidAppointments) {
              const { error: updateError } = await supabase
                .from('appointments')
                .update({ mechanic_id: null })
                .eq('id', appointment.id);
              
              if (updateError) {
                console.error(`❌ Помилка очищення mechanic_id для ${appointment.id}:`, updateError.message);
              } else {
                console.log(`✅ Очищено mechanic_id для appointment ${appointment.id}`);
              }
            }
          }
        }
      }
    }
    
    // 3. Спроба додати foreign key constraint через RPC
    console.log('\n3. Додавання foreign key constraint...');
    
    const addConstraintSQL = `
      ALTER TABLE appointments 
      ADD CONSTRAINT fk_appointments_mechanic_id 
      FOREIGN KEY (mechanic_id) 
      REFERENCES mechanics(id) 
      ON DELETE SET NULL
    `;
    
    try {
      const { error: constraintError } = await supabase.rpc('exec_sql', { 
        sql_query: addConstraintSQL 
      });
      
      if (constraintError) {
        console.error('❌ Помилка додавання constraint:', constraintError.message);
      } else {
        console.log('✅ Foreign key constraint додано успішно');
      }
    } catch (err) {
      console.error('❌ Критична помилка додавання constraint:', err.message);
    }
    
    // 4. Створення індексу
    console.log('\n4. Створення індексу...');
    
    const createIndexSQL = 'CREATE INDEX IF NOT EXISTS idx_appointments_mechanic_id ON appointments(mechanic_id)';
    
    try {
      const { error: indexError } = await supabase.rpc('exec_sql', { 
        sql_query: createIndexSQL 
      });
      
      if (indexError) {
        console.error('❌ Помилка створення індексу:', indexError.message);
      } else {
        console.log('✅ Індекс створено успішно');
      }
    } catch (err) {
      console.error('❌ Критична помилка створення індексу:', err.message);
    }
    
    // 5. Тестування JOIN запиту
    console.log('\n5. Тестування JOIN запиту...');
    
    try {
      const { data: joinTest, error: joinError } = await supabase
        .from('appointments')
        .select(`
          id,
          scheduled_time,
          status,
          mechanic_id,
          mechanics(
            id,
            name,
            specialization
          )
        `)
        .limit(3);
      
      if (joinError) {
        console.error('❌ JOIN запит все ще не працює:', joinError.message);
        
        // Альтернативний підхід - ручний JOIN
        console.log('\n6. Альтернативний підхід - ручний JOIN...');
        
        const { data: appointments, error: appError } = await supabase
          .from('appointments')
          .select('*')
          .limit(3);
        
        if (appError) {
          console.error('❌ Помилка отримання appointments:', appError.message);
        } else {
          console.log('✅ Appointments отримано:', appointments?.length || 0);
          
          for (const appointment of appointments || []) {
            if (appointment.mechanic_id) {
              const { data: mechanic, error: mechError } = await supabase
                .from('mechanics')
                .select('*')
                .eq('id', appointment.mechanic_id)
                .single();
              
              if (mechError) {
                console.log(`⚠️ Механік ${appointment.mechanic_id} не знайдений`);
              } else {
                console.log(`✅ Appointment ${appointment.id} -> Mechanic ${mechanic.name}`);
              }
            }
          }
        }
      } else {
        console.log('✅ JOIN запит працює!');
        console.log('Результат:', joinTest);
      }
    } catch (err) {
      console.error('❌ Критична помилка тестування:', err.message);
    }
    
    console.log('\n🎉 Виправлення завершено!');
    console.log('\nРекомендації:');
    console.log('1. Перезапустіть сервер Node.js');
    console.log('2. Оновіть схему в Supabase Dashboard (Settings -> API -> Refresh Schema)');
    console.log('3. Перевірте роботу мобільного додатку');
    
  } catch (error) {
    console.error('❌ Загальна помилка:', error.message);
    console.error('Стек помилки:', error.stack);
  }
}

executeForeignKeyFix();