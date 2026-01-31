const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { generateTokenPair, verifyRefreshToken } = require('../config/jwt');
const { getDb } = require('../db/d1');
const mailer = require('../services/mailer');

const allowedUserFields = new Set(['email', 'phone', 'id']);

const getUserByField = async (field, value) => {
  if (!allowedUserFields.has(field)) {
    throw new Error('Invalid user field');
  }
  const db = await getDb();
  if (field === 'email') {
    return db.prepare('SELECT * FROM users WHERE lower(email) = lower(?) LIMIT 1').get(value);
  }
  return db.prepare(`SELECT * FROM users WHERE ${field} = ? LIMIT 1`).get(value);
};

const getRefreshTokenExpiry = (refreshToken) => {
  const decoded = verifyRefreshToken(refreshToken);
  if (decoded?.exp) {
    return new Date(decoded.exp * 1000).toISOString();
  }
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
};

const insertRefreshToken = async (userId, token, expiresAt) => {
  const resolvedExpiry = expiresAt || getRefreshTokenExpiry(token);
  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO refresh_tokens (id, user_id, token, expires_at, is_revoked, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`
    )
    .run(crypto.randomUUID(), userId, token, resolvedExpiry, new Date().toISOString());
};

/**
 * Контролер для входу користувача в систему
 * Перевіряє облікові дані, підтримує двофакторну автентифікацію
 * та генерує JWT токени для автентифікації
 */
exports.login = async (req, res) => {
  try {
    const { email, password, token2fa, phone, identifier } = req.body;

    const normalizedIdentifier =
      identifier && typeof identifier === 'string' ? identifier.trim() : null;
    const hasIdentifier = Boolean(normalizedIdentifier);
    const isIdentifierEmail = hasIdentifier && normalizedIdentifier.includes('@');
    const searchField = phone
      ? 'phone'
      : email
        ? 'email'
        : hasIdentifier
          ? isIdentifierEmail
            ? 'email'
            : 'phone'
          : null;
    const searchValue = phone || email || normalizedIdentifier;

    if (!searchField || !searchValue || !password) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_CREDENTIALS',
        message: 'Необхідно вказати email або телефон та пароль',
      });
    }

    // Перевіряємо користувача
    const user = await getUserByField(searchField, searchValue);

    if (!user) {
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_CREDENTIALS',
        message: 'Невірні дані для входу',
      });
    }

    // Перевіряємо пароль
    const storedPassword = user.password ? String(user.password) : '';
    const plainPassword = password != null ? String(password) : '';
    const looksLikeBcrypt =
      storedPassword.startsWith('$2a$') ||
      storedPassword.startsWith('$2b$') ||
      storedPassword.startsWith('$2y$');

    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(plainPassword, storedPassword);
    } catch (compareError) {
      if (!looksLikeBcrypt) {
        isMatch =
          Boolean(plainPassword) && Boolean(storedPassword) && plainPassword === storedPassword;
        if (isMatch) {
          try {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(plainPassword, salt);
            const db = await getDb();
            await db
              .prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?')
              .run(hashedPassword, new Date().toISOString(), user.id);
          } catch (rehashError) {
            console.error('[Auth] Password rehash failed:', rehashError?.message || rehashError);
          }
        }
      }
    }

    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_CREDENTIALS',
        message: 'Невірні дані для входу',
      });
    }

    // Перевіряємо 2FA, якщо воно включено
    if (user.two_factor_enabled) {
      if (!user.two_factor_secret) {
        return res.status(400).json({
          status: 'error',
          code: 'TWO_FACTOR_NOT_CONFIGURED',
          message: 'Двофакторна автентифікація не налаштована',
        });
      }

      if (!token2fa) {
        return res.status(200).json({
          status: 'pending',
          code: 'TWO_FACTOR_REQUIRED',
          requireTwoFactor: true,
          message: 'Потрібен код двофакторної автентифікації',
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            twoFactorEnabled: true,
          },
        });
      }

      let verified = false;
      try {
        verified = speakeasy.totp.verify({
          secret: user.two_factor_secret,
          encoding: 'base32',
          token: token2fa,
          window: 1,
        });
      } catch (verifyError) {
        console.error('[Auth] 2FA verification error:', verifyError);
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_2FA_TOKEN',
          message: 'Невірний код двофакторної автентифікації',
        });
      }

      if (!verified) {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_2FA_TOKEN',
          message: 'Невірний код двофакторної автентифікації',
        });
      }
    }

    // Генеруємо пару токенів
    const tokenPair = generateTokenPair(user.id, user.role, user.email || user.phone);

    // Зберігаємо refresh token у базі даних
    try {
      await insertRefreshToken(user.id, tokenPair.refreshToken);
    } catch (tokenError) {
      console.error('[Auth] Error saving refresh token:', tokenError);
      // Продовжуємо виконання, навіть якщо не вдалося зберегти refresh token
    }

    // Підготовка даних користувача для відповіді
    const userResponse = {
      id: user.id,
      role: user.role,
      twoFactorEnabled: !!user.two_factor_enabled,
    };

    if (user.name) userResponse.name = user.name;
    if (user.email) userResponse.email = user.email;
    if (user.phone) userResponse.phone = user.phone;
    if (user.first_name) userResponse.firstName = user.first_name;
    if (user.last_name) userResponse.lastName = user.last_name;
    if (user.patronymic) userResponse.patronymic = user.patronymic;
    if (user.region) userResponse.region = user.region;
    if (user.city) userResponse.city = user.city;

    res.json({
      status: 'success',
      token: tokenPair.accessToken,
      refresh_token: tokenPair.refreshToken,
      token_type: 'Bearer',
      expires_in: tokenPair.expiresIn,
      user: userResponse,
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({
      status: 'error',
      code: 'SERVER_ERROR',
      message: 'Помилка сервера при автентифікації',
    });
  }
};

/**
 * Контролер для реєстрації нового користувача
 * Створює обліковий запис та генерує JWT токени для автентифікації
 */
exports.register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      firstName,
      lastName,
      patronymic,
      region,
      city,
      username,
    } = req.body;

    // Використовуємо ім'я з параметрів або комбінуємо firstName і lastName
    const normalizedRole = (role || 'client').toLowerCase();
    const normalizedFirstName = firstName?.trim() || name?.trim() || null;
    const normalizedLastName = lastName?.trim() || null;
    const normalizedPatronymic = patronymic?.trim() || null;
    const normalizedRegion = region?.trim() || null;
    const normalizedCity = city?.trim() || null;
    const userName =
      name ||
      [normalizedFirstName, normalizedLastName, normalizedPatronymic].filter(Boolean).join(' ') ||
      username;

    // Генеруємо тимчасовий пароль, якщо його немає
    const userPassword = password || Math.random().toString(36).slice(-8);

    // Визначаємо, чи використовуємо email чи телефон для реєстрації
    const hasEmail = !!email;
    const hasPhone = !!phone;

    if (!hasEmail && !hasPhone) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_CREDENTIALS',
        message: 'Необхідно вказати email або номер телефону',
      });
    }
    if (normalizedRole === 'master') {
      if (!normalizedFirstName || !normalizedLastName || !normalizedRegion || !normalizedCity) {
        return res.status(400).json({
          status: 'error',
          code: 'MISSING_REQUIRED_FIELDS',
          message: "Для майстра обов'язкові поля: ім'я, прізвище, область, місто",
        });
      }
    }

    // Перевіряємо, чи існує користувач з таким email або телефоном
    const existingUser = hasEmail
      ? await getUserByField('email', email)
      : hasPhone
        ? await getUserByField('phone', phone)
        : null;

    if (existingUser) {
      const fieldName = hasEmail ? 'email' : 'телефон';
      return res.status(409).json({
        status: 'error',
        code: hasEmail ? 'EMAIL_EXISTS' : 'PHONE_EXISTS',
        message: `Користувач з таким ${fieldName}ом вже існує`,
      });
    }

    // Хешуємо пароль
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(userPassword, salt);

    // Підготовка даних для вставки
    const userData = {
      password: hashedPassword,
      name: userName,
      role: normalizedRole,
      first_name: normalizedFirstName,
      last_name: normalizedLastName,
      patronymic: normalizedPatronymic,
      region: normalizedRegion,
      city: normalizedCity,
    };

    // Додаємо email або телефон в залежності від наявності
    if (hasEmail) userData.email = email;
    if (hasPhone) userData.phone = phone;

    // Створюємо користувача з хешованим паролем
    const db = await getDb();
    const createdUserId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO users (
        id,
        email,
        password,
        role,
        name,
        phone,
        first_name,
        last_name,
        patronymic,
        region,
        city,
        two_factor_enabled,
        two_factor_pending,
        created_at,
        updated_at
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`
      )
      .run(
        createdUserId,
        userData.email || null,
        userData.password,
        userData.role,
        userData.name || null,
        userData.phone || null,
        userData.first_name || null,
        userData.last_name || null,
        userData.patronymic || null,
        userData.region || null,
        userData.city || null,
        now,
        now
      );

    const createdUser = await db
      .prepare(
        'SELECT id, email, phone, role, name, first_name, last_name, patronymic, region, city FROM users WHERE id = ?'
      )
      .get(createdUserId);
    // Генеруємо пару токенів
    const tokenPair = generateTokenPair(
      createdUser.id,
      createdUser.role,
      createdUser.email || createdUser.phone
    );

    // Зберігаємо refresh token у базі даних
    try {
      await insertRefreshToken(createdUser.id, tokenPair.refreshToken);
    } catch (tokenError) {
      console.error('[Auth] Error saving refresh token:', tokenError);
      // Продовжуємо виконання, навіть якщо не вдалося зберегти refresh token
    }

    // Підготовка даних користувача для відповіді
    const userResponse = {
      id: createdUser.id,
      role: createdUser.role,
    };

    if (createdUser.name) userResponse.name = createdUser.name;
    if (hasEmail) userResponse.email = createdUser.email;
    if (hasPhone) userResponse.phone = createdUser.phone;
    if (createdUser.first_name) userResponse.firstName = createdUser.first_name;
    if (createdUser.last_name) userResponse.lastName = createdUser.last_name;
    if (createdUser.patronymic) userResponse.patronymic = createdUser.patronymic;
    if (createdUser.region) userResponse.region = createdUser.region;
    if (createdUser.city) userResponse.city = createdUser.city;

    res.status(201).json({
      status: 'success',
      token: tokenPair.accessToken,
      refresh_token: tokenPair.refreshToken,
      token_type: 'Bearer',
      expires_in: tokenPair.expiresIn,
      user: userResponse,
    });
  } catch (err) {
    console.error('[Auth] Registration error:', err);
    res.status(500).json({
      status: 'error',
      code: 'SERVER_ERROR',
      message: 'Помилка сервера при реєстрації',
    });
  }
};

