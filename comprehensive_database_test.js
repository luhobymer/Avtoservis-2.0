const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase конфігурація з .env файлу
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Помилка: SUPABASE_URL або SUPABASE_SERVICE_ROLE_KEY не знайдено в .env файлі');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function comprehensiveDatabaseTest() {
  console.log('🧪 КОМПЛЕКСНЕ ТЕСТУВАННЯ БАЗИ ДАНИХ');
  console.log('=' .repeat(60));
  
  const results = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    warnings: 0
  };
  
  try {
    console.log('\n0️⃣ ПЕРЕВІРКА RLS ТА СХЕМИ');
    console.log('-'.repeat(40));

    const expectedTables = [
      'users',
      'vehicles',
      'appointments',
      'service_history',
      'service_records',
      'reminders',
      'notifications',
      'parts',
      'services',
      'service_stations',
      'mechanics',
      'push_tokens',
      'scheduled_notifications',
      'user_settings'
    ];

    results.totalTests++;
    try {
      const { data: tablesInfo, error: tablesError } = await supabase
        .from('pg_tables')
        .select('schemaname, tablename, rowsecurity')
        .eq('schemaname', 'public')
        .in('tablename', expectedTables);

      if (tablesError) {
        console.log(`❌ RLS статус таблиць: ${tablesError.message}`);
        results.failedTests++;
      } else {
        const existing = Array.isArray(tablesInfo) ? tablesInfo : [];
        const missing = expectedTables.filter(t => !existing.some(row => row.tablename === t));
        const noRls = existing.filter(row => row.rowsecurity === false).map(row => row.tablename);
        console.log(`✅ Отримано інформацію про ${existing.length} таблиць`);
        if (missing.length > 0) {
          console.log(`⚠️ Відсутні очікувані таблиці: ${missing.join(', ')}`);
          results.warnings++;
        }
        if (noRls.length > 0) {
          console.log(`⚠️ Вимкнений RLS для: ${noRls.join(', ')}`);
          results.warnings++;
        }
        results.passedTests++;
      }
    } catch (err) {
      console.log(`❌ Помилка перевірки RLS статусу таблиць: ${err.message}`);
      results.failedTests++;
    }

    results.totalTests++;
    try {
      const { data: policies, error: policiesError } = await supabase
        .from('pg_policies')
        .select('schemaname, tablename, policyname, cmd, qual, with_check')
        .eq('schemaname', 'public')
        .in('tablename', expectedTables);

      if (policiesError) {
        console.log(`❌ Перевірка політик безпеки: ${policiesError.message}`);
        results.failedTests++;
      } else {
        const list = Array.isArray(policies) ? policies : [];
        console.log(`✅ Завантажено ${list.length} політик безпеки`);
        const risky = list.filter(p => p.qual === 'true' || p.with_check === 'true');
        if (risky.length > 0) {
          console.log('⚠️ Виявлено потенційно ризикові політики (qual/with_check = true):');
          risky.forEach(p => {
            console.log(`   - ${p.tablename} / ${p.policyname} / ${p.cmd}`);
          });
          results.warnings++;
        }
        results.passedTests++;
      }
    } catch (err) {
      console.log(`❌ Помилка перевірки політик безпеки: ${err.message}`);
      results.failedTests++;
    }

    results.totalTests++;
    try {
      const { data: columnsInfo, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('table_name, column_name')
        .eq('table_schema', 'public')
        .in('table_name', ['appointments', 'service_records']);

      if (columnsError) {
        console.log(`❌ Помилка перевірки структури таблиць: ${columnsError.message}`);
        results.failedTests++;
      } else {
        const cols = Array.isArray(columnsInfo) ? columnsInfo : [];
        const appointmentsCols = cols.filter(c => c.table_name === 'appointments').map(c => c.column_name);
        const serviceRecordsCols = cols.filter(c => c.table_name === 'service_records').map(c => c.column_name);
        console.log(`✅ Колонки appointments: ${appointmentsCols.join(', ')}`);
        console.log(`✅ Колонки service_records: ${serviceRecordsCols.join(', ')}`);
        const expectedAppointments = ['id', 'user_id', 'vehicle_id', 'vehicle_vin', 'service_type', 'scheduled_time', 'status'];
        const expectedServiceRecords = ['id', 'vehicle_id', 'vehicle_vin', 'service_date', 'mileage', 'description', 'service_details'];
        const missingAppointments = expectedAppointments.filter(c => !appointmentsCols.includes(c));
        const missingServiceRecords = expectedServiceRecords.filter(c => !serviceRecordsCols.includes(c));
        if (missingAppointments.length > 0) {
          console.log(`⚠️ Відсутні ключові колонки в appointments: ${missingAppointments.join(', ')}`);
          results.warnings++;
        }
        if (missingServiceRecords.length > 0) {
          console.log(`⚠️ Відсутні ключові колонки в service_records: ${missingServiceRecords.join(', ')}`);
          results.warnings++;
        }
        results.passedTests++;
      }
    } catch (err) {
      console.log(`❌ Проблема аналізу колонок: ${err.message}`);
      results.failedTests++;
    }

    // 1. Тестування базових таблиць
    console.log('\n1️⃣ ТЕСТУВАННЯ БАЗОВИХ ТАБЛИЦЬ');
    console.log('-'.repeat(40));
    
    const tables = ['users', 'vehicles', 'services', 'appointments'];
    
    for (const table of tables) {
      results.totalTests++;
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          console.log(`❌ ${table}: ${error.message}`);
          results.failedTests++;
        } else {
          console.log(`✅ ${table}: ${count} записів`);
          results.passedTests++;
        }
      } catch (err) {
        console.log(`❌ ${table}: ${err.message}`);
        results.failedTests++;
      }
    }
    
    // 2. Тестування JOIN appointments ↔ users
    console.log('\n2️⃣ ТЕСТУВАННЯ JOIN: appointments ↔ users');
    console.log('-'.repeat(40));
    
    results.totalTests++;
    try {
      const { data: appointmentsUsers, error: auError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          status,
          users (
            id,
            name,
            email
          )
        `)
        .limit(3);
      
      if (auError) {
        console.log(`❌ appointments ↔ users JOIN: ${auError.message}`);
        results.failedTests++;
      } else {
        const withUsers = appointmentsUsers.filter(a => a.users !== null).length;
        console.log(`✅ appointments ↔ users JOIN: ${appointmentsUsers.length} записів, ${withUsers} з users`);
        results.passedTests++;
        
        if (withUsers < appointmentsUsers.length) {
          console.log(`⚠️ ${appointmentsUsers.length - withUsers} appointments без users`);
          results.warnings++;
        }
      }
    } catch (err) {
      console.log(`❌ appointments ↔ users JOIN: ${err.message}`);
      results.failedTests++;
    }
    
    // 3. Тестування JOIN appointments ↔ vehicles
    console.log('\n3️⃣ ТЕСТУВАННЯ JOIN: appointments ↔ vehicles');
    console.log('-'.repeat(40));
    
    results.totalTests++;
    try {
      const { data: appointmentsVehicles, error: avError } = await supabase
        .from('appointments')
        .select(`
          id,
          vehicle_id,
          vehicle_vin,
          vehicles (
            vin,
            make,
            model,
            brand,
            year
          )
        `)
        .limit(5);
      
      if (avError) {
        console.log(`❌ appointments ↔ vehicles JOIN: ${avError.message}`);
        results.failedTests++;
      } else {
        const withVehicles = appointmentsVehicles.filter(a => a.vehicles !== null).length;
        console.log(`✅ appointments ↔ vehicles JOIN: ${appointmentsVehicles.length} записів, ${withVehicles} з vehicles`);
        results.passedTests++;
        
        if (withVehicles < appointmentsVehicles.length) {
          console.log(`⚠️ ${appointmentsVehicles.length - withVehicles} appointments без vehicles`);
          results.warnings++;
        }
      }
    } catch (err) {
      console.log(`❌ appointments ↔ vehicles JOIN: ${err.message}`);
      results.failedTests++;
    }
    
    // 4. Тестування JOIN appointments ↔ services
    console.log('\n4️⃣ ТЕСТУВАННЯ JOIN: appointments ↔ services');
    console.log('-'.repeat(40));
    
    results.totalTests++;
    try {
      const { data: appointmentsServices, error: asError } = await supabase
        .from('appointments')
        .select(`
          id,
          service_type,
          service_id,
          services (
            id,
            name,
            price,
            duration
          )
        `)
        .limit(5);
      
      if (asError) {
        console.log(`❌ appointments ↔ services JOIN: ${asError.message}`);
        results.failedTests++;
      } else {
        const withServices = appointmentsServices.filter(a => a.services !== null).length;
        console.log(`✅ appointments ↔ services JOIN: ${appointmentsServices.length} записів, ${withServices} з services`);
        results.passedTests++;
        
        if (withServices < appointmentsServices.length) {
          console.log(`⚠️ ${appointmentsServices.length - withServices} appointments без services`);
          results.warnings++;
        }
      }
    } catch (err) {
      console.log(`❌ appointments ↔ services JOIN: ${err.message}`);
      results.failedTests++;
    }
    
    // 5. Комплексний JOIN з усіма таблицями
    console.log('\n5️⃣ КОМПЛЕКСНИЙ JOIN: appointments ↔ users ↔ vehicles ↔ services');
    console.log('-'.repeat(40));
    
    results.totalTests++;
    try {
      const { data: complexJoin, error: cjError } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          date,
          time,
          status,
          service_type,
          users (
            name,
            email
          ),
          vehicles (
            vin,
            make,
            model,
            year
          ),
          services (
            name,
            price,
            duration
          )
        `)
        .limit(3);
      
      if (cjError) {
        console.log(`❌ Комплексний JOIN: ${cjError.message}`);
        results.failedTests++;
      } else {
        console.log(`✅ Комплексний JOIN: ${complexJoin.length} записів`);
        results.passedTests++;
        
        // Аналізуємо повноту даних
        const analysis = {
          withUsers: complexJoin.filter(a => a.users !== null).length,
          withVehicles: complexJoin.filter(a => a.vehicles !== null).length,
          withServices: complexJoin.filter(a => a.services !== null).length,
          complete: complexJoin.filter(a => a.users && a.vehicles && a.services).length
        };
        
        console.log(`📊 Аналіз повноти даних:`);
        console.log(`   - З users: ${analysis.withUsers}/${complexJoin.length}`);
        console.log(`   - З vehicles: ${analysis.withVehicles}/${complexJoin.length}`);
        console.log(`   - З services: ${analysis.withServices}/${complexJoin.length}`);
        console.log(`   - Повні записи: ${analysis.complete}/${complexJoin.length}`);
        
        if (analysis.complete < complexJoin.length) {
          results.warnings++;
        }
      }
    } catch (err) {
      console.log(`❌ Комплексний JOIN: ${err.message}`);
      results.failedTests++;
    }
    
    // 6. Тестування фільтрації та сортування
    console.log('\n6️⃣ ТЕСТУВАННЯ ФІЛЬТРАЦІЇ ТА СОРТУВАННЯ');
    console.log('-'.repeat(40));
    
    // Фільтрація за статусом
    results.totalTests++;
    try {
      const { data: filteredByStatus, error: fbsError } = await supabase
        .from('appointments')
        .select('id, status')
        .eq('status', 'pending')
        .limit(5);
      
      if (fbsError) {
        console.log(`❌ Фільтрація за статусом: ${fbsError.message}`);
        results.failedTests++;
      } else {
        console.log(`✅ Фільтрація за статусом 'pending': ${filteredByStatus.length} записів`);
        results.passedTests++;
      }
    } catch (err) {
      console.log(`❌ Фільтрація за статусом: ${err.message}`);
      results.failedTests++;
    }
    
    // Сортування за датою
    results.totalTests++;
    try {
      const { data: sortedByDate, error: sbdError } = await supabase
        .from('appointments')
        .select('id, appointment_date, date')
        .order('appointment_date', { ascending: false })
        .limit(3);
      
      if (sbdError) {
        console.log(`❌ Сортування за датою: ${sbdError.message}`);
        results.failedTests++;
      } else {
        console.log(`✅ Сортування за датою: ${sortedByDate.length} записів`);
        results.passedTests++;
      }
    } catch (err) {
      console.log(`❌ Сортування за датою: ${err.message}`);
      results.failedTests++;
    }
    
    // 7. Тестування CRUD операцій
    console.log('\n7️⃣ ТЕСТУВАННЯ CRUD ОПЕРАЦІЙ');
    console.log('-'.repeat(40));
    
    // CREATE - створення тестового appointment
    results.totalTests++;
    try {
      const { data: newAppointment, error: createError } = await supabase
        .from('appointments')
        .insert({
          user_id: 'b07111e6-33bf-4da1-a66f-1a2fc0c3c922', // Використовуємо існуючий user_id
          vehicle_vin: '1HGCM82633A123456',
          service_type: 'Тестова послуга',
          appointment_date: new Date().toISOString(),
          date: new Date().toISOString().split('T')[0],
          time: '10:00:00',
          status: 'pending'
        })
        .select()
        .single();
      
      if (createError) {
        console.log(`❌ CREATE операція: ${createError.message}`);
        results.failedTests++;
      } else {
        console.log(`✅ CREATE операція: створено appointment ${newAppointment.id}`);
        results.passedTests++;
        
        // UPDATE - оновлення створеного appointment
        results.totalTests++;
        const { error: updateError } = await supabase
          .from('appointments')
          .update({ status: 'confirmed' })
          .eq('id', newAppointment.id);
        
        if (updateError) {
          console.log(`❌ UPDATE операція: ${updateError.message}`);
          results.failedTests++;
        } else {
          console.log(`✅ UPDATE операція: оновлено статус appointment`);
          results.passedTests++;
        }
        
        // DELETE - видалення тестового appointment
        results.totalTests++;
        const { error: deleteError } = await supabase
          .from('appointments')
          .delete()
          .eq('id', newAppointment.id);
        
        if (deleteError) {
          console.log(`❌ DELETE операція: ${deleteError.message}`);
          results.failedTests++;
        } else {
          console.log(`✅ DELETE операція: видалено тестовий appointment`);
          results.passedTests++;
        }
      }
    } catch (err) {
      console.log(`❌ CRUD операції: ${err.message}`);
      results.failedTests++;
    }
    
    // 8. Фінальний звіт
    console.log('\n' + '='.repeat(60));
    console.log('📊 ФІНАЛЬНИЙ ЗВІТ ТЕСТУВАННЯ');
    console.log('='.repeat(60));
    
    console.log(`🧪 Загальна кількість тестів: ${results.totalTests}`);
    console.log(`✅ Успішні тести: ${results.passedTests}`);
    console.log(`❌ Невдалі тести: ${results.failedTests}`);
    console.log(`⚠️ Попередження: ${results.warnings}`);
    
    const successRate = ((results.passedTests / results.totalTests) * 100).toFixed(1);
    console.log(`📈 Відсоток успішності: ${successRate}%`);
    
    if (results.failedTests === 0) {
      console.log('\n🎉 ВСІ ТЕСТИ ПРОЙШЛИ УСПІШНО!');
      console.log('✅ База даних готова до використання');
    } else {
      console.log('\n⚠️ ВИЯВЛЕНО ПРОБЛЕМИ');
      console.log('🔧 Потрібні додаткові виправлення');
    }
    
    if (results.warnings > 0) {
      console.log(`\n💡 Рекомендації для покращення:`);
      console.log(`   - Заповнити відсутні зв'язки між таблицями`);
      console.log(`   - Додати відсутні service записи`);
      console.log(`   - Перевірити цілісність даних`);
    }
    
  } catch (error) {
    console.log('❌ Критична помилка тестування:', error.message);
  }
}

comprehensiveDatabaseTest();
