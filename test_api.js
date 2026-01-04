const http = require('http');

const testEndpoint = (path) => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
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
            console.log(`${path}: Success - ${Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length} items`);
            console.log(`${path}: First item:`, JSON.stringify(parsed[0] || parsed, null, 2));
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
  console.log('Testing API endpoints...');
  
  await testEndpoint('/api/services');
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await testEndpoint('/api/appointments');
  
  console.log('API testing completed.');
}

testAPI();