const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';

// Тестові дані для входу
const testUser = {
  email: 'luhobymer@gmail.com',
  password: '123456'
};

async function testAPIEndpoints() {
  console.log('🔍 Тестування API ендпоінтів...\n');
  
  let authToken = null;
  
  try {
    // 1. Тест входу
    console.log('1. Тестування входу...');
    const loginResponse = await axios.post(`${BASE_URL}/users/login`, testUser);
    console.log('✅ Вхід успішний:', loginResponse.status);
    authToken = loginResponse.data.token;
    console.log('🔑 Токен отримано\n');
  } catch (error) {
    console.log('❌ Помилка входу:', error.response?.status, error.response?.data);
    return;
  }
  
  // Заголовки з токеном
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };
  
  // 2. Тест отримання профілю користувача
  try {
    console.log('2. Тестування отримання профілю...');
    const profileResponse = await axios.get(`${BASE_URL}/users/me`, { headers });
    console.log('✅ Профіль отримано:', profileResponse.status);
    console.log('👤 Користувач:', profileResponse.data.user?.email, '\n');
  } catch (error) {
    console.log('❌ Помилка профілю:', error.response?.status, error.response?.data, '\n');
  }
  
  // 3. Тест отримання транспортних засобів
  try {
    console.log('3. Тестування отримання транспортних засобів...');
    const vehiclesResponse = await axios.get(`${BASE_URL}/vehicles`, { headers });
    console.log('✅ Транспортні засоби отримано:', vehiclesResponse.status);
    console.log('🚗 Кількість:', vehiclesResponse.data?.length || 0, '\n');
  } catch (error) {
    console.log('❌ Помилка транспортних засобів:', error.response?.status, error.response?.data, '\n');
  }
  
  // 4. Тест отримання сервісних записів
  try {
    console.log('4. Тестування отримання сервісних записів...');
    const servicesResponse = await axios.get(`${BASE_URL}/services`, { headers });
    console.log('✅ Сервісні записи отримано:', servicesResponse.status);
    console.log('🔧 Кількість:', servicesResponse.data?.length || 0, '\n');
  } catch (error) {
    console.log('❌ Помилка сервісних записів:', error.response?.status, error.response?.data, '\n');
  }
  
  // 5. Тест отримання нотифікацій
  try {
    console.log('5. Тестування отримання нотифікацій...');
    const notificationsResponse = await axios.get(`${BASE_URL}/notifications`, { headers });
    console.log('✅ Нотифікації отримано:', notificationsResponse.status);
    console.log('🔔 Кількість:', notificationsResponse.data?.length || 0, '\n');
  } catch (error) {
    console.log('❌ Помилка нотифікацій:', error.response?.status, error.response?.data, '\n');
  }
  
  // 6. Тест адмін ендпоінтів (якщо користувач адмін)
  try {
    console.log('6. Тестування адмін ендпоінтів...');
    const adminUsersResponse = await axios.get(`${BASE_URL}/admin/users`, { headers });
    console.log('✅ Адмін користувачі отримано:', adminUsersResponse.status);
    console.log('👥 Кількість користувачів:', adminUsersResponse.data?.length || 0, '\n');
  } catch (error) {
    console.log('❌ Помилка адмін користувачів:', error.response?.status, error.response?.data, '\n');
  }
  
  console.log('🏁 Тестування завершено');
}

testAPIEndpoints().catch(console.error);