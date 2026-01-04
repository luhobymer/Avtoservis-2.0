/**
 * Конфігурація Jest для тестування AuthContext
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/mobile/tests/auth-context-commonjs.test.js'
  ],
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: ['babel-preset-expo'],
      plugins: [
        '@babel/plugin-transform-flow-strip-types',
        ['@babel/plugin-proposal-class-properties', { loose: true }],
        ['@babel/plugin-transform-private-methods', { loose: true }],
        ['@babel/plugin-transform-private-property-in-object', { loose: true }],
        '@babel/plugin-transform-react-jsx'
      ]
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-vector-icons|@react-native-async-storage)/)',
  ],
  moduleFileExtensions: ['js', 'jsx', 'json'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$': '<rootDir>/node_modules/@react-native-async-storage/async-storage/lib/commonjs/index.js'
  }
};