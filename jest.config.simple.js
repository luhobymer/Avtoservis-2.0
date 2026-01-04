/**
 * Спрощена конфігурація Jest для запуску базових тестів
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/mobile/tests/simple.test.js',
    '<rootDir>/mobile/tests/auth-context-minimal.test.js',
    '<rootDir>/mobile/tests/auth-context-commonjs.test.js'
  ],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-vector-icons|@react-native-async-storage)/)',
  ],
  moduleFileExtensions: ['js', 'jsx', 'json'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};