const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');

/**
 * Middleware для перевірки автентифікації користувача
 * Перевіряє наявність та валідність JWT токена
 */
module.exports = async (req, res, next) => {
  try {
    // Отримуємо токен з заголовків
    let token = req.header('x-auth-token');

    if (!token) {
      const authHeader = req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.replace('Bearer ', '');
      }
    }

    if (!token) {
      console.log('[Auth] No token provided in request headers');
      return res.status(401).json({
        status: 'error',
        code: 'NO_TOKEN',
        message: 'Немає токена, доступ заборонено',
      });
    }

    // Перевіряємо формат токена
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      console.log('[Auth] Invalid token format');
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_TOKEN_FORMAT',
        message: 'Недійсний формат токена',
      });
    }

    try {
      // Перевіряємо токен
      const decoded = jwt.verify(token, JWT_SECRET);

      // Перевіряємо наявність необхідних полів
      if (!decoded.id || (!decoded.email && !decoded.phone)) {
        console.log('[Auth] Token missing required fields');
        return res.status(401).json({
          status: 'error',
          code: 'INVALID_TOKEN_PAYLOAD',
          message: 'Токен не містить необхідних даних',
        });
      }

      // Додаємо дані користувача до запиту
      req.user = decoded;
      next();
    } catch (jwtError) {
      // Обробка різних типів помилок JWT
      if (jwtError.name === 'TokenExpiredError') {
        console.log('[Auth] Token expired:', jwtError.expiredAt);
        return res.status(401).json({
          status: 'error',
          code: 'TOKEN_EXPIRED',
          message: 'Термін дії токена закінчився',
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        console.log('[Auth] Invalid token signature');
        return res.status(401).json({
          status: 'error',
          code: 'INVALID_SIGNATURE',
          message: 'Недійсний підпис токена',
        });
      } else {
        console.log('[Auth] JWT verification error:', jwtError.message);
        return res.status(401).json({
          status: 'error',
          code: 'INVALID_TOKEN',
          message: 'Токен недійсний',
        });
      }
    }
  } catch (err) {
    console.error('[Auth] Middleware error:', err);
    res.status(500).json({
      status: 'error',
      code: 'SERVER_ERROR',
      message: 'Помилка сервера при перевірці автентифікації',
    });
  }
};
