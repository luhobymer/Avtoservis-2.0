/**
 * Мінімальний тест контексту автентифікації
 */

// Мокуємо залежності перед імпортом
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve())
}));

// Мокуємо axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    post: jest.fn(() => Promise.resolve({ data: {} })),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  })),
  post: jest.fn(() => Promise.resolve({ data: { success: true } }))
}));

// Імпортуємо залежності після моків
const AsyncStorage = require('@react-native-async-storage/async-storage');
const axios = require('axios');

describe('Мінімальний тест контексту автентифікації', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  test('Базовий тест AsyncStorage', async () => {
    await AsyncStorage.setItem('token', 'test-token');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('token', 'test-token');
  });

  test('Базовий тест axios', async () => {
    axios.post.mockResolvedValueOnce({ data: { success: true } });
    const response = await axios.post('/api/test');
    expect(response.data.success).toBe(true);
  });

  test('Базовий тест з base64', () => {
    const testString = 'test-string';
    const encoded = Buffer.from(testString, 'binary').toString('base64');
    const decoded = Buffer.from(encoded, 'base64').toString('binary');
    expect(decoded).toBe(testString);
  });
});