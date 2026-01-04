/**
 * Базовий тест для перевірки наявності AuthContext
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve())
}));

jest.mock('../api/supabaseClient', () => {
  const auth = {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null, user: null } })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { session: null, user: null }, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
    signUp: jest.fn(() => Promise.resolve({ data: { user: { id: '1', email: 'test@example.com' } }, error: null }))
  };
  const tableApi = {
    select: jest.fn(() => ({
      eq: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: null, error: null })) }))
    })),
    insert: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: null, error: null })) })) })),
    update: jest.fn(() => ({ eq: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn(() => Promise.resolve({ data: null, error: null })) })) })) })),
    delete: jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ error: null })) })),
  };
  return { supabase: { auth, from: jest.fn(() => tableApi) } };
});

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
