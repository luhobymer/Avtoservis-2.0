const axios = require('axios');
require('dotenv').config();

// API конфігурація
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.SUPABASE_ANON_KEY;

if (!API_KEY) {
  console.error('❌ Помилка: SUPABASE_ANON_KEY не знайдено в .env файлі');
  process.exit(1);
}

// Налаштування axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'apikey': API_KEY,
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

async function testAPIEndpoints() {
  console.log('🌐 ТЕСТУВАННЯ API ЕНДПОІНТІВ');
  console.log('=' .repeat(60));
  console.log(`🔗 Base URL: ${API_BASE_URL}`);
  
  const results = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    warnings: 0
  };
  
  const endpoints = [
    {
      name: 'Users',
      url: '/rest/v1/users',
      method: 'GET',
      expectedFields: ['id', 'name', 'email']
    },
    {
      name: 'Vehicles',
      url: '/rest/v1/vehicles',
      method: 'GET',
      expectedFields: ['vin', 'make', 'model', 'year']
    },
    {
      name: 'Services',
      url: '/rest/v1/services',
      method: 'GET',
      expectedFields: ['id', 'name', 'price']
    },
    {
      name: 'Appointments',
      url: '/rest/v1/appointments',
      method: 'GET',
      expectedFields: ['id', 'user_id', 'appointment_date', 'status']
    },
    {
      name: 'Appointments with Users JOIN',
      url: '/rest/v1/appointments?select=id,appointment_date,status,users(name,email)',
      method: 'GET',
      expectedFields: ['id', 'users']
    },
    {
      name: 'Appointments with Vehicles JOIN',
      url: '/rest/v1/appointments?select=id,vehicle_id,vehicles(vin,make,model)',
      method: 'GET',
      expectedFields: ['id', 'vehicles']
    },
    {
      name: 'Appointments with Services JOIN',
      url: '/rest/v1/appointments?select=id,service_id,services(name,price)',
      method: 'GET',
      expectedFields: ['id', 'services']
    },
    {
      name: 'Complex JOIN (All tables)',
      url: '/rest/v1/appointments?select=id,appointment_date,users(name),vehicles(make,model),services(name)',
      method: 'GET',
      expectedFields: ['id', 'users', 'vehicles', 'services']
    }
  ];
  
  try {
    for (const endpoint of endpoints) {
      console.log(`\n🧪 Тестування: ${endpoint.name}`);
      console.log('-'.repeat(40));
      
      results.totalTests++;
      
      try {
        const startTime = Date.now();
        const response = await api.request({
          method: endpoint.method,
          url: endpoint.url
        });
        const responseTime = Date.now() - startTime;
        
        // Перевірка статус коду
        if (response.status === 200) {
          console.log(`✅ Статус: ${response.status} OK`);
          console.log(`⏱️ Час відповіді: ${responseTime}ms`);
          
          const data = response.data;
          
          if (Array.isArray(data)) {
            console.log(`📊 Кількість записів: ${data.length}`);
            
            if (data.length > 0) {
              // Перевірка наявності очікуваних полів
              const firstRecord = data[0];
              const missingFields = endpoint.expectedFields.filter(field => {
                if (field.includes('.')) {
                  // Для вкладених полів (JOIN)
                  const [parentField] = field.split('.');
                  return !(parentField in firstRecord);
                } else {
                  return !(field in firstRecord);
                }
              });
              
              if (missingFields.length === 0) {
                console.log(`✅ Всі очікувані поля присутні`);
                
                // Додаткова перевірка для JOIN запитів
                if (endpoint.name.includes('JOIN')) {
                  const joinFields = endpoint.expectedFields.filter(f => 
                    ['users', 'vehicles', 'services'].includes(f)
                  );
                  
                  for (const joinField of joinFields) {
                    const recordsWithJoin = data.filter(record => 
                      record[joinField] !== null && record[joinField] !== undefined
                    ).length;
                    
                    const percentage = ((recordsWithJoin / data.length) * 100).toFixed(1);
                    console.log(`🔗 ${joinField}: ${recordsWithJoin}/${data.length} (${percentage}%)`);
                    
                    if (recordsWithJoin === 0) {
                      console.log(`⚠️ Немає записів з ${joinField}`);
                      results.warnings++;
                    }
                  }
                }
                
                results.passedTests++;
              } else {
                console.log(`❌ Відсутні поля: ${missingFields.join(', ')}`);
                results.failedTests++;
              }
              
              // Показуємо приклад даних
              console.log(`📝 Приклад запису:`);
              console.log(JSON.stringify(firstRecord, null, 2).substring(0, 200) + '...');
              
            } else {
              console.log(`⚠️ Немає даних`);
              results.warnings++;
              results.passedTests++; // Технічно запит успішний
            }
          } else {
            console.log(`❌ Відповідь не є масивом`);
            results.failedTests++;
          }
          
        } else {
          console.log(`❌ Статус: ${response.status}`);
          results.failedTests++;
        }
        
      } catch (error) {
        console.log(`❌ Помилка: ${error.message}`);
        
        if (error.response) {
          console.log(`📄 Статус відповіді: ${error.response.status}`);
          console.log(`📄 Повідомлення: ${error.response.data?.message || 'Невідома помилка'}`);
        }
        
        results.failedTests++;
      }
    }
    
    // Тестування CRUD операцій
    console.log('\n🔧 ТЕСТУВАННЯ CRUD ОПЕРАЦІЙ');
    console.log('-'.repeat(40));
    
    // CREATE тест
    results.totalTests++;
    try {
      console.log('\n📝 Тестування CREATE операції...');
      
      const newAppointment = {
        user_id: 'b07111e6-33bf-4da1-a66f-1a2fc0c3c922',
        vehicle_vin: '1HGCM82633A123456',
        service_type: 'API Test Service',
        appointment_date: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        time: '14:00:00',
        status: 'pending'
      };
      
      const createResponse = await api.post('/rest/v1/appointments', newAppointment, {
        headers: {
          'Prefer': 'return=representation'
        }
      });
      
      if (createResponse.status === 201 && createResponse.data.length > 0) {
        const createdRecord = createResponse.data[0];
        console.log(`✅ CREATE: Створено appointment ${createdRecord.id}`);
        
        // UPDATE тест
        results.totalTests++;
        try {
          console.log('📝 Тестування UPDATE операції...');
          
          const updateResponse = await api.patch(
            `/rest/v1/appointments?id=eq.${createdRecord.id}`,
            { status: 'confirmed' },
            {
              headers: {
                'Prefer': 'return=representation'
              }
            }
          );
          
          if (updateResponse.status === 200) {
            console.log(`✅ UPDATE: Оновлено статус appointment`);
            results.passedTests++;
          } else {
            console.log(`❌ UPDATE: Статус ${updateResponse.status}`);
            results.failedTests++;
          }
        } catch (updateError) {
          console.log(`❌ UPDATE: ${updateError.message}`);
          results.failedTests++;
        }
        
        // DELETE тест
        results.totalTests++;
        try {
          console.log('📝 Тестування DELETE операції...');
          
          const deleteResponse = await api.delete(
            `/rest/v1/appointments?id=eq.${createdRecord.id}`
          );
          
          if (deleteResponse.status === 204) {
            console.log(`✅ DELETE: Видалено тестовий appointment`);
            results.passedTests++;
          } else {
            console.log(`❌ DELETE: Статус ${deleteResponse.status}`);
            results.failedTests++;
          }
        } catch (deleteError) {
          console.log(`❌ DELETE: ${deleteError.message}`);
          results.failedTests++;
        }
        
        results.passedTests++;
      } else {
        console.log(`❌ CREATE: Статус ${createResponse.status}`);
        results.failedTests++;
      }
      
    } catch (createError) {
      console.log(`❌ CREATE: ${createError.message}`);
      results.failedTests++;
    }
    
    // Фінальний звіт
    console.log('\n' + '='.repeat(60));
    console.log('📊 ФІНАЛЬНИЙ ЗВІТ API ТЕСТУВАННЯ');
    console.log('='.repeat(60));
    
    console.log(`🧪 Загальна кількість тестів: ${results.totalTests}`);
    console.log(`✅ Успішні тести: ${results.passedTests}`);
    console.log(`❌ Невдалі тести: ${results.failedTests}`);
    console.log(`⚠️ Попередження: ${results.warnings}`);
    
    const successRate = ((results.passedTests / results.totalTests) * 100).toFixed(1);
    console.log(`📈 Відсоток успішності: ${successRate}%`);
    
    if (results.failedTests === 0) {
      console.log('\n🎉 ВСІ API ТЕСТИ ПРОЙШЛИ УСПІШНО!');
      console.log('✅ API готове до використання');
    } else {
      console.log('\n⚠️ ВИЯВЛЕНО ПРОБЛЕМИ В API');
      console.log('🔧 Потрібні додаткові налаштування');
    }
    
    if (results.warnings > 0) {
      console.log(`\n💡 Рекомендації:`);
      console.log(`   - Перевірити налаштування CORS`);
      console.log(`   - Додати відсутні записи для JOIN запитів`);
      console.log(`   - Перевірити RLS політики`);
    }
    
  } catch (error) {
    console.log('❌ Критична помилка API тестування:', error.message);
  }
}

testAPIEndpoints();