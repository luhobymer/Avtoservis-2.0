/**
 * Налаштування тестового середовища для серверних тестів
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

// Налаштування змінних середовища для тестів
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing-only';
process.env.SQLITE_DB_PATH = path.join(os.tmpdir(), `avtoservis-jest-${process.pid}.sqlite`);
process.env.SERVER_API_KEY = 'test-api-key';

// Глобальні моки для тестів
global.console = {
  ...console,
  // Приховуємо логи під час тестування, але залишаємо помилки
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: console.error.bind(console),
};

// Налаштування таймаутів
jest.setTimeout(10000);

// Очищення моків після кожного тесту
afterEach(() => {
  jest.clearAllMocks();
  try {
    const { resetDb } = require('../db/d1');
    if (typeof resetDb === 'function') resetDb();
  } catch (error) {
    console.error('[Tests] resetDb failed:', error);
  }
  try {
    const dbPath = process.env.SQLITE_DB_PATH;
    if (dbPath) {
      fs.rmSync(dbPath, { force: true });
      fs.rmSync(`${dbPath}-wal`, { force: true });
      fs.rmSync(`${dbPath}-shm`, { force: true });
    }
  } catch (error) {
    console.error('[Tests] cleanup db failed:', error);
  }
});
