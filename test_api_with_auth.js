const http = require('http');

// Функція для логіну та отримання токена
const login = () => {
  return new Promise((resolve, reject) => {
    const loginData = JSON.stringify({
      email: 'admin@example.com',
      password: 'admin123'
    });
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            console.log('Login successful, token obtained');
            resolve(parsed.token);
          } catch (e) {
            reject(new Error('Invalid login response'));
          }
        } else {
          console.log('Login failed:', data);
          reject(new Error('Login failed'));
        }
      });
    });
    
    req.on('error', reject);
    req.write(loginData);
    req.end();
  });
};

const testEndpoint = (path, token = null) => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'GET',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    };
    
    const req = http.request(options, (res) => {
      console.log(`${path}: Status ${res.statusCode}`);
      let data = '';
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            console.log(`${path}: Success - ${Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length} items`);
            if (Array.isArray(parsed) && parsed.length > 0) {
              console.log(`${path}: First item keys:`, Object.keys(parsed[0]));
            }
          } catch (e) {
            console.log(`${path}: Success but invalid JSON:`, data.substring(0, 200));
          }
        } else {
          console.log(`${path}: Error - ${data}`);
        }
        resolve();
      });
    });
    
    req.on('error', (e) => {
      console.log(`${path}: Request failed - ${e.message}`);
      resolve();
    });
    
    req.end();
  });
};

async function testAPI() {
  console.log('Testing API endpoints with authentication...');
  
  try {
    // Тестуємо /api/services (без авторизації)
    console.log('\n1. Testing /api/services (no auth required):');
    await testEndpoint('/api/services');
    
    // Логінимося
    console.log('\n2. Logging in...');
    const token = await login();
    
    // Тестуємо /api/appointments (з авторизацією)
    console.log('\n3. Testing /api/appointments (with auth):');
    await testEndpoint('/api/appointments', token);
    
  } catch (error) {
    console.log('Error during testing:', error.message);
  }
  
  console.log('\nAPI testing completed.');
}

testAPI();