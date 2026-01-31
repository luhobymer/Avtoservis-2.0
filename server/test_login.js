const axios = require('axios');

async function testLogin() {
  try {
    console.log('Тестування входу в систему...');

    const response = await axios.post('http://localhost:5001/api/users/login', {
      email: 'luhobymer@gmail.com',
      password: '123456',
    });

    console.log('Успішний вхід!');
    console.log('Статус:', response.status);
    console.log('Дані:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Помилка входу:');
    console.error('Статус:', error.response?.status);
    console.error('Дані:', error.response?.data);
    console.error('Повідомлення:', error.message);
  }
}

testLogin();
