/**
 * Налаштування тестового середовища для серверних тестів
 */

// Налаштування змінних середовища для тестів
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// Глобальні моки для тестів
global.console = {
  ...console,
  // Приховуємо логи під час тестування, але залишаємо помилки
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: console.error,
};

// Налаштування таймаутів
jest.setTimeout(10000);

// Очищення моків після кожного тесту
afterEach(() => {
  jest.clearAllMocks();
});
