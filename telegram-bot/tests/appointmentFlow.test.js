const AppointmentFlow = require('../src/appointmentFlow');

// Мокаємо userManager, щоб контролювати автентифікацію та токени
jest.mock('../src/userManager', () => ({
  getUser: jest.fn(),
}));

const userManager = require('../src/userManager');

class MockBot {
  constructor() {
    this.messages = [];
  }
  async sendMessage(chatId, text, options = {}) {
    this.messages.push({ chatId, text, options });
    return { message_id: Date.now() };
  }
  lastMessage() {
    return this.messages[this.messages.length - 1];
  }
  clear() {
    this.messages = [];
  }
}

// Утиліта створення мок-API клієнта
function createMockApi(overrides = {}) {
  return {
    get: jest.fn(async (url) => {
      if (url === '/api/telegram/services') {
        return { data: [ { id: 1, name: 'Заміна масла', price: 500, duration: 30 } ] };
      }
      if (url === '/api/telegram/stations') {
        return { data: [ { id: 10, name: 'СТО №1' } ] };
      }
      if (url === '/api/mechanics' || url === '/api/mechanics/') {
        return { data: [ { id: 100, first_name: 'Іван', last_name: 'Майстер', specialization: 'Діагностика', service_station_id: 10 } ] };
      }
      if (url === '/api/vehicles') {
        return { data: [ { id: 7, make: 'Toyota', model: 'Camry', year: 2020, vin: 'VINVINVINVINVIN1', license_plate: 'AA1234BB' } ] };
      }
      return { data: {} };
    }),
    post: jest.fn(async (url, body) => {
      if (url === '/api/telegram/appointments') {
        return { data: { id: 999, ...body } };
      }
      return { data: {} };
    }),
    ...overrides,
  };
}

describe('AppointmentFlow', () => {
  let bot;
  let api;
  let flow;
  const chatId = 12345;

  beforeEach(() => {
    bot = new MockBot();
    api = createMockApi();
    flow = new AppointmentFlow(bot, api);
    jest.clearAllMocks();
  });

  test('показує вимогу авторизації, якщо користувач не звʼязаний', async () => {
    userManager.getUser.mockResolvedValueOnce({ isLinkedToServer: () => false, isTokenExpired: () => true });

    await flow.startFlow(chatId);

    expect(bot.messages.length).toBeGreaterThan(0);
    expect(bot.lastMessage().text).toContain('авторизуватися');
  });

  test('щасливий шлях бронювання з попередньо вибраним VIN', async () => {
    // Користувач авторизований і токен дійсний
    userManager.getUser.mockResolvedValue({
      isLinkedToServer: () => true,
      isTokenExpired: () => false,
      serverUserId: 555,
      token: 'token123'
    });

    // Старт потоку з VIN -> має відразу показати вибір послуги
    await flow.startFlow(chatId, 'VINVINVINVINVIN1');
    expect(bot.lastMessage().text).toContain('Оберіть послугу');

    // Обираємо послугу (1.)
    await flow.handleMessage(chatId, '1. Заміна масла (500 грн)');
    expect(bot.lastMessage().text).toContain('Оберіть станцію обслуговування');

    // Обираємо станцію (1.) → має підвантажити механіків і показати вибір
    await flow.handleMessage(chatId, '1. СТО №1');
    expect(bot.lastMessage().text).toContain('Оберіть механіка');

    // Обираємо механіка (1.) → вибір дати
    await flow.handleMessage(chatId, '1. Іван Майстер (Діагностика)');
    expect(bot.lastMessage().text).toContain('Оберіть дату');

    // Обираємо дату (імітуємо формат, який генерує showDateSelection, напр. "пн, 25 гру")
    // Щоб не залежати від конкретного дня тижня, підставимо правильний формат
    const anyDateText = 'пн, 25 гру';
    await flow.handleDateSelection(chatId, anyDateText, flow.flows.get(chatId));
    expect(bot.lastMessage().text).toContain('Оберіть час');

    // Обираємо час
    await flow.handleMessage(chatId, '10:00');
    expect(bot.lastMessage().text).toContain('Додаткові примітки');

    // Додаємо примітки та підтверджуємо
    await flow.handleMessage(chatId, 'Примітка тест');
    expect(bot.lastMessage().text).toContain('Підтвердження запису');

    // Підтверджуємо
    await flow.handleMessage(chatId, '✅ Підтвердити');
    // Очікуємо повідомлення про успіх
    const successMessage = bot.messages.find(m => m.text && m.text.includes('Запис успішно створено'));
    expect(successMessage).toBeTruthy();

    // Перевіряємо, що викликано POST на створення запису
    expect(api.post).toHaveBeenCalledWith(
      '/api/telegram/appointments',
      expect.objectContaining({ user_id: 555 }),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token123' }) })
    );
  });

  test('handleError відправляє читабельне повідомлення та очищує стан', async () => {
    userManager.getUser.mockResolvedValue({
      isLinkedToServer: () => true,
      isTokenExpired: () => false,
      serverUserId: 555,
      token: 'token123'
    });

    // Ламаємо API get('/api/telegram/services')
    const errorApi = createMockApi({
      get: jest.fn(async (url) => {
        if (url === '/api/vehicles') {
          return { data: [ { id: 7, make: 'Toyota', model: 'Camry', year: 2020, vin: 'VINVINVINVINVIN1', license_plate: 'AA1234BB' } ] };
        }
        if (url === '/api/telegram/services') {
          const err = new Error('boom');
          err.response = { status: 500, data: { message: 'Internal' } };
          throw err;
        }
        return { data: [] };
      })
    });

    const flowWithError = new AppointmentFlow(bot, errorApi);

    await flowWithError.startFlow(chatId);

    const errorMsg = bot.messages.find(m => m.text && m.text.includes('Помилка'));
    expect(errorMsg).toBeTruthy();
    expect(flowWithError.isActive(chatId)).toBe(false);
  });
});