/**
 * Детальний тест для middleware/auth.js
 * Покриває всі сценарії автентифікації
 */

const authMiddleware = require('../middleware/auth');
const { JWT_SECRET } = require('../config/jwt');

jest.mock('jsonwebtoken');

describe('Auth Middleware - Детальне тестування', () => {
  let req, res, next;
  let mockJwt;

  beforeEach(() => {
    // Налаштовуємо моки для кожного тесту
    req = {
      header: jest.fn(),
      user: null,
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();

    mockJwt = require('jsonwebtoken');

    // Очищуємо всі моки
    jest.clearAllMocks();
  });

  describe('Успішна автентифікація', () => {
    test('повинен успішно автентифікувати з x-auth-token заголовком', async () => {
      const validToken = 'valid.jwt.token';
      const decodedPayload = {
        id: 1,
        email: 'test@example.com',
        role: 'client',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      req.header.mockImplementation((headerName) => {
        if (headerName === 'x-auth-token') return validToken;
        return null;
      });

      mockJwt.verify.mockReturnValue(decodedPayload);

      await authMiddleware(req, res, next);

      expect(mockJwt.verify).toHaveBeenCalledWith(validToken, JWT_SECRET);
      expect(req.user).toEqual(decodedPayload);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('повинен успішно автентифікувати з Authorization Bearer заголовком', async () => {
      const validToken = 'valid.jwt.token';
      const decodedPayload = {
        id: 2,
        email: 'admin@example.com',
        role: 'admin',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      req.header.mockImplementation((headerName) => {
        if (headerName === 'x-auth-token') return null;
        if (headerName === 'Authorization') return `Bearer ${validToken}`;
        return null;
      });

      mockJwt.verify.mockReturnValue(decodedPayload);

      await authMiddleware(req, res, next);

      expect(mockJwt.verify).toHaveBeenCalledWith(validToken, JWT_SECRET);
      expect(req.user).toEqual(decodedPayload);
      expect(next).toHaveBeenCalled();
    });

    test('повинен пріоритизувати x-auth-token над Authorization', async () => {
      const xAuthToken = 'x-auth.jwt.token';
      const bearerToken = 'bearer.jwt.token';
      const decodedPayload = {
        id: 3,
        email: 'master@example.com',
        role: 'master',
      };

      req.header.mockImplementation((headerName) => {
        if (headerName === 'x-auth-token') return xAuthToken;
        if (headerName === 'Authorization') return `Bearer ${bearerToken}`;
        return null;
      });

      mockJwt.verify.mockReturnValue(decodedPayload);

      await authMiddleware(req, res, next);

      expect(mockJwt.verify).toHaveBeenCalledWith(xAuthToken, JWT_SECRET);
      expect(req.user).toEqual(decodedPayload);
    });
  });

  describe('Помилки відсутності токена', () => {
    test('повинен повертати 401 якщо немає токена', async () => {
      req.header.mockReturnValue(null);

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'NO_TOKEN',
        message: 'Немає токена, доступ заборонено',
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('повинен повертати 401 для порожнього Authorization заголовка', async () => {
      req.header.mockImplementation((headerName) => {
        if (headerName === 'x-auth-token') return null;
        if (headerName === 'Authorization') return '';
        return null;
      });

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'NO_TOKEN',
        message: 'Немає токена, доступ заборонено',
      });
    });

    test('повинен повертати 401 для Authorization без Bearer', async () => {
      req.header.mockImplementation((headerName) => {
        if (headerName === 'x-auth-token') return null;
        if (headerName === 'Authorization') return 'Basic dGVzdA==';
        return null;
      });

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'NO_TOKEN',
        message: 'Немає токена, доступ заборонено',
      });
    });
  });

  describe('Помилки формату токена', () => {
    test('повинен повертати 401 для токена з неправильним форматом', async () => {
      const invalidToken = 'invalid.token'; // Тільки 2 частини замість 3

      req.header.mockImplementation((headerName) => {
        if (headerName === 'x-auth-token') return invalidToken;
        return null;
      });

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'INVALID_TOKEN_FORMAT',
        message: 'Недійсний формат токена',
      });
      expect(mockJwt.verify).not.toHaveBeenCalled();
    });

    test('повинен повертати 401 для токена з однією частиною', async () => {
      const invalidToken = 'invalidtoken';

      req.header.mockReturnValue(invalidToken);

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'INVALID_TOKEN_FORMAT',
        message: 'Недійсний формат токена',
      });
    });

    test('повинен повертати 401 для порожнього токена', async () => {
      req.header.mockReturnValue('');

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'NO_TOKEN',
        message: 'Немає токена, доступ заборонено',
      });
    });
  });

  describe('Помилки JWT верифікації', () => {
    test('повинен обробляти прострочений токен', async () => {
      const expiredToken = 'expired.jwt.token';
      const expiredError = new Error('jwt expired');
      expiredError.name = 'TokenExpiredError';
      expiredError.expiredAt = new Date();

      req.header.mockReturnValue(expiredToken);
      mockJwt.verify.mockImplementation(() => {
        throw expiredError;
      });

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'TOKEN_EXPIRED',
        message: 'Термін дії токена закінчився',
      });
    });

    test('повинен обробляти недійсний підпис токена', async () => {
      const invalidToken = 'invalid.signature.token';
      const signatureError = new Error('invalid signature');
      signatureError.name = 'JsonWebTokenError';

      req.header.mockReturnValue(invalidToken);
      mockJwt.verify.mockImplementation(() => {
        throw signatureError;
      });

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'INVALID_SIGNATURE',
        message: 'Недійсний підпис токена',
      });
    });

    test('повинен обробляти загальні помилки JWT', async () => {
      const malformedToken = 'malformed.jwt.token';
      const jwtError = new Error('jwt malformed');
      jwtError.name = 'JsonWebTokenError';

      req.header.mockReturnValue(malformedToken);
      mockJwt.verify.mockImplementation(() => {
        throw jwtError;
      });

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'INVALID_SIGNATURE',
        message: 'Недійсний підпис токена',
      });
    });

    test('повинен обробляти інші типи помилок JWT', async () => {
      const invalidToken = 'some.invalid.token';
      const unknownError = new Error('unknown jwt error');
      unknownError.name = 'UnknownJWTError';

      req.header.mockReturnValue(invalidToken);
      mockJwt.verify.mockImplementation(() => {
        throw unknownError;
      });

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'INVALID_TOKEN',
        message: 'Токен недійсний',
      });
    });
  });

  describe('Валідація payload токена', () => {
    test('повинен повертати 401 якщо токен не містить id', async () => {
      const validToken = 'valid.format.token';
      const invalidPayload = {
        email: 'test@example.com',
        role: 'client',
        // id відсутній
      };

      req.header.mockReturnValue(validToken);
      mockJwt.verify.mockReturnValue(invalidPayload);

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'INVALID_TOKEN_PAYLOAD',
        message: 'Токен не містить необхідних даних',
      });
    });

    test('повинен повертати 401 якщо токен не містить ні email, ні phone', async () => {
      const validToken = 'valid.format.token';
      const invalidPayload = {
        id: 1,
        role: 'client',
        // ні email, ні phone не присутні
      };

      req.header.mockReturnValue(validToken);
      mockJwt.verify.mockReturnValue(invalidPayload);

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'INVALID_TOKEN_PAYLOAD',
        message: 'Токен не містить необхідних даних',
      });
    });

    test('повинен успішно автентифікувати з токеном, що містить phone замість email', async () => {
      const validToken = 'valid.format.token';
      const phonePayload = {
        id: 1,
        phone: '+380501234567',
        role: 'client',
      };

      req.header.mockReturnValue(validToken);
      mockJwt.verify.mockReturnValue(phonePayload);

      await authMiddleware(req, res, next);

      expect(req.user).toEqual(phonePayload);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('повинен повертати 401 якщо токен не містить id та ні email, ні phone', async () => {
      const validToken = 'valid.format.token';
      const invalidPayload = {
        role: 'client',
        iat: Math.floor(Date.now() / 1000),
      };

      req.header.mockReturnValue(validToken);
      mockJwt.verify.mockReturnValue(invalidPayload);

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'INVALID_TOKEN_PAYLOAD',
        message: 'Токен не містить необхідних даних',
      });
    });

    test('повинен приймати токен з мінімальними необхідними полями (email)', async () => {
      const validToken = 'valid.format.token';
      const minimalPayload = {
        id: 1,
        email: 'test@example.com',
        // role не обов'язковий
      };

      req.header.mockReturnValue(validToken);
      mockJwt.verify.mockReturnValue(minimalPayload);

      await authMiddleware(req, res, next);

      expect(req.user).toEqual(minimalPayload);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('повинен приймати токен з мінімальними необхідними полями (phone)', async () => {
      const validToken = 'valid.format.token';
      const minimalPayload = {
        id: 1,
        phone: '+380501234567',
        // role не обов'язковий
      };

      req.header.mockReturnValue(validToken);
      mockJwt.verify.mockReturnValue(minimalPayload);

      await authMiddleware(req, res, next);

      expect(req.user).toEqual(minimalPayload);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Обробка серверних помилок', () => {
    test('повинен повертати 500 при неочікуваній помилці', async () => {
      req.header.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'SERVER_ERROR',
        message: 'Помилка сервера при перевірці автентифікації',
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('повинен обробляти помилки при отриманні заголовків', async () => {
      req.header.mockImplementation(() => {
        throw new Error('Header access error');
      });

      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'SERVER_ERROR',
        message: 'Помилка сервера при перевірці автентифікації',
      });
    });
  });

  describe('Різні сценарії токенів', () => {
    test('повинен обробляти токен з додатковими полями', async () => {
      const validToken = 'valid.format.token';
      const extendedPayload = {
        id: 1,
        email: 'test@example.com',
        role: 'admin',
        name: 'Test User',
        permissions: ['read', 'write'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      req.header.mockReturnValue(validToken);
      mockJwt.verify.mockReturnValue(extendedPayload);

      await authMiddleware(req, res, next);

      expect(req.user).toEqual(extendedPayload);
      expect(next).toHaveBeenCalled();
    });

    test('повинен обробляти токен з нульовими значеннями', async () => {
      const validToken = 'valid.format.token';
      const payloadWithNulls = {
        id: 1,
        email: 'test@example.com',
        role: null,
        name: null,
      };

      req.header.mockReturnValue(validToken);
      mockJwt.verify.mockReturnValue(payloadWithNulls);

      await authMiddleware(req, res, next);

      expect(req.user).toEqual(payloadWithNulls);
      expect(next).toHaveBeenCalled();
    });
  });
});
