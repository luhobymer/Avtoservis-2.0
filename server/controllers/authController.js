const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { OAuth2Client } = require('google-auth-library');
const { generateTokenPair, verifyRefreshToken } = require('../config/jwt');
const { getDb } = require('../db/d1');
const mailer = require('../services/mailer');

const allowedUserFields = new Set(['email', 'phone', 'id']);
let googleClient = null;

const normalizeRole = (value) => (value == null ? '' : String(value).trim().toLowerCase());
const normalizePhone = (value) => {
  if (!value) return null;
  const raw = String(value).trim().replace(/\s+/g, '');
  if (raw.startsWith('0')) {
    return '+380' + raw.slice(1);
  }
  if (raw.startsWith('380')) {
    return '+' + raw;
  }
  return raw;
};
const isPhoneValid = (value) => {
  if (!value) return false;
  const raw = String(value).trim().replace(/\s+/g, '');
  return /^(\+?380|0)\d{9}$/.test(raw);
};
const isRoleAllowed = (role) => {
  const normalized = normalizeRole(role);
  return normalized === 'client' || normalized === 'master';
};
const isProfileComplete = (user) => {
  if (!user) return false;
  const role = normalizeRole(user.role);
  if (!isRoleAllowed(role)) return false;
  const firstName = user.first_name || user.firstName || null;
  const lastName = user.last_name || user.lastName || null;
  const region = user.region || null;
  const city = user.city || null;
  const phone = user.phone || null;
  if (!firstName || !lastName || !region || !city || !phone) return false;
  return true;
};

const getGoogleClientIds = () => {
  const ids = [];
  const raw = process.env.GOOGLE_CLIENT_ID;
  if (raw) {
    ids.push(
      ...String(raw)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    );
  }
  const envIds = [
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
  ];
  envIds
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .forEach((value) => ids.push(value));
  return Array.from(new Set(ids));
};

