const http = require('http');

const testEndpoint = (path) => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5001,
      path,
      method: 'GET'
    };
    
    const req = http.request(options, (res) => {
      console.log(`${path}: Status ${res.statusCode}`);
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            console.log(`${path}: ✅ Success - ${Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length} items`);
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log(`${path}: Sample data keys:`, Object.keys(parsed[0]));
              // Перевіряємо чи є колонка duration в services
              if (path === '/api/services' && parsed[0].duration !== undefined) {
                console.log(`${path}: ✅ Duration column is present:`, parsed[0].duration);
              }
            }
          } catch (e) {
            console.log(`${path}: ⚠️ Success but invalid JSON:`, data.substring(0, 100));
          }
        } else if (res.statusCode === 401) {
          console.log(`${path}: 🔒 Requires authentication (expected for appointments)`);
        } else if (res.statusCode === 500) {
          console.log(`${path}: ❌ Server error - ${data}`);
        } else {
          console.log(`${path}: ⚠️ Status ${res.statusCode} - ${data}`);
        }
        resolve();
      });
    });
    
    req.on('error', (e) => {
      console.log(`${path}: ❌ Request failed - ${e.message}`);
      resolve();
    });
    
    req.end();
  });
};

async function testAPI() {
  console.log('🧪 Testing API endpoints after duration column fix...');
  console.log('=' .repeat(50));
  
  // Тестуємо /api/services (має працювати без авторизації)
  console.log('\n1. Testing /api/services:');
  await testEndpoint('/api/services');
  
  // Тестуємо /api/appointments (очікуємо 401 без токена)
  console.log('\n2. Testing /api/appointments:');
  await testEndpoint('/api/appointments');
  
  console.log('\n' + '=' .repeat(50));
  console.log('🎯 Test Summary:');
  console.log('- /api/services should return 200 with duration column');
  console.log('- /api/appointments should return 401 (auth required)');
  console.log('- No 500 errors should occur');
  console.log('\n✅ API testing completed.');
}

testAPI();