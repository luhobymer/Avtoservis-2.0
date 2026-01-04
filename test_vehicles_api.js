const http = require('http');

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testVehiclesAPI() {
  try {
    console.log('🔐 Спроба логіну...');
    
    // Спочатку логінимося
    const loginOptions = {
      hostname: 'localhost',
      port: 5001,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const loginResponse = await makeRequest(loginOptions, {
      email: 'admin@avtoservis.com',
      password: 'admin123'
    });
    
    if (loginResponse.status !== 200) {
      console.error('❌ Помилка логіну:', loginResponse.data);
      return;
    }
    
    console.log('✅ Логін успішний');
    const token = loginResponse.data.token;
    
    // Тестуємо API vehicles
    console.log('🚗 Тестування API vehicles...');
    
    const vehiclesOptions = {
        hostname: 'localhost',
        port: 5001,
      path: '/api/vehicles',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    const vehiclesResponse = await makeRequest(vehiclesOptions);
    
    if (vehiclesResponse.status === 200) {
      console.log('✅ API vehicles працює успішно');
      console.log('Отримані дані:', vehiclesResponse.data);
    } else {
      console.error('❌ Помилка API vehicles:', vehiclesResponse.data);
      console.error('Статус:', vehiclesResponse.status);
    }
    
  } catch (error) {
    console.error('❌ Помилка:', error.message);
  }
}

testVehiclesAPI();