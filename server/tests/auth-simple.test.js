/**
 * Спрощений тест для authController
 */

// Мокуємо зовнішні залежності
jest.mock('bcryptjs');
jest.mock('../config/supabase');
jest.mock('../config/jwt');

const bcrypt = require('bcryptjs');
const authController = require('../controllers/authController');
const supabase = require('../config/supabase');
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

      supabase.from.mockReturnValue(mockChain);
      bcrypt.compare.mockResolvedValue(true);
      generateTokenPair.mockReturnValue(mockTokenPair);

      await authController.login(req, res);

      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(bcrypt.compare).toHaveBeenCalledWith('plainPassword', 'hashedPassword');
      expect(generateTokenPair).toHaveBeenCalledWith(1, 'client', 'test@example.com');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          token: 'access_token',
        })
      );
    });
  });
});
