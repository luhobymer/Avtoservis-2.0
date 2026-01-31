/**
 * Детальний тест для authController.js
 * Покриває основні сценарії автентифікації на D1/SQLite
 */

jest.mock('bcryptjs');
jest.mock('speakeasy');
jest.mock('qrcode');
jest.mock('../config/jwt');

const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const authController = require('../controllers/authController');
const { getDb } = require('../db/d1');
const { generateTokenPair, verifyRefreshToken } = require('../config/jwt');

describe('AuthController - D1 інтеграційні тести', () => {
  let req;
  let res;

  const makeRes = () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    response.status.mockReturnValue(response);
    return response;
  };

  beforeEach(() => {
    req = {
      body: {},
      user: null,
    };
    res = makeRes();
    jest.clearAllMocks();
  });

  describe('login', () => {
    test('повинен вимагати облікові дані', async () => {
      req.body = {};

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          code: 'MISSING_CREDENTIALS',
        })
      );
    });

    test('повинен повертати помилку якщо користувача не знайдено', async () => {
      req.body = {
        email: 'nonexistent@example.com',
        password: 'password',
      };

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          code: 'INVALID_CREDENTIALS',
        })
      );
    });

    test('повинен повертати помилку для невірного пароля', async () => {
      const db = getDb();
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(
        'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(userId, 'test@example.com', 'hashed', 'client', now, now);

      req.body = {
        email: 'test@example.com',
        password: 'wrong',
      };

      bcrypt.compare.mockResolvedValue(false);

      await authController.login(req, res);

      expect(bcrypt.compare).toHaveBeenCalledWith('wrong', 'hashed');
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          code: 'INVALID_CREDENTIALS',
        })
      );
    });

    test('повинен вимагати 2FA коли воно ввімкнене', async () => {
      const db = getDb();
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(
        'INSERT INTO users (id, email, password, role, two_factor_enabled, two_factor_secret, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(userId, 'test@example.com', 'hashed', 'admin', 1, 'SECRET', now, now);

      req.body = {
        email: 'test@example.com',
        password: 'plain',
      };

      bcrypt.compare.mockResolvedValue(true);

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          code: 'TWO_FACTOR_REQUIRED',
          requireTwoFactor: true,
        })
      );
    });

    test('повинен повертати помилку для невірного 2FA коду', async () => {
      const db = getDb();
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(
        'INSERT INTO users (id, email, password, role, two_factor_enabled, two_factor_secret, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(userId, 'test@example.com', 'hashed', 'admin', 1, 'SECRET', now, now);

      req.body = {
        email: 'test@example.com',
        password: 'plain',
        token2fa: '000000',
      };

      bcrypt.compare.mockResolvedValue(true);
      speakeasy.totp.verify.mockReturnValue(false);

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          code: 'INVALID_2FA_TOKEN',
        })
      );
    });

    test('повинен успішно виконувати вхід з валідним 2FA кодом', async () => {
      const db = getDb();
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(
        'INSERT INTO users (id, email, password, role, two_factor_enabled, two_factor_secret, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(userId, 'test@example.com', 'hashed', 'admin', 1, 'SECRET', now, now);

      req.body = {
        email: 'test@example.com',
        password: 'plain',
        token2fa: '123456',
      };

      const tokenPair = {
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 3600,
      };

      bcrypt.compare.mockResolvedValue(true);
      speakeasy.totp.verify.mockReturnValue(true);
      generateTokenPair.mockReturnValue(tokenPair);
      verifyRefreshToken.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 });

      await authController.login(req, res);

      expect(speakeasy.totp.verify).toHaveBeenCalledWith(
        expect.objectContaining({
          secret: 'SECRET',
          token: '123456',
        })
      );
      expect(generateTokenPair).toHaveBeenCalledWith(userId, 'admin', 'test@example.com');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          token: 'access',
          refresh_token: 'refresh',
        })
      );
    });
  });

  describe('register', () => {
    test('повинен реєструвати нового користувача по email', async () => {
      const now = new Date().toISOString();
      const salt = 'salt';
      const hashed = 'hashedPassword';
      const tokenPair = {
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 3600,
      };

      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'client',
      };

      bcrypt.genSalt.mockResolvedValue(salt);
      bcrypt.hash.mockResolvedValue(hashed);
      generateTokenPair.mockReturnValue(tokenPair);
      verifyRefreshToken.mockReturnValue({
        exp: Math.floor(new Date(now).getTime() / 1000) + 3600,
      });

      await authController.register(req, res);

      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', salt);
      expect(generateTokenPair).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          user: expect.objectContaining({
            email: 'test@example.com',
            role: 'client',
          }),
        })
      );
    });

    test('повинен повертати помилку якщо користувач вже існує', async () => {
      const db = getDb();
      const existingId = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(
        'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(existingId, 'existing@example.com', 'hashed', 'client', now, now);

      req.body = {
        email: 'existing@example.com',
        password: 'password123',
      };

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
        })
      );
    });
  });

  describe('refreshToken', () => {
    test('повинен успішно оновлювати токен', async () => {
      const db = getDb();
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();
      const oldToken = 'valid_refresh';
      const newPair = {
        accessToken: 'new_access',
        refreshToken: 'new_refresh',
        expiresIn: 3600,
      };

      db.prepare(
        'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(userId, 'test@example.com', 'hashed', 'client', now, now);

      db.prepare(
        'INSERT INTO refresh_tokens (id, user_id, token, expires_at, is_revoked, created_at) VALUES (?, ?, ?, ?, 0, ?)'
      ).run(
        crypto.randomUUID(),
        userId,
        oldToken,
        new Date(Date.now() + 3600_000).toISOString(),
        now
      );

      req.body = { refresh_token: oldToken };
      verifyRefreshToken.mockReturnValue({ id: userId, email: 'test@example.com' });
      generateTokenPair.mockReturnValue(newPair);

      await authController.refreshToken(req, res);

      expect(verifyRefreshToken).toHaveBeenCalledWith(oldToken);
      expect(generateTokenPair).toHaveBeenCalledWith(userId, 'client', 'test@example.com');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          token: 'new_access',
          refresh_token: 'new_refresh',
        })
      );

      const row = db
        .prepare('SELECT is_revoked FROM refresh_tokens WHERE user_id = ? AND token = ?')
        .get(userId, oldToken);
      expect(row.is_revoked).toBe(1);
    });

    test('повинен вимагати refresh_token', async () => {
      req.body = {};

      await authController.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'REFRESH_TOKEN_REQUIRED',
        })
      );
    });

    test('повинен повертати помилку для невалідного токена', async () => {
      req.body = { refresh_token: 'invalid' };
      verifyRefreshToken.mockReturnValue(null);

      await authController.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_REFRESH_TOKEN',
        })
      );
    });

    test('повинен повертати помилку якщо токен не знайдено', async () => {
      const userId = crypto.randomUUID();
      req.body = { refresh_token: 'missing' };
      verifyRefreshToken.mockReturnValue({ id: userId, email: 'test@example.com' });

      await authController.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'REFRESH_TOKEN_INVALID',
        })
      );
    });

    test('повинен повертати помилку для простроченого токена', async () => {
      const db = getDb();
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();
      const token = 'expired';

      db.prepare(
        'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(userId, 'test@example.com', 'hashed', 'client', now, now);

      db.prepare(
        'INSERT INTO refresh_tokens (id, user_id, token, expires_at, is_revoked, created_at) VALUES (?, ?, ?, ?, 0, ?)'
      ).run(crypto.randomUUID(), userId, token, new Date(Date.now() - 3600_000).toISOString(), now);

      req.body = { refresh_token: token };
      verifyRefreshToken.mockReturnValue({ id: userId, email: 'test@example.com' });

      await authController.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'REFRESH_TOKEN_EXPIRED',
        })
      );
    });
  });

  describe('getCurrentUser', () => {
    test('повинен повертати поточного користувача', async () => {
      const db = getDb();
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(
        'INSERT INTO users (id, email, name, role, phone, two_factor_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(userId, 'test@example.com', 'Test', 'client', '+380', 1, now, now);

      req.user = { id: userId };

      await authController.getCurrentUser(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          user: expect.objectContaining({
            id: userId,
            email: 'test@example.com',
            twoFactorEnabled: true,
          }),
        })
      );
    });

    test('повинен повертати 404 якщо користувача не знайдено', async () => {
      req.user = { id: crypto.randomUUID() };

      await authController.getCurrentUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'USER_NOT_FOUND',
        })
      );
    });
  });

  describe('generateTwoFactorSecret', () => {
    test('повинен генерувати секрет і QR код', async () => {
      const db = getDb();
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(
        'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(userId, 'test@example.com', 'hashed', 'client', now, now);

      req.user = { id: userId };

      const secret = {
        base32: 'BASE32',
        otpauth_url: 'otpauth://totp/Avtoservis:test@example.com?secret=BASE32',
      };
      const qr = 'data:image/png;base64,AAA';

      speakeasy.generateSecret.mockReturnValue(secret);
      QRCode.toDataURL.mockImplementation((url, cb) => cb(null, qr));

      await authController.generateTwoFactorSecret(req, res);

      expect(speakeasy.generateSecret).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          secret: 'BASE32',
          qrCode: qr,
        })
      );

      const dbRow = db
        .prepare('SELECT two_factor_secret, two_factor_pending FROM users WHERE id = ?')
        .get(userId);
      expect(dbRow.two_factor_secret).toBe('BASE32');
      expect(dbRow.two_factor_pending).toBe(1);
    });
  });

  describe('verifyAndEnableTwoFactor', () => {
    test('повинен активувати 2FA при вірному коді', async () => {
      const db = getDb();
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(
        'INSERT INTO users (id, email, password, role, two_factor_secret, two_factor_enabled, two_factor_pending, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(userId, 'test@example.com', 'hashed', 'client', 'BASE32', 0, 1, now, now);

      req.user = { id: userId };
      req.body = { token: '123456' };

      speakeasy.totp.verify.mockReturnValue(true);

      await authController.verifyAndEnableTwoFactor(req, res);

      expect(speakeasy.totp.verify).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          twoFactorEnabled: true,
        })
      );

      const row = db
        .prepare('SELECT two_factor_enabled, two_factor_pending FROM users WHERE id = ?')
        .get(userId);
      expect(row.two_factor_enabled).toBe(1);
      expect(row.two_factor_pending).toBe(0);
    });

    test('повинен повертати помилку при невірному коді', async () => {
      const db = getDb();
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(
        'INSERT INTO users (id, email, password, role, two_factor_secret, two_factor_enabled, two_factor_pending, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(userId, 'test@example.com', 'hashed', 'client', 'BASE32', 0, 1, now, now);

      req.user = { id: userId };
      req.body = { token: 'bad' };

      speakeasy.totp.verify.mockReturnValue(false);

      await authController.verifyAndEnableTwoFactor(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Невірний код верифікації',
        })
      );
    });
  });

  describe('disableTwoFactor', () => {
    test('повинен відключати 2FA з правильним паролем', async () => {
      const db = getDb();
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(
        'INSERT INTO users (id, email, password, role, two_factor_secret, two_factor_enabled, two_factor_pending, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(userId, 'test@example.com', 'hashed', 'client', 'BASE32', 1, 0, now, now);

      req.user = { id: userId };
      req.body = { password: 'plain' };

      bcrypt.compare.mockResolvedValue(true);

      await authController.disableTwoFactor(req, res);

      expect(bcrypt.compare).toHaveBeenCalledWith('plain', 'hashed');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          twoFactorEnabled: false,
        })
      );
    });

    test('повинен повертати помилку для невірного пароля', async () => {
      const db = getDb();
      const userId = crypto.randomUUID();
      const now = new Date().toISOString();

      db.prepare(
        'INSERT INTO users (id, email, password, role, two_factor_secret, two_factor_enabled, two_factor_pending, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(userId, 'test@example.com', 'hashed', 'client', 'BASE32', 1, 0, now, now);

      req.user = { id: userId };
      req.body = { password: 'wrong' };

      bcrypt.compare.mockResolvedValue(false);

      await authController.disableTwoFactor(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Невірний пароль',
        })
      );
    });
  });
});
