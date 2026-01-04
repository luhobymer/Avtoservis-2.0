/**
 * Конфігурація Jest для тестування серверної частини
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/server/tests/**/*.test.js'
  ],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  moduleFileExtensions: ['js', 'jsx', 'json'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  setupFilesAfterEnv: ['<rootDir>/server/tests/setup.js'],
  testTimeout: 10000,
  verbose: true,
  moduleNameMapper: {
    '^../config/supabaseClient.js$': '<rootDir>/server/__mocks__/supabaseClient.js'
  }
};