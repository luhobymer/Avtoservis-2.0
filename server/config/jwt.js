const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m'; // Скорочуємо час життя access токена
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d'; // Refresh токен живе довше

// Створення access токена
const generateToken = (userId, role, identifier) => {
  // Визначаємо, чи є ідентифікатор email або телефоном
  const isEmail = identifier && identifier.includes('@');

  const payload = {
    id: userId,
    role: role,
    type: 'access',
  };

  // Додаємо відповідне поле в залежності від типу ідентифікатора
  if (isEmail) {
    payload.email = identifier;
  } else if (identifier) {
    payload.phone = identifier;
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Створення refresh токена
const generateRefreshToken = (userId, identifier) => {
  // Визначаємо, чи є ідентифікатор email або телефоном
  const isEmail = identifier && identifier.includes('@');

  const payload = {
    id: userId,
    type: 'refresh',
  };

  // Додаємо відповідне поле в залежності від типу ідентифікатора
  if (isEmail) {
    payload.email = identifier;
  } else if (identifier) {
    payload.phone = identifier;
  }

  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
};

// Перевірка access токена
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Перевірка refresh токена
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    if (decoded.type !== 'refresh') {
      return null;
    }
    return decoded;
  } catch (error) {
    return null;
  }
};

// Генерація пари токенів
const generateTokenPair = (userId, role, identifier) => {
  const accessToken = generateToken(userId, role, identifier);
  const refreshToken = generateRefreshToken(userId, identifier);

  return {
    accessToken,
    refreshToken,
    expiresIn: JWT_EXPIRES_IN,
  };
};

module.exports = {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  generateToken,
  generateRefreshToken,
  generateTokenPair,
  verifyToken,
  verifyRefreshToken,
};
