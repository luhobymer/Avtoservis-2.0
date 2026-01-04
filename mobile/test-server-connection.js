const axios = require('axios');
const { axiosAuth } = require('./api/axiosConfig');

// Тестування зв'язку з сервером
async function testServerConnection() {
  console.log("🔍 Тестування зв'язку з сервером...");
  
  // Тест 1: Перевірка локального сервера
  try {
    console.log("\n📡 Тестування локального сервера на порту 5001...");
    const response = await axios.get('http://localhost:5001/api/vehicles', {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log("✅ Локальний сервер доступний:", response.status);
  } catch (error) {
    console.log("❌ Локальний сервер недоступний:", error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log("   Сервер не запущений або недоступний на порту 5001");
    }
  }
  

  
  // Тест 3: Перевірка мережевого підключення
  try {
    console.log("\n🌐 Тестування мережевого підключення...");
    const response = await axios.get('https://httpbin.org/status/200', {
      timeout: 5000
    });
    console.log("✅ Мережеве підключення працює:", response.status);
  } catch (error) {
    console.log("❌ Мережеве підключення недоступне:", error.message);
  }
  
  console.log("\n🏁 Тестування завершено.");
}

// Запуск тестування
testServerConnection().catch(console.error);