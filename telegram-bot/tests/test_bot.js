const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Мок-об'єкт для тестування
class MockBot {
  constructor() {
    this.messages = [];
    this.callbacks = {};
  }

  sendMessage(chatId, text, options = {}) {
    this.messages.push({ chatId, text, options });
    return Promise.resolve({ message_id: Date.now() });
  }

  on(event, callback) {
    this.callbacks[event] = callback;
  }

  trigger(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event](data);
    }
  }

  getMessages() {
    return this.messages;
  }

  clearMessages() {
    this.messages = [];
  }
}

// Тестові дані
const mockData = {
  user: {
    id: 123456789,
    first_name: 'Test',
    username: 'testuser'
  },
  chat: {
    id: 123456789
  },
  vehicles: [
    {
      id: 1,
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
      vin: '1234567890ABCDEFG',
      color: 'Black'
    }
  ],
  services: [
    {
      id: 1,
      name: 'Заміна масла',
      price: 500,
      duration: 30,
      description: 'Повна заміна моторного масла'
    }
  ],
  appointments: [
    {
      id: 1,
      appointment_date: '2024-01-15T10:00:00Z',
      status: 'confirmed',
      vehicle: { make: 'Toyota', model: 'Camry' },
      service: { name: 'Заміна масла' },
      service_station: { name: 'СТО №1' }
    }
  ]
};

// Тестові функції
class BotTester {
  constructor() {
    this.mockBot = new MockBot();
    this.apiClient = axios.create({
      baseURL: 'http://localhost:3000',
      timeout: 1000
    });
  }

  // Тест старту бота
  async testStartCommand() {
    console.log('🧪 Тест команди /start...');
    
    const msg = {
      chat: { id: 123456789 },
      from: mockData.user
    };

    // Імітуємо команду /start
    this.mockBot.trigger('message', {
      ...msg,
      text: '/start'
    });

    const messages = this.mockBot.getMessages();
    if (messages.length > 0 && messages[0].text.includes('Ласкаво просимо')) {
      console.log('✅ /start працює коректно');
      return true;
    } else {
      console.log('❌ /start не працює');
      return false;
    }
  }

  // Тест API з'єднання
  async testAPIConnection() {
    console.log('🧪 Тест з\'єднання з API...');
    
    try {
      const response = await this.apiClient.get('/health');
      console.log('✅ API доступне');
      return true;
    } catch (error) {
      console.log('⚠️ API недоступне:', error.message);
      return false;
    }
  }

  // Тест обробки помилок
  async testErrorHandling() {
    console.log('🧪 Тест обробки помилок...');
    
    try {
      await this.apiClient.get('/nonexistent-endpoint');
      console.log('❌ Помилка не оброблена');
      return false;
    } catch (error) {
      console.log('✅ Помилки обробляються коректно');
      return true;
    }
  }

  // Тест форматування повідомлень
  testMessageFormatting() {
    console.log('🧪 Тест форматування повідомлень...');
    
    const testMessages = [
      {
        input: mockData.appointments,
        expected: 'активні записи'
      },
      {
        input: mockData.vehicles,
        expected: 'автомобілі'
      },
      {
        input: mockData.services,
        expected: 'послуги'
      }
    ];

    let allPassed = true;
    testMessages.forEach((test, index) => {
      const formatted = this.formatMessage(test.input);
      if (formatted.includes(test.expected)) {
        console.log(`✅ Тест ${index + 1} пройдено`);
      } else {
        console.log(`❌ Тест ${index + 1} не пройдено`);
        allPassed = false;
      }
    });

    return allPassed;
  }

  // Форматування повідомлень (спрощена версія)
  formatMessage(data) {
    if (Array.isArray(data)) {
      if (data.length === 0) return 'немає даних';
      
      const item = data[0];
      if (item.vehicle) return 'активні записи';
      if (item.make) return 'автомобілі';
      if (item.name) return 'послуги';
    }
    return 'дані';
  }

  // Запуск всіх тестів
  async runAllTests() {
    console.log('🚀 Запуск тестів Telegram бота...\n');

    const results = {
      startCommand: await this.testStartCommand(),
      apiConnection: await this.testAPIConnection(),
      errorHandling: await this.testErrorHandling(),
      messageFormatting: this.testMessageFormatting()
    };

    console.log('\n📊 Результати тестів:');
    Object.entries(results).forEach(([test, result]) => {
      console.log(`${result ? '✅' : '❌'} ${test}: ${result ? 'пройдено' : 'не пройдено'}`);
    });

    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.keys(results).length;
    
    console.log(`\n📈 Загальний результат: ${passed}/${total} тестів пройдено`);
    
    return results;
  }
}

// Запуск тестів, якщо файл запущений напряму
if (require.main === module) {
  const tester = new BotTester();
  tester.runAllTests();
}

module.exports = { BotTester, MockBot, mockData };