const getGoogleClient = () => {
  if (!googleClient) {
    const ids = getGoogleClientIds();
    googleClient = new OAuth2Client(ids[0] || undefined);
  }
  return googleClient;
};

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
    const { password, token2fa, identifier } = req.body;
    const email = req.body.email ? req.body.email.trim() : null;
    const phone = req.body.phone ? req.body.phone.trim() : null;

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

    const requiresEmailConfirmation =
      Boolean(user.email) &&
      Boolean(user.email_verification_token_hash) &&
      Number(user.email_verified || 0) !== 1;

    if (requiresEmailConfirmation) {
      return res.status(403).json({
        status: 'error',
        code: 'EMAIL_NOT_VERIFIED',
        requiresEmailConfirmation: true,
        message: 'Потрібно підтвердити email перед входом',
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

exports.googleLogin = async (req, res) => {
  try {
    const { idToken, token2fa } = req.body || {};
    if (!idToken) {
      return res.status(400).json({
        status: 'error',
        code: 'GOOGLE_TOKEN_REQUIRED',
        message: 'Необхідно надати Google token',
      });
    }

    const clientIds = getGoogleClientIds();
    if (!clientIds.length) {
      return res.status(500).json({
        status: 'error',
        code: 'GOOGLE_CLIENT_NOT_CONFIGURED',
        message: 'Google автентифікація не налаштована на сервері',
      });
    }

    const ticket = await getGoogleClient().verifyIdToken({
      idToken,
      audience: clientIds,
    });
    const payload = ticket?.getPayload() || {};
    const email = payload.email ? String(payload.email).trim() : null;

    if (!email) {
      return res.status(400).json({
        status: 'error',
        code: 'GOOGLE_EMAIL_REQUIRED',
        message: 'Не вдалося отримати email з Google',
      });
    }

    if (payload.email_verified === false) {
      return res.status(403).json({
        status: 'error',
        code: 'GOOGLE_EMAIL_NOT_VERIFIED',
        message: 'Email Google не підтверджений',
      });
    }

    let user = await getUserByField('email', email);

    if (!user) {
      const now = new Date().toISOString();
      const firstName =
        payload.given_name && String(payload.given_name).trim()
          ? String(payload.given_name).trim()
          : null;
      const lastName =
        payload.family_name && String(payload.family_name).trim()
          ? String(payload.family_name).trim()
          : null;
      const userName =
        payload.name && String(payload.name).trim()
          ? String(payload.name).trim()
          : [firstName, lastName].filter(Boolean).join(' ').trim() || 'Користувач';
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), salt);
      const createdUserId = crypto.randomUUID();
      const db = await getDb();
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
          email_verified,
          email_verification_token_hash,
          email_verification_expires_at,
          email_verified_at,
          created_at,
          updated_at
        )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, NULL, NULL, ?, ?, ?)`
        )
        .run(
          createdUserId,
          email,
          hashedPassword,
          'client',
          userName || null,
          null,
          firstName,
          lastName,
          null,
          null,
          null,
          1,
          now,
          now,
          now
        );
      user = await db
        .prepare(
          'SELECT id, email, phone, role, name, first_name, last_name, patronymic, region, city, two_factor_enabled FROM users WHERE id = ?'
        )
        .get(createdUserId);
    } else if (payload.email_verified && Number(user.email_verified || 0) !== 1) {
      const now = new Date().toISOString();
      const db = await getDb();
      await db
        .prepare(
          'UPDATE users SET email_verified = 1, email_verification_token_hash = NULL, email_verification_expires_at = NULL, email_verified_at = ?, updated_at = ? WHERE id = ?'
        )
        .run(now, now, user.id);
    }

    if (user && user.two_factor_enabled) {
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

    if (!user) {
      return res.status(500).json({
        status: 'error',
        code: 'USER_CREATE_FAILED',
        message: 'Не вдалося створити користувача',
      });
    }

    const identifier = user.email || user.phone;
    const tokenPair = generateTokenPair(user.id, user.role, identifier);
    try {
      await insertRefreshToken(user.id, tokenPair.refreshToken);
    } catch (tokenError) {
      console.error('[Auth] Error saving refresh token:', tokenError);
    }

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

    const profileComplete = isProfileComplete(user);
    const googleProfile = {
      email,
      name: payload.name || user.name || null,
      firstName: payload.given_name || user.first_name || null,
      lastName: payload.family_name || user.last_name || null,
    };

    return res.json({
      status: 'success',
      token: tokenPair.accessToken,
      refresh_token: tokenPair.refreshToken,
      token_type: 'Bearer',
      expires_in: tokenPair.expiresIn,
      user: userResponse,
      requireProfileSetup: !profileComplete,
      googleProfile,
    });
  } catch (err) {
    console.error('[Auth] Google login error:', err);
    return res.status(500).json({
      status: 'error',
      code: 'SERVER_ERROR',
      message: 'Помилка сервера при Google автентифікації',
    });
  }
};

exports.completeGoogleProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = normalizeRole(req.body?.role);
    const firstName = req.body?.firstName ? String(req.body.firstName).trim() : '';
    const lastName = req.body?.lastName ? String(req.body.lastName).trim() : '';
    const patronymic = req.body?.patronymic ? String(req.body.patronymic).trim() : '';
    const region = req.body?.region ? String(req.body.region).trim() : '';
    const city = req.body?.city ? String(req.body.city).trim() : '';
    const phoneRaw = req.body?.phone ? String(req.body.phone).trim() : '';

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        code: 'UNAUTHORIZED',
        message: 'Необхідна авторизація',
      });
    }

    if (!isRoleAllowed(role)) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_ROLE',
        message: 'Невірна роль',
      });
    }

    if (!firstName || !lastName || !region || !city) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_REQUIRED_FIELDS',
        message: 'Заповніть обовʼязкові поля профілю',
      });
    }

    if (!isPhoneValid(phoneRaw)) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_PHONE',
        message: 'Невірний формат телефону',
      });
    }

    const phone = normalizePhone(phoneRaw);
    const fullName = [firstName, lastName, patronymic].filter(Boolean).join(' ').trim();

    const db = await getDb();
    await db
      .prepare(
        `UPDATE users SET role = ?, name = ?, phone = ?, first_name = ?, last_name = ?, patronymic = ?, region = ?, city = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        role,
        fullName || null,
        phone,
        firstName,
        lastName,
        patronymic || null,
        region,
        city,
        new Date().toISOString(),
        userId
      );

    const user = await db
      .prepare(
        'SELECT id, email, name, phone, role, first_name, last_name, patronymic, region, city, two_factor_enabled FROM users WHERE id = ?'
      )
      .get(userId);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: 'Користувача не знайдено',
      });
    }

    const identifier = user.email || user.phone;
    const tokenPair = generateTokenPair(user.id, user.role, identifier);
    try {
      await insertRefreshToken(user.id, tokenPair.refreshToken);
    } catch (tokenError) {
      console.error('[Auth] Error saving refresh token:', tokenError);
    }

    return res.json({
      status: 'success',
      token: tokenPair.accessToken,
      refresh_token: tokenPair.refreshToken,
      token_type: 'Bearer',
      expires_in: tokenPair.expiresIn,
      user: {
        id: user.id,
        role: user.role,
        name: user.name || null,
        email: user.email || null,
        phone: user.phone || null,
        firstName: user.first_name || null,
        lastName: user.last_name || null,
        patronymic: user.patronymic || null,
        region: user.region || null,
        city: user.city || null,
        twoFactorEnabled: !!user.two_factor_enabled,
      },
    });
  } catch (err) {
    console.error('[Auth] Complete Google profile error:', err);
    return res.status(500).json({
      status: 'error',
      code: 'SERVER_ERROR',
      message: 'Помилка сервера при оновленні профілю',
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
      password,
      role,
      phone: rawPhone,
      email: rawEmail,
      firstName,
      lastName,
      patronymic,
      region,
      city,
      username,
    } = req.body;

    const email = rawEmail ? rawEmail.trim() : null;
    const phone = rawPhone ? rawPhone.trim() : null;

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

    const hasAppBaseUrl = Boolean(process.env.APP_BASE_URL);
    const appBaseUrl = hasAppBaseUrl
      ? String(process.env.APP_BASE_URL).trim()
      : 'http://localhost:5173';

    const requiresEmailConfirmation = Boolean(hasEmail);
    const verificationTokenPlain = requiresEmailConfirmation
      ? crypto.randomBytes(32).toString('hex')
      : null;
    const verificationTokenHash = verificationTokenPlain
      ? crypto.createHash('sha256').update(verificationTokenPlain).digest('hex')
      : null;
    const verificationExpiresAt = verificationTokenPlain
      ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null;

    const verificationLink =
      verificationTokenPlain && hasEmail
        ? `${appBaseUrl.replace(/\/$/, '')}/auth/verify-email?email=${encodeURIComponent(email)}&token=${encodeURIComponent(verificationTokenPlain)}`
        : null;

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
      email_verified: requiresEmailConfirmation ? 0 : 1,
      email_verification_token_hash: verificationTokenHash,
      email_verification_expires_at: verificationExpiresAt,
      email_verified_at: null,
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
        email_verified,
        email_verification_token_hash,
        email_verification_expires_at,
        email_verified_at,
        created_at,
        updated_at
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)`
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
        userData.email_verified,
        userData.email_verification_token_hash,
        userData.email_verification_expires_at,
        userData.email_verified_at,
        now,
        now
      );

    const createdUser = await db
      .prepare(
        'SELECT id, email, phone, role, name, first_name, last_name, patronymic, region, city FROM users WHERE id = ?'
      )
      .get(createdUserId);
    if (requiresEmailConfirmation && verificationLink) {
      try {
        if (mailer.isConfigured()) {
          await mailer.sendMail({
            to: createdUser.email,
            subject: 'Підтвердження реєстрації',
            text: `Дякуємо за реєстрацію. Для підтвердження email відкрийте посилання: ${verificationLink}`,
            html: `<p>Дякуємо за реєстрацію.</p><p>Для підтвердження email відкрийте посилання:</p><p><a href="${verificationLink}">${verificationLink}</a></p>`,
          });
        }
      } catch (mailError) {
        console.error('[Auth] Email verification send failed:', mailError?.message || mailError);
      }
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

    if (requiresEmailConfirmation) {
      return res.status(201).json({
        status: 'success',
        requiresEmailConfirmation: true,
        message: 'Реєстрація успішна. Підтвердіть email, щоб увійти в систему.',
        verificationLink:
          mailer.isConfigured() || process.env.NODE_ENV === 'production'
            ? undefined
            : verificationLink,
      });
    }

    const tokenPair = generateTokenPair(
      createdUser.id,
      createdUser.role,
      createdUser.email || createdUser.phone
    );

    try {
      await insertRefreshToken(createdUser.id, tokenPair.refreshToken);
    } catch (tokenError) {
      console.error('[Auth] Error saving refresh token:', tokenError);
    }

    return res.status(201).json({
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

exports.verifyEmail = async (req, res) => {
  try {
    const { email, token } = req.body || {};
    const normalizedEmail = email && typeof email === 'string' ? email.trim() : null;
    const normalizedToken = token && typeof token === 'string' ? token.trim() : null;

    if (!normalizedEmail || !normalizedToken) {
      return res.status(400).json({
        status: 'error',
        code: 'MISSING_TOKEN',
        message: 'Необхідно надати email та токен підтвердження',
      });
    }

    const tokenHash = crypto.createHash('sha256').update(normalizedToken).digest('hex');
    const db = await getDb();
    let user = await db
      .prepare(
        'SELECT id, email, email_verified, email_verification_token_hash, email_verification_expires_at FROM users WHERE lower(email) = lower(?) LIMIT 1'
      )
      .get(normalizedEmail);

    // Якщо користувача не знайдено за trimmed email, спробуємо знайти за оригінальним (на випадок, якщо при реєстрації потрапив пробіл)
    if (!user && email !== normalizedEmail) {
      user = await db
        .prepare(
          'SELECT id, email, email_verified, email_verification_token_hash, email_verification_expires_at FROM users WHERE lower(email) = lower(?) LIMIT 1'
        )
        .get(email);
    }

    if (!user) {
      return res.status(404).json({
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: 'Користувача не знайдено',
      });
    }

    if (Number(user.email_verified || 0) === 1) {
      return res.json({
        status: 'success',
        message: 'Email вже підтверджено',
      });
    }

    if (
      !user.email_verification_token_hash ||
      String(user.email_verification_token_hash) !== tokenHash
    ) {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_TOKEN',
        message: 'Недійсний токен підтвердження',
      });
    }

    if (user.email_verification_expires_at) {
      const expiry = new Date(user.email_verification_expires_at);
      if (Number.isNaN(expiry.getTime()) || expiry < new Date()) {
        return res.status(400).json({
          status: 'error',
          code: 'TOKEN_EXPIRED',
          message: 'Термін дії токена підтвердження закінчився',
        });
      }
    }

    const now = new Date().toISOString();

    // Спробуємо виправити email в базі, якщо він містить пробіли
    let emailToUpdate = null;
    if (user.email && user.email !== user.email.trim()) {
      const trimmed = user.email.trim();
      const conflict = await db
        .prepare('SELECT id FROM users WHERE lower(email) = lower(?) AND id != ?')
        .get(trimmed, user.id);
      if (!conflict) {
        emailToUpdate = trimmed;
      }
    }

    if (emailToUpdate) {
      await db
        .prepare(
          'UPDATE users SET email_verified = 1, email_verification_token_hash = NULL, email_verification_expires_at = NULL, email_verified_at = ?, updated_at = ?, email = ? WHERE id = ?'
        )
        .run(now, now, emailToUpdate, user.id);
    } else {
      await db
        .prepare(
          'UPDATE users SET email_verified = 1, email_verification_token_hash = NULL, email_verification_expires_at = NULL, email_verified_at = ?, updated_at = ? WHERE id = ?'
        )
        .run(now, now, user.id);
    }

    return res.json({
      status: 'success',
      message: 'Email підтверджено. Тепер можна увійти.',
    });
  } catch (err) {
    console.error('[Auth] Verify email error:', err);
    return res.status(500).json({
      status: 'error',
      code: 'SERVER_ERROR',
      message: 'Помилка сервера при підтвердженні email',
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
