/**
 * Детальний тест для authController.js
 * Покриває всі функції автентифікації та реєстрації
 */

const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const authController = require('../controllers/authController');
const { generateTokenPair, verifyRefreshToken } = require('../config/jwt');

// Мокуємо зовнішні залежності
jest.mock('bcryptjs');
jest.mock('speakeasy');
jest.mock('qrcode');
jest.mock('../config/supabase', () => ({
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn(() => ({
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
    delete: jest.fn(() => ({
      eq: jest.fn().mockReturnThis(),
    })),
  })),
}));
jest.mock('../config/jwt');

describe('AuthController - Детальне тестування', () => {
  let req, res, mockSupabase;
  let mockBcrypt, mockSpeakeasy, mockQRCode;
  let mockGenerateTokenPair, mockVerifyRefreshToken;

  beforeEach(() => {
    // Налаштовуємо req та res об'єкти
    req = {
      body: {},
      user: null,
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Отримуємо мокані модулі
    mockSupabase = require('../config/supabase');
    mockBcrypt = require('bcryptjs');
    mockSpeakeasy = require('speakeasy');
    mockQRCode = require('qrcode');
    mockGenerateTokenPair = require('../config/jwt').generateTokenPair;
    mockVerifyRefreshToken = require('../config/jwt').verifyRefreshToken;

    // Очищуємо всі моки
    jest.clearAllMocks();
  });

  describe('login функція', () => {
    test('повинен успішно виконувати вхід без 2FA', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashedPassword',
        role: 'client',
        twoFactorEnabled: false,
      };

      const mockTokenPair = {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresIn: 3600,
      };

      req.body = {
        email: 'test@example.com',
        password: 'plainPassword',
      };

      // Налаштовуємо моки
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockReturnValue(mockChain);
      mockBcrypt.compare.mockResolvedValue(true);
      mockGenerateTokenPair.mockReturnValue(mockTokenPair);

      await authController.login(req, res);

      expect(mockSupabase.from).toHaveBeenCalledWith('users');
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.eq).toHaveBeenCalledWith('email', 'test@example.com');
      expect(mockBcrypt.compare).toHaveBeenCalledWith('plainPassword', 'hashedPassword');
      expect(mockGenerateTokenPair).toHaveBeenCalledWith(1, 'client', 'test@example.com');

      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        token: 'access_token',
        refresh_token: 'refresh_token',
        token_type: 'Bearer',
        expires_in: 3600,
        user: {
          id: 1,
          email: 'test@example.com',
          role: 'client',
          twoFactorEnabled: false,
        },
      });
    });

    test('повинен вимагати 2FA код якщо 2FA включено', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashedPassword',
        role: 'admin',
        twoFactorEnabled: true,
      };

      req.body = {
        email: 'test@example.com',
        password: 'plainPassword',
        // token2fa відсутній
      };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockChain);
      mockBcrypt.compare.mockResolvedValue(true);

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'pending',
        code: 'TWO_FACTOR_REQUIRED',
        requireTwoFactor: true,
        message: 'Потрібен код двофакторної автентифікації',
        user: {
          id: 1,
          email: 'test@example.com',
          role: 'admin',
          twoFactorEnabled: true,
        },
      });
    });

    test('повинен успішно виконувати вхід з валідним 2FA кодом', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashedPassword',
        role: 'admin',
        twoFactorEnabled: true,
        twoFactorSecret: 'secret_key',
      };

      const mockTokenPair = {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresIn: 3600,
      };

      req.body = {
        email: 'test@example.com',
        password: 'plainPassword',
        token2fa: '123456',
      };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockReturnValue(mockChain);
      mockBcrypt.compare.mockResolvedValue(true);
      mockSpeakeasy.totp.verify.mockReturnValue(true);
      mockGenerateTokenPair.mockReturnValue(mockTokenPair);

      await authController.login(req, res);

      expect(mockSpeakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'secret_key',
        encoding: 'base32',
        token: '123456',
        window: 1,
      });

      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        token: 'access_token',
        refresh_token: 'refresh_token',
        token_type: 'Bearer',
        expires_in: 3600,
        user: {
          id: 1,
          email: 'test@example.com',
          role: 'admin',
          twoFactorEnabled: true,
        },
      });
    });

    test('повинен повертати помилку для неіснуючого користувача', async () => {
      req.body = {
        email: 'nonexistent@example.com',
        password: 'password',
      };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: 'User not found' }),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: 'Користувача не знайдено',
      });
    });

    test('повинен повертати помилку для невірного пароля', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashedPassword',
        role: 'client',
      };

      req.body = {
        email: 'test@example.com',
        password: 'wrongPassword',
      };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockChain);
      mockBcrypt.compare.mockResolvedValue(false);

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'INVALID_PASSWORD',
        message: 'Невірний пароль',
      });
    });

    test('повинен повертати помилку для невірного 2FA коду', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashedPassword',
        role: 'admin',
        twoFactorEnabled: true,
        twoFactorSecret: 'secret_key',
      };

      req.body = {
        email: 'test@example.com',
        password: 'plainPassword',
        token2fa: 'invalid_code',
      };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockChain);
      mockBcrypt.compare.mockResolvedValue(true);
      mockSpeakeasy.totp.verify.mockReturnValue(false);

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'INVALID_2FA_TOKEN',
        message: 'Невірний код двофакторної автентифікації',
      });
    });

    test('повинен обробляти серверні помилки', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'password',
      };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'SERVER_ERROR',
        message: 'Помилка сервера при автентифікації',
      });
    });
  });

  describe('register функція', () => {
    test('повинен успішно реєструвати нового користувача', async () => {
      const mockNewUser = [
        {
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          role: 'client',
        },
      ];

      const mockTokenPair = {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresIn: 3600,
      };

      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'client',
      };

      // Налаштовуємо моки
      const mockChainCheck = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockChainInsert = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: mockNewUser, error: null }),
      };

      const mockChainToken = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockChainCheck)
        .mockReturnValueOnce(mockChainInsert)
        .mockReturnValueOnce(mockChainToken);

      // Хешування пароля
      mockBcrypt.genSalt.mockResolvedValue('salt');
      mockBcrypt.hash.mockResolvedValue('hashedPassword');

      // Генерація токенів
      mockGenerateTokenPair.mockReturnValue(mockTokenPair);

      await authController.register(req, res);

      expect(mockBcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 'salt');
      expect(mockGenerateTokenPair).toHaveBeenCalledWith(1, 'client', 'test@example.com');

      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        token: 'access_token',
        refresh_token: 'refresh_token',
        token_type: 'Bearer',
        expires_in: 3600,
        user: {
          id: 1,
          email: 'test@example.com',
          role: 'client',
        },
      });
    });

    test('повинен повертати помилку якщо email вже існує', async () => {
      const existingUser = {
        id: 1,
        email: 'existing@example.com',
      };

      req.body = {
        name: 'Test User',
        email: 'existing@example.com',
        password: 'password123',
      };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: existingUser, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'EMAIL_EXISTS',
        message: 'Користувач з таким email вже існує',
      });
    });

    test('повинен використовувати роль за замовчуванням', async () => {
      const mockNewUser = [
        {
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          role: 'user',
        },
      ];

      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        // role не вказано
      };

      const mockChainCheck = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockChainInsert = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: mockNewUser, error: null }),
      };

      const mockChainToken = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockChainCheck)
        .mockReturnValueOnce(mockChainInsert)
        .mockReturnValueOnce(mockChainToken);

      mockBcrypt.genSalt.mockResolvedValue('salt');
      mockBcrypt.hash.mockResolvedValue('hashedPassword');
      mockGenerateTokenPair.mockReturnValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: 3600,
      });

      await authController.register(req, res);

      // Перевіряємо, що користувач створений з роллю 'user'
      expect(mockChainInsert.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          role: 'user',
        }),
      ]);
    });

    test('повинен обробляти помилки створення користувача', async () => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };

      const mockChainCheck = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      const mockChainInsert = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: null, error: 'Creation failed' }),
      };

      mockSupabase.from.mockReturnValueOnce(mockChainCheck).mockReturnValueOnce(mockChainInsert);

      mockBcrypt.genSalt.mockResolvedValue('salt');
      mockBcrypt.hash.mockResolvedValue('hashedPassword');

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'USER_CREATION_FAILED',
        message: 'Помилка при створенні користувача',
      });
    });

    test('повинен обробляти серверні помилки', async () => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'SERVER_ERROR',
        message: 'Помилка сервера при реєстрації',
      });
    });
  });

  describe('refreshToken функція', () => {
    test('повинен успішно оновлювати токен', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        role: 'client',
      };

      const mockTokenData = {
        token: 'valid_refresh_token',
        user_id: 1,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        is_revoked: false,
      };

      const mockTokenPair = {
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresIn: 3600,
      };

      req.body = {
        refresh_token: 'valid_refresh_token',
      };

      mockVerifyRefreshToken.mockReturnValue({ id: 1, email: 'test@example.com' });

      const mockChainToken = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockTokenData, error: null }),
      };

      const mockChainUser = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
      };

      const mockChainUpdate = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };

      const mockChainInsert = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockChainToken)
        .mockReturnValueOnce(mockChainUser)
        .mockReturnValueOnce(mockChainUpdate)
        .mockReturnValueOnce(mockChainInsert);

      mockGenerateTokenPair.mockReturnValue(mockTokenPair);

      await authController.refreshToken(req, res);

      expect(mockVerifyRefreshToken).toHaveBeenCalledWith('valid_refresh_token');
      expect(mockGenerateTokenPair).toHaveBeenCalledWith(1, 'client', 'test@example.com');

      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        token_type: 'Bearer',
        expires_in: 3600,
      });
    });

    test('повинен повертати помилку якщо refresh_token відсутній', async () => {
      req.body = {};

      await authController.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'REFRESH_TOKEN_REQUIRED',
        message: 'Необхідно надати refresh token',
      });
    });

    test('повинен повертати помилку для невалідного refresh token', async () => {
      req.body = {
        refresh_token: 'invalid_refresh_token',
      };

      mockVerifyRefreshToken.mockReturnValue(null);

      await authController.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Недійсний або прострочений refresh token',
      });
    });

    test('повинен повертати помилку якщо токен не знайдено в базі даних', async () => {
      req.body = {
        refresh_token: 'valid_refresh_token',
      };

      mockVerifyRefreshToken.mockReturnValue({ id: 1, email: 'test@example.com' });

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: 'Token not found' }),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await authController.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'REFRESH_TOKEN_INVALID',
        message: 'Токен не знайдено або він був відкликаний',
      });
    });

    test('повинен повертати помилку для прострочених токенів', async () => {
      const expiredTokenData = {
        token: 'expired_refresh_token',
        user_id: 1,
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // вчора
        is_revoked: false,
      };

      req.body = {
        refresh_token: 'expired_refresh_token',
      };

      mockVerifyRefreshToken.mockReturnValue({ id: 1, email: 'test@example.com' });

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: expiredTokenData, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await authController.refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Термін дії refresh token закінчився',
      });
    });
  });

  describe('getCurrentUser функція', () => {
    test('повинен повертати дані поточного користувача', async () => {
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'client',
        twoFactorEnabled: false,
      };

      req.user = { id: 1 };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await authController.getCurrentUser(req, res);

      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        user: {
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          role: 'client',
          twoFactorEnabled: false,
        },
      });
    });

    test('повинен повертати помилку якщо користувача не знайдено', async () => {
      req.user = { id: 999 };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: 'User not found' }),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await authController.getCurrentUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: 'Користувача не знайдено',
      });
    });
  });

  describe('generateTwoFactorSecret функція', () => {
    test('повинен успішно генерувати 2FA секрет та QR код', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        role: 'client',
      };

      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/Avtoservis:test@example.com?secret=JBSWY3DPEHPK3PXP',
      };

      const mockQRDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...';

      req.user = { id: 1 };

      const mockChainSelect = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
      };

      const mockChainUpdate = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockReturnValueOnce(mockChainSelect).mockReturnValueOnce(mockChainUpdate);

      mockSpeakeasy.generateSecret.mockReturnValue(mockSecret);
      mockQRCode.toDataURL.mockImplementation((url, callback) => {
        callback(null, mockQRDataUrl);
      });

      await authController.generateTwoFactorSecret(req, res);

      expect(mockSpeakeasy.generateSecret).toHaveBeenCalledWith({
        name: 'Avtoservis:test@example.com',
      });

      expect(mockChainUpdate.update).toHaveBeenCalledWith({
        twoFactorSecret: 'JBSWY3DPEHPK3PXP',
        twoFactorPending: true,
      });

      expect(res.json).toHaveBeenCalledWith({
        secret: 'JBSWY3DPEHPK3PXP',
        qrCode: mockQRDataUrl,
      });
    });

    test('повинен обробляти помилку генерації QR коду', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
      };

      const mockSecret = {
        base32: 'JBSWY3DPEHPK3PXP',
        otpauth_url: 'otpauth://totp/Avtoservis:test@example.com?secret=JBSWY3DPEHPK3PXP',
      };

      req.user = { id: 1 };

      const mockChainSelect = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
      };

      const mockChainUpdate = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockReturnValueOnce(mockChainSelect).mockReturnValueOnce(mockChainUpdate);

      mockSpeakeasy.generateSecret.mockReturnValue(mockSecret);
      mockQRCode.toDataURL.mockImplementation((url, callback) => {
        callback(new Error('QR generation failed'), null);
      });

      await authController.generateTwoFactorSecret(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Помилка генерації QR-коду',
      });
    });

    test('повинен обробляти серверні помилки', async () => {
      req.user = { id: 1 };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await authController.generateTwoFactorSecret(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Помилка сервера',
      });
    });
  });

  describe('verifyAndEnableTwoFactor функція', () => {
    test('повинен успішно верифікувати та активувати 2FA', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        twoFactorSecret: 'JBSWY3DPEHPK3PXP',
        twoFactorPending: true,
      };

      req.user = { id: 1 };
      req.body = { token: '123456' };

      const mockChainSelect = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
      };

      const mockChainUpdate = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockReturnValueOnce(mockChainSelect).mockReturnValueOnce(mockChainUpdate);

      mockSpeakeasy.totp.verify.mockReturnValue(true);

      await authController.verifyAndEnableTwoFactor(req, res);

      expect(mockSpeakeasy.totp.verify).toHaveBeenCalledWith({
        secret: 'JBSWY3DPEHPK3PXP',
        encoding: 'base32',
        token: '123456',
        window: 1,
      });

      expect(mockChainUpdate.update).toHaveBeenCalledWith({
        twoFactorEnabled: true,
        twoFactorPending: false,
      });

      expect(res.json).toHaveBeenCalledWith({
        message: 'Двофакторну автентифікацію успішно активовано',
        twoFactorEnabled: true,
      });
    });

    test('повинен повертати помилку для невірного коду', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        twoFactorSecret: 'JBSWY3DPEHPK3PXP',
      };

      req.user = { id: 1 };
      req.body = { token: 'invalid_code' };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockChain);
      mockSpeakeasy.totp.verify.mockReturnValue(false);

      await authController.verifyAndEnableTwoFactor(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Невірний код верифікації',
      });
    });

    test('повинен обробляти серверні помилки', async () => {
      req.user = { id: 1 };
      req.body = { token: '123456' };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await authController.verifyAndEnableTwoFactor(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Помилка сервера',
      });
    });
  });

  describe('disableTwoFactor функція', () => {
    test('повинен успішно відключати 2FA з правильним паролем', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashedPassword',
        twoFactorEnabled: true,
      };

      req.user = { id: 1 };
      req.body = { password: 'plainPassword' };

      const mockChainSelect = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
      };

      const mockChainUpdate = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockReturnValueOnce(mockChainSelect).mockReturnValueOnce(mockChainUpdate);

      mockBcrypt.compare.mockResolvedValue(true);

      await authController.disableTwoFactor(req, res);

      expect(mockBcrypt.compare).toHaveBeenCalledWith('plainPassword', 'hashedPassword');

      expect(mockChainUpdate.update).toHaveBeenCalledWith({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorPending: false,
      });

      expect(res.json).toHaveBeenCalledWith({
        message: 'Двофакторну автентифікацію відключено',
        twoFactorEnabled: false,
      });
    });

    test('повинен повертати помилку для невірного пароля', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashedPassword',
        twoFactorEnabled: true,
      };

      req.user = { id: 1 };
      req.body = { password: 'wrongPassword' };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockChain);
      mockBcrypt.compare.mockResolvedValue(false);

      await authController.disableTwoFactor(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Невірний пароль',
      });
    });

    test('повинен обробляти серверні помилки', async () => {
      req.user = { id: 1 };
      req.body = { password: 'password' };

      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      mockSupabase.from.mockReturnValue(mockChain);

      await authController.disableTwoFactor(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Помилка сервера',
      });
    });
  });
});
