const http = require('http');

// Функція для виконання HTTP запитів
const makeRequest = (options, data = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = res.statusCode === 200 ? JSON.parse(body) : body;
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
};

// Функція для логіну та отримання токена
const login = async () => {
  try {
    const response = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      role: 'client'
    });
    
    if (response.status === 201 || response.status === 200) {
      console.log('✅ Користувач створений/існує');
      
      // Тепер логінимося
      const loginResponse = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        email: 'test@example.com',
        password: 'password123'
      });
      
      if (loginResponse.status === 200) {
        console.log('✅ Логін успішний');
        return loginResponse.data.token;
      } else {
        console.log('❌ Помилка логіну:', loginResponse.data);
        return null;
      }
    } else {
      console.log('❌ Помилка реєстрації:', response.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Помилка авторизації:', error.message);
    return null;
  }
};

// Функція для тестування ендпоінту
const testEndpoint = async (path, token = null, description = '') => {
  try {
    console.log(`\n🧪 Тестуємо: ${path} ${description}`);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'GET',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    };
    
    const response = await makeRequest(options);
    
    if (response.status === 200) {
      const data = response.data;
      console.log(`✅ ${path}: Success - ${Array.isArray(data) ? data.length : 'object'} items`);
      
      if (Array.isArray(data) && data.length > 0) {
        console.log(`📋 Структура першого елемента:`, Object.keys(data[0]));
        
        // Перевіряємо наявність зв'язків
        if (data[0].vehicles) {
          console.log(`🚗 Зв'язок з vehicles: ✅ Присутній`);
          console.log(`🚗 Vehicle data:`, data[0].vehicles);
        } else if (data[0].vehicle_id) {
          console.log(`🚗 Vehicle ID: ${data[0].vehicle_id}`);
        }
        
        if (data[0].services) {
          console.log(`🔧 Зв'язок з services: ✅ Присутній`);
          console.log(`🔧 Service data:`, data[0].services);
        }
        
        if (data[0].service_stations) {
          console.log(`🏢 Зв'язок з service_stations: ✅ Присутній`);
        }
      }
    } else if (response.status === 401) {
      console.log(`🔒 ${path}: Потребує авторизації (очікувано)`);
    } else if (response.status === 500) {
      console.log(`❌ ${path}: Помилка сервера - ${response.data}`);
    } else {
      console.log(`⚠️ ${path}: Status ${response.status} - ${response.data}`);
    }
    
    return response;
  } catch (error) {
    console.log(`❌ ${path}: Помилка запиту - ${error.message}`);
    return null;
  }
};

async function runTests() {
  console.log('🚀 Тестування API після виправлення зв\'язків...');
  console.log('=' .repeat(60));
  
  // 1. Тестуємо services (без авторизації)
  await testEndpoint('/api/services', null, '(без авторизації)');
  
  // 2. Спробуємо авторизуватися
  console.log('\n🔐 Спроба авторизації...');
  const token = await login();
  
  if (token) {
    // 3. Тестуємо appointments з авторизацією
    await testEndpoint('/api/appointments', token, '(з авторизацією)');
    
    // 4. Тестуємо vehicles з авторизацією
    await testEndpoint('/api/vehicles', token, '(з авторизацією)');
    
    // 5. Тестуємо users з авторизацією
    await testEndpoint('/api/users', token, '(з авторизацією)');
  } else {
    console.log('\n❌ Не вдалося авторизуватися, тестуємо тільки публічні ендпоінти');
    
    // Тестуємо appointments без авторизації (очікуємо 401)
    await testEndpoint('/api/appointments', null, '(без авторизації - очікуємо 401)');
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('🎯 Резюме тестування:');
  console.log('- /api/services має працювати без авторизації');
  console.log('- /api/appointments має показувати зв\'язки з vehicles та services');
  console.log('- Не повинно бути помилок 500');
  console.log('- JOIN запити мають працювати коректно');
  console.log('\n✅ Тестування завершено.');
}

runTests().catch(console.error);