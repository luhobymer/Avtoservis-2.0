/**
 * Спрощений тест для authController
 */

// Мокуємо зовнішні залежності
jest.mock('bcryptjs');
jest.mock('../config/jwt');

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const authController = require('../controllers/authController');
const { getDb } = require('../db/d1');
const { generateTokenPair } = require('../config/jwt');

describe('AuthController - Спрощений тест', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      user: null,
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
  });

  describe('login функція', () => {
    test('повинен успішно виконувати базовий вхід', async () => {
      const userId = crypto.randomUUID();
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        password: 'hashedPassword',
        role: 'client',
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

      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO users (id, email, password, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(mockUser.id, mockUser.email, mockUser.password, mockUser.role, now, now);

      bcrypt.compare.mockResolvedValue(true);
      generateTokenPair.mockReturnValue(mockTokenPair);

      await authController.login(req, res);

      expect(bcrypt.compare).toHaveBeenCalledWith('plainPassword', 'hashedPassword');
      expect(generateTokenPair).toHaveBeenCalledWith(mockUser.id, 'client', 'test@example.com');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          token: 'access_token',
        })
      );
    });
  });
});
