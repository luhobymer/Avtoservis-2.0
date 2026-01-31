/**
 * Базовий тест для перевірки наявності AuthContext
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve())
}));

// Supabase більше не використовується в AuthContext

describe('AuthContext - базова перевірка', () => {
  test('AuthContext повинен бути визначений', () => {
    const AuthContext = require('../context/AuthContext');
    expect(AuthContext).toBeDefined();
  });

  test('AuthContext повинен експортувати AuthProvider та useAuth', () => {
    const AuthContext = require('../context/AuthContext');
    expect(AuthContext.AuthProvider).toBeDefined();
    expect(AuthContext.useAuth).toBeDefined();
  });
});
