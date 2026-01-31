const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');
const axios = require('axios');

// Використовуємо той самий логер, що і в bot.js
const isTestEnv = process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test';
const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  })
];
if (!isTestEnv) {
  transports.unshift(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'telegram-bot-user-manager' },
  transports
});

class UserManager {
  constructor() {
    this.usersFile = path.join(__dirname, '..', 'data', 'users.json');
    this.ensureDataDir();
  }

  async ensureDataDir() {
    try {
      await fs.mkdir(path.dirname(this.usersFile), { recursive: true });
    } catch (error) {
      // Директорія вже існує
    }
  }

  async loadUsers() {
    try {
      const data = await fs.readFile(this.usersFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return {};
    }
  }

  async saveUsers(users) {
    try {
      await fs.writeFile(this.usersFile, JSON.stringify(users, null, 2));
    } catch (error) {
      throw new Error(`Не вдалося зберегти користувачів: ${error.message}`);
    }
  }

  // Метод getUser перевизначено нижче

  async saveUser(telegramId, userData) {
    const users = await this.loadUsers();
    users[telegramId] = {
      ...users[telegramId],
      ...userData,
      updatedAt: new Date().toISOString()
    };
    await this.saveUsers(users);
  }

  async createUser(telegramId, userInfo) {
    const user = {
      telegramId,
      username: userInfo.username,
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      phone: userInfo.phone,
      email: userInfo.email,
      registeredAt: new Date().toISOString(),
      isActive: true,
      preferences: {
        notifications: true,
        language: 'uk'
      }
    };

    await this.saveUser(telegramId, user);
    return user;
  }

  async linkUserToServer(telegramId, serverUserId, token, expiresAt) {
    const tokenExpiry = expiresAt || this.calculateTokenExpiry(token);
    await this.saveUser(telegramId, {
      serverUserId,
      token,
      tokenIssued: new Date().toISOString(),
      tokenExpires: tokenExpiry
    });
  }

  async unlinkUserFromServer(telegramId) {
    await this.saveUser(telegramId, {
      serverUserId: null,
      token: null,
      tokenExpires: null
    });
  }

  async isUserLinked(telegramId) {
    const user = await this.getUser(telegramId);
    if (!user || !user.serverUserId || !user.token) {
      return false;
    }
    
    // Перевіряємо термін дії токена
    if (user.tokenExpires && new Date() > new Date(user.tokenExpires)) {
      // Токен застарілий, видаляємо його
      logger.info('Токен застарілий, видаляємо', { telegramId });
      await this.unlinkUserFromServer(telegramId);
      return false;
    }
    
    // Перевіряємо валідність токена на сервері при КОЖНОМУ виклику
    const now = new Date();
    
    try {
      // Перевіряємо токен на сервері
      logger.debug('Перевірка токена на сервері для користувача в isUserLinked', { telegramId });
      const isValid = await this.verifyTokenOnServer(user.token);
      
      // Оновлюємо час останньої перевірки
      await this.saveUser(telegramId, { lastTokenCheck: now.toISOString() });
      
      if (!isValid) {
        // Токен недійсний, видаляємо його
        logger.info('Токен недійсний на сервері, видаляємо в isUserLinked', { telegramId });
        await this.unlinkUserFromServer(telegramId);
        return false;
      }
    } catch (error) {
      logger.error('Помилка перевірки токена на сервері в isUserLinked:', {
        error: error.message,
        stack: error.stack,
        telegramId
      });
      // Якщо сталася помилка при перевірці, вважаємо токен дійсним
      // але не оновлюємо час останньої перевірки, щоб спробувати знову пізніше
    }
    
    return true;
  }

  async extendUser(user) {
    if (!user) return null;

    user.isLinkedToServer = () => Boolean(user.serverUserId && user.token);
    user.isTokenExpired = () => user.tokenExpires && new Date() > new Date(user.tokenExpires);

    return user;
  }

  async getUser(telegramId) {
    const users = await this.loadUsers();
    const user = users[telegramId];
    return user ? await this.extendUser(user) : null;
  }

  async getServerCredentials(telegramId) {
    const user = await this.getUser(telegramId);
    if (!user || !user.token) {
      throw new Error('Користувач не авторизований');
    }

    // Перевірка терміну дії токена
    if (new Date() > new Date(user.tokenExpires)) {
      // Токен застарілий, видаляємо його
      await this.unlinkUserFromServer(telegramId);
      throw new Error('Токен закінчився, потрібна повторна авторизація');
    }
    
    // Перевіряємо валідність токена на сервері при КОЖНОМУ запиті
    try {
      logger.debug('Перевірка токена на сервері для користувача', { telegramId });
      const isValid = await this.verifyTokenOnServer(user.token);
      
      // Оновлюємо час останньої перевірки
      const now = new Date();
      await this.saveUser(telegramId, { lastTokenCheck: now.toISOString() });
      
      if (!isValid) {
        // Токен недійсний, видаляємо його
        logger.info('Токен недійсний на сервері, видаляємо', { telegramId });
        await this.unlinkUserFromServer(telegramId);
        throw new Error('Токен недійсний, потрібна повторна авторизація');
      }
    } catch (error) {
      // Якщо помилка пов'язана з недійсним токеном, перекидаємо її
      if (error.message.includes('Токен недійсний')) {
        throw error;
      }
      
      // Для інших помилок (наприклад, мережевих) логуємо, але продовжуємо
      logger.error('Помилка перевірки токена на сервері в getServerCredentials:', {
        error: error.message,
        stack: error.stack,
        telegramId
      });
      // Вважаємо токен дійсним, але не оновлюємо час останньої перевірки
    }

    return {
      userId: user.serverUserId,
      token: user.token
    };
  }

  calculateTokenExpiry(token) {
    const expiryFromToken = this.getTokenExpiry(token);
    if (expiryFromToken) {
      return expiryFromToken;
    }
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 1);
    return expiry.toISOString();
  }

  getTokenExpiry(token) {
    if (!token || typeof token !== 'string') {
      return null;
    }
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
      if (payload && payload.exp) {
        return new Date(payload.exp * 1000).toISOString();
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  async verifyTokenOnServer(token) {
    try {
      const baseUrl = process.env.SERVER_API_URL || 'http://localhost:5001';
      const headers = { Authorization: `Bearer ${token}` };
      if (process.env.SERVER_API_KEY) {
        headers['x-api-key'] = process.env.SERVER_API_KEY;
      }
      const res = await axios.get(`${baseUrl}/api/telegram/me`, {
        headers
      });
      return res.status === 200;
    } catch (error) {
      if (error.response && [401, 403].includes(error.response.status)) {
        return false;
      }
      // Інші помилки не вважаємо недійсним токеном
      return true;
    }
  }

  async getUserLanguage(telegramId) {
    const user = await this.getUser(telegramId);
    return user?.preferences?.language || 'uk';
  }

  async setUserLanguage(telegramId, language) {
    await this.saveUser(telegramId, {
      preferences: {
        ...(await this.getUser(telegramId))?.preferences,
        language
      }
    });
  }

  async toggleNotifications(telegramId) {
    const user = await this.getUser(telegramId);
    const enabled = !(user?.preferences?.notifications ?? true);
    await this.saveUser(telegramId, {
      preferences: {
        ...(user?.preferences || {}),
        notifications: enabled
      }
    });
    return enabled;
  }
}

module.exports = new UserManager();
