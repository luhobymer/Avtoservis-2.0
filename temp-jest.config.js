module.exports = {
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)'
  ],
  testEnvironment: 'node',
  setupFiles: ['./setup.js.temp'],
  moduleNameMapper: {
    '^../context/AuthContext$': '<rootDir>/mobile/context/AuthContext.js.temp',
    '^../api/axiosConfig$': '<rootDir>/mobile/api/axiosConfig.js.temp'
  }
}