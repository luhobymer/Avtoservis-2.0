// Базові моки для React Native тестування

// Мок для AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Мок для jwt-decode
jest.mock('jwt-decode', () => {
  const jwtDecodeFunction = jest.fn((token) => {
    try {
      if (!token || typeof token !== 'string') {
        throw new Error('Invalid token');
      }
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }
      const payload = JSON.parse(atob(parts[1]));
      return payload;
    } catch {
      throw new Error('Invalid token');
    }
  });

  return {
    __esModule: true,
    default: jwtDecodeFunction,
    jwtDecode: jwtDecodeFunction
  };
});

// Мок для React Native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios || obj.default)
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 667 }))
  },
  Alert: {
    alert: jest.fn()
  }
}));

// Мок для axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  })),
  get: jest.fn(),
  post: jest.fn()
}));

// Мок для axiosConfig
jest.mock('../api/axiosConfig', () => {
  const isTokenValidMock = (token) => {
    try {
      if (!token || typeof token !== 'string') {
        return false;
      }
      
      const parts = token.split('.');
      if (parts.length !== 3) {
        return false;
      }
      
      const payload = JSON.parse(atob(parts[1]));
      
      if (!payload.exp) {
        return false;
      }
      
      const currentTime = Math.floor(Date.now() / 1000);
      const expTime = typeof payload.exp === 'string' ? parseInt(payload.exp) : payload.exp;
      return expTime > currentTime;
    } catch (error) {
      return false;
    }
  };


  const axiosInstanceMock = {
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() }
    }
  };

  const realAxiosConfig = jest.requireActual('../api/axiosConfig');
  return {
    __esModule: true,
    isTokenValid: isTokenValidMock,
    clearAuthData: realAxiosConfig.clearAuthData,
    default: axiosInstanceMock
  };
});

// Глобальні налаштування
global.fetch = jest.fn();
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Очищення після кожного тесту
afterEach(() => {
  jest.clearAllMocks();
});
