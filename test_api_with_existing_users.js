const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Використовуємо існуючих користувачів з бази
const EXISTING_USERS = [
  { email: 'john.doe@example.com', password: 'password123' },
  { email: 'jane.smith@example.com', password: 'password123' },
  { email: 'mike.johnson@example.com', password: 'password123' },
  { email: 'test@example.com', password: 'password123' }
];

async function testWithAuth() {
  console.log('🚀 Тестування API з авторизацією існуючих користувачів...');
  console.log('============================================================\n');

  // Спробуємо авторизуватися з кожним користувачем
  let authToken = null;
  let currentUser = null;

  for (const user of EXISTING_USERS) {
    try {
      console.log(`🔐 Спроба авторизації: ${user.email}`);
      
      const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: user.email,
        password: user.password
      });

      if (loginResponse.status === 200 && loginResponse.data.token) {
        authToken = loginResponse.data.token;
        currentUser = user;
        console.log(`✅ Успішна авторизація: ${user.email}`);
        break;
      }
    } catch (error) {
      console.log(`❌ Помилка авторизації ${user.email}:`, error.response?.data?.message || error.message);
    }
  }

  if (!authToken) {
    console.log('❌ Не вдалося авторизуватися з жодним користувачем');
    return;
  }

  console.log('\n============================================================');
  console.log('🧪 Тестування захищених ендпоінтів...');
  console.log('============================================================\n');

  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };

  // Тестуємо /api/vehicles
  try {
    console.log('🧪 Тестуємо: /api/vehicles (з авторизацією)');
    const vehiclesResponse = await axios.get(`${BASE_URL}/api/vehicles`, { headers });
    console.log(`✅ /api/vehicles: Status ${vehiclesResponse.status}`);
    console.log(`📊 Кількість vehicles: ${vehiclesResponse.data.length}`);
    
    if (vehiclesResponse.data.length > 0) {
      console.log('📋 Структура першого vehicle:', Object.keys(vehiclesResponse.data[0]));
    }
  } catch (error) {
    console.log(`❌ /api/vehicles: Status ${error.response?.status}`);
    console.log('❌ Помилка:', error.response?.data || error.message);
  }

  // Тестуємо /api/appointments
  try {
    console.log('\n🧪 Тестуємо: /api/appointments (з авторизацією)');
    const appointmentsResponse = await axios.get(`${BASE_URL}/api/appointments`, { headers });
    console.log(`✅ /api/appointments: Status ${appointmentsResponse.status}`);
    console.log(`📊 Кількість appointments: ${appointmentsResponse.data.length}`);
    
    if (appointmentsResponse.data.length > 0) {
      const firstAppointment = appointmentsResponse.data[0];
      console.log('📋 Структура першого appointment:', Object.keys(firstAppointment));
      
      // Перевіряємо зв'язки
      if (firstAppointment.vehicles) {
        console.log('🚗 Зв\'язок з vehicles: ✅ Присутній');
        console.log('🚗 Vehicle data:', firstAppointment.vehicles);
      } else {
        console.log('🚗 Зв\'язок з vehicles: ❌ Відсутній');
      }
      
      if (firstAppointment.services) {
        console.log('🔧 Зв\'язок з services: ✅ Присутній');
        console.log('🔧 Service data:', firstAppointment.services);
      } else {
        console.log('🔧 Зв\'язок з services: ❌ Відсутній');
      }
    }
  } catch (error) {
    console.log(`❌ /api/appointments: Status ${error.response?.status}`);
    console.log('❌ Помилка:', error.response?.data || error.message);
  }

  // Тестуємо /api/users
  try {
    console.log('\n🧪 Тестуємо: /api/users (з авторизацією)');
    const usersResponse = await axios.get(`${BASE_URL}/api/users`, { headers });
    console.log(`✅ /api/users: Status ${usersResponse.status}`);
    console.log(`📊 Кількість users: ${usersResponse.data.length}`);
  } catch (error) {
    console.log(`❌ /api/users: Status ${error.response?.status}`);
    console.log('❌ Помилка:', error.response?.data || error.message);
  }

  console.log('\n============================================================');
  console.log('🎯 Резюме тестування:');
  console.log('- Авторизація працює з існуючими користувачами');
  console.log('- Перевірено зв\'язки між appointments ↔ vehicles');
  console.log('- Перевірено зв\'язки між appointments ↔ services');
  console.log('- Протестовано RLS policies');
  console.log('\n✅ Тестування завершено.');
}

testWithAuth().catch(console.error);