/**
 * Отримання інформації про поточного автентифікованого користувача
 */
exports.getCurrentUser = async (req, res) => {
  try {
    const db = await getDb();
    const user = await db
      .prepare(
        'SELECT id, email, name, role, phone, first_name, last_name, patronymic, region, city, two_factor_enabled, created_at FROM users WHERE id = ?'
      )
      .get(req.user.id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: 'Користувача не знайдено',
      });
    }
    res.json({
      status: 'success',
      user: {
        ...user,
        twoFactorEnabled: !!user.two_factor_enabled,
      },
    });
  } catch (err) {
    console.error('[Auth] Get current user error:', err);
    res.status(500).json({
      status: 'error',
      code: 'SERVER_ERROR',
      message: 'Помилка сервера при отриманні даних користувача',
    });
  }
};

/**
 * Оновлення токена доступу за допомогою refresh токена
 * Дозволяє клієнту отримати новий access token без повторної автентифікації
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        status: 'error',
        code: 'REFRESH_TOKEN_REQUIRED',
        message: 'Необхідно надати refresh token',
      });
    }

    // Перевіряємо refresh token
    const decoded = verifyRefreshToken(refresh_token);
    if (!decoded) {
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Недійсний або прострочений refresh token',
      });
    }

    // Перевіряємо, чи існує цей токен у базі даних і чи не був відкликаний
    const db = await getDb();
    const tokenData = await db
      .prepare(
        'SELECT * FROM refresh_tokens WHERE token = ? AND user_id = ? AND is_revoked = 0 LIMIT 1'
      )
      .get(refresh_token, decoded.id);

    if (!tokenData) {
      return res.status(401).json({
        status: 'error',
        code: 'REFRESH_TOKEN_INVALID',
        message: 'Токен не знайдено або він був відкликаний',
      });
    }

    // Перевіряємо, чи не закінчився термін діїї токена
    const tokenExpiry = new Date(tokenData.expires_at);
    if (tokenExpiry < new Date()) {
      return res.status(401).json({
        status: 'error',
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Термін діїї refresh token закінчився',
      });
    }

    // Отримуємо інформацію про користувача
    const user = await db
      .prepare('SELECT id, email, phone, role FROM users WHERE id = ?')
      .get(decoded.id);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: 'Користувача не знайдено',
      });
    }

    // Визначаємо ідентифікатор користувача (email або телефон)
    const identifier = user.email || user.phone;

    // Генеруємо нову пару токенів для ротації
    // Це підвищує безпеку, оскільки старий refresh token стає недійсним
    const tokenPair = generateTokenPair(user.id, user.role, identifier);

    // Позначаємо старий токен як відкликаний
    await db.prepare('UPDATE refresh_tokens SET is_revoked = 1 WHERE token = ?').run(refresh_token);
    await insertRefreshToken(user.id, tokenPair.refreshToken);

    res.json({
      status: 'success',
      token: tokenPair.accessToken,
      refresh_token: tokenPair.refreshToken,
      token_type: 'Bearer',
      expires_in: tokenPair.expiresIn,
    });
  } catch (err) {
    console.error('[Auth] Token refresh error:', err);
    res.status(500).json({
      status: 'error',
      code: 'SERVER_ERROR',
      message: 'Помилка сервера при оновленні токена',
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const { refresh_token } = req.body || {};
    if (refresh_token) {
      const db = await getDb();
      await db
        .prepare('UPDATE refresh_tokens SET is_revoked = 1 WHERE token = ?')
        .run(refresh_token);
    }
    res.json({
      status: 'success',
    });
  } catch (err) {
    console.error('[Auth] Logout error:', err);
    res.status(500).json({
      status: 'error',
      code: 'SERVER_ERROR',
      message: 'Помилка сервера при виході',
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const emailRaw = req.body ? req.body.email : null;
    const email = emailRaw && typeof emailRaw === 'string' ? emailRaw.trim() : null;

    if (!email) {
      return res.status(400).json({
        status: 'error',
        code: 'EMAIL_REQUIRED',
        message: 'Необхідно вказати email',
      });
    }

    const user = await getUserByField('email', email);
    const genericResponse = {
      status: 'success',
      message: 'Якщо email існує, ми надіслали лист для скидання пароля',
    };

    if (!user) {
      return res.json(genericResponse);
    }

    const db = await getDb();
    await db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await db
      .prepare(
        `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
         VALUES (?, ?, ?, ?, NULL, ?)`
      )
      .run(crypto.randomUUID(), user.id, tokenHash, expiresAt, new Date().toISOString());

    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
    const resetLink = `${appBaseUrl}/auth/reset-password?token=${encodeURIComponent(
      token
    )}&email=${encodeURIComponent(email)}`;

    if (!mailer.isConfigured()) {
      if (process.env.NODE_ENV !== 'production') {
        return res.json({
          ...genericResponse,
          debug_reset_link: resetLink,
        });
      }
      return res.status(500).json({
        status: 'error',
        code: 'EMAIL_NOT_CONFIGURED',
        message: 'Email не налаштовано на сервері',
      });
    }

    await mailer.sendMail({
      to: email,
      subject: 'Скидання пароля Avtoservis',
      text: `Для скидання пароля перейдіть за посиланням: ${resetLink}\nПосилання дійсне 30 хвилин.`,
      html: `<p>Для скидання пароля натисніть:</p><p><a href="${resetLink}">Скинути пароль</a></p><p>Посилання дійсне 30 хвилин.</p>`,
    });

    return res.json(genericResponse);
  } catch (err) {
    console.error('[Auth] Forgot password error:', err);
    return res.status(500).json({
      status: 'error',
      code: 'SERVER_ERROR',
      message: 'Помилка сервера',
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const emailRaw = req.body ? req.body.email : null;
    const tokenRaw = req.body ? req.body.token : null;
    const newPasswordRaw = req.body ? req.body.newPassword : null;

    const email = emailRaw && typeof emailRaw === 'string' ? emailRaw.trim() : null;
    const token = tokenRaw && typeof tokenRaw === 'string' ? tokenRaw.trim() : null;
    const newPassword =
      newPasswordRaw && typeof newPasswordRaw === 'string' ? newPasswordRaw : null;

    if (!email || !token || !newPassword) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_FIELDS',
        message: 'Необхідно вказати email, token та новий пароль',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        status: 'error',
        code: 'WEAK_PASSWORD',
        message: 'Пароль має бути мінімум 8 символів',
      });
    }

    const user = await getUserByField('email', email);
    if (!user) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_RESET_TOKEN',
        message: 'Недійсний або прострочений токен',
      });
    }

    const db = await getDb();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const nowIso = new Date().toISOString();

    const row = await db
      .prepare(
        `SELECT id, expires_at, used_at FROM password_reset_tokens
         WHERE user_id = ? AND token_hash = ? LIMIT 1`
      )
      .get(user.id, tokenHash);

    if (!row || row.used_at) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_RESET_TOKEN',
        message: 'Недійсний або прострочений токен',
      });
    }

    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({
        status: 'error',
        code: 'RESET_TOKEN_EXPIRED',
        message: 'Токен прострочений',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await db
      .prepare('UPDATE users SET password = ?, updated_at = ? WHERE id = ?')
      .run(hashedPassword, nowIso, user.id);
    await db
      .prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?')
      .run(nowIso, row.id);
    await db.prepare('UPDATE refresh_tokens SET is_revoked = 1 WHERE user_id = ?').run(user.id);

    return res.json({
      status: 'success',
      message: 'Пароль успішно змінено',
    });
  } catch (err) {
    console.error('[Auth] Reset password error:', err);
    return res.status(500).json({
      status: 'error',
      code: 'SERVER_ERROR',
      message: 'Помилка сервера',
    });
  }
};

// Контролер для генерації секрету 2FA
exports.generateTwoFactorSecret = async (req, res) => {
  try {
    // Отримуємо користувача
    const db = await getDb();
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Користувача не знайдено' });
    }

    // Генеруємо секрет
    const secret = speakeasy.generateSecret({
      name: `Avtoservis:${user.email}`,
    });

    // Зберігаємо секрет тимчасово (він буде активований після підтвердження)
    await db
      .prepare('UPDATE users SET two_factor_secret = ?, two_factor_pending = 1 WHERE id = ?')
      .run(secret.base32, req.user.id);

    // Генеруємо QR-код
    QRCode.toDataURL(secret.otpauth_url, (err, dataUrl) => {
      if (err) {
        return res.status(500).json({ message: 'Помилка генерації QR-коду' });
      }

      res.json({
        secret: secret.base32,
        qrCode: dataUrl,
      });
    });
  } catch (err) {
    console.error('Generate 2FA secret error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Контролер для верифікації та активації 2FA
exports.verifyAndEnableTwoFactor = async (req, res) => {
  try {
    const { token } = req.body;

    // Отримуємо користувача
    const db = await getDb();
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Користувача не знайдено' });
    }

    // Перевіряємо токен
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!verified) {
      return res.status(400).json({ message: 'Невірний код верифікації' });
    }

    // Активуємо 2FA
    await db
      .prepare('UPDATE users SET two_factor_enabled = 1, two_factor_pending = 0 WHERE id = ?')
      .run(req.user.id);

    res.json({
      message: 'Двофакторну автентифікацію успішно активовано',
      twoFactorEnabled: true,
    });
  } catch (err) {
    console.error('Verify and enable 2FA error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Контролер для відключення 2FA
exports.disableTwoFactor = async (req, res) => {
  try {
    const { password } = req.body;

    // Отримуємо користувача
    const db = await getDb();
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Користувача не знайдено' });
    }

    // Перевіряємо пароль
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Невірний пароль' });
    }

    // Відключаємо 2FA
    await db
      .prepare(
        'UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL, two_factor_pending = 0 WHERE id = ?'
      )
      .run(req.user.id);

    res.json({
      message: 'Двофакторну автентифікацію відключено',
      twoFactorEnabled: false,
    });
  } catch (err) {
    console.error('Disable 2FA error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};
