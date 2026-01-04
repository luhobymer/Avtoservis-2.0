const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../config/supabaseClient');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { generateTokenPair, verifyRefreshToken } = require('../config/jwt');

/**
 * Контролер для входу користувача в систему
 * Перевіряє облікові дані, підтримує двофакторну автентифікацію
 * та генерує JWT токени для автентифікації
 */
exports.login = async (req, res) => {
  try {
    const { email, password, token2fa, phone } = req.body;

    // Визначаємо, чи використовуємо email чи телефон для авторизації
    const searchField = phone ? 'phone' : 'email';
    const searchValue = phone || email;

    console.log(`[Auth] Login attempt for ${searchField}:`, searchValue);

    // Перевіряємо користувача
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq(searchField, searchValue)
      .single();

    if (error || !users) {
      console.log(`[Auth] Login failed - user not found: ${searchValue}`);
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_CREDENTIALS',
        message: 'Невірні дані для входу',
      });
    }

    // Перевіряємо пароль
    const isMatch = await bcrypt.compare(password, users.password_hash);
    if (!isMatch) {
      console.log(`[Auth] Login failed - invalid password for user: ${searchValue}`);
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_CREDENTIALS',
        message: 'Невірні дані для входу',
      });
    }

    // Перевіряємо 2FA, якщо воно включено
    if (users.twoFactorEnabled) {
      // Якщо 2FA включено, але токен не надано
      if (!token2fa) {
        console.log('[Auth] 2FA required for user:', email);
        return res.status(200).json({
          status: 'pending',
          code: 'TWO_FACTOR_REQUIRED',
          requireTwoFactor: true,
          message: 'Потрібен код двофакторної автентифікації',
          user: {
            id: users.id,
            email: users.email,
            role: users.role,
            twoFactorEnabled: true,
          },
        });
      }

      // Перевіряємо токен 2FA
      const verified = speakeasy.totp.verify({
        secret: users.twoFactorSecret,
        encoding: 'base32',
        token: token2fa,
        window: 1, // Дозволяє невелике відхилення в часі
      });

      if (!verified) {
        console.log('[Auth] Invalid 2FA token for user:', email);
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_2FA_TOKEN',
          message: 'Невірний код двофакторної автентифікації',
        });
      }

      console.log('[Auth] 2FA verification successful for user:', email);
    }

    // Генеруємо пару токенів
    const tokenPair = generateTokenPair(users.id, users.role, users.email || users.phone);

    // Зберігаємо refresh token у базі даних
    const { error: tokenError } = await supabase.from('refresh_tokens').insert([
      {
        user_id: users.id,
        token: tokenPair.refreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 днів
      },
    ]);

    if (tokenError) {
      console.error('[Auth] Error saving refresh token:', tokenError);
      // Продовжуємо виконання, навіть якщо не вдалося зберегти refresh token
    }

    console.log(`[Auth] Login successful for user: ${searchValue}`);

    // Підготовка даних користувача для відповіді
    const userResponse = {
      id: users.id,
      role: users.role,
      twoFactorEnabled: users.twoFactorEnabled || false,
    };

    // Додаємо email або телефон в залежності від наявності
    if (users.email) userResponse.email = users.email;
    if (users.phone) userResponse.phone = users.phone;

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
    console.log('[Auth] Registration request body:', req.body);
    const { name, email, password, role, phone, firstName, lastName, username } = req.body;

    // Використовуємо ім'я з параметрів або комбінуємо firstName і lastName
    const userName =
      name || (firstName ? (lastName ? `${firstName} ${lastName}` : firstName) : username);

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

    // Логуємо спробу реєстрації
    if (hasEmail) {
      console.log('[Auth] Registration attempt for email:', email);
    } else {
      console.log('[Auth] Registration attempt for phone:', phone);
    }

    // Перевіряємо, чи існує користувач з таким email або телефоном
    let existingUserQuery = supabaseAdmin.from('users').select('*');

    if (hasEmail) {
      existingUserQuery = existingUserQuery.eq('email', email);
    } else if (hasPhone) {
      existingUserQuery = existingUserQuery.eq('phone', phone);
    }

    const { data: existingUser } = await existingUserQuery.single();

    if (existingUser) {
      const identifier = hasEmail ? email : phone;
      const fieldName = hasEmail ? 'email' : 'телефон';
      console.log(`[Auth] Registration failed - ${fieldName} already exists:`, identifier);
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
      password_hash: hashedPassword,
      name: userName,
      role: role || 'client',
    };

    // Додаємо email або телефон в залежності від наявності
    if (hasEmail) userData.email = email;
    if (hasPhone) userData.phone = phone;

    // Логування даних перед вставкою
    console.log('[Auth] Data to insert:', {
      ...userData,
      password_hash: 'HASHED',
    });

    // Створюємо користувача з хешованим паролем
    console.log('[Auth] Creating user with hashed password...');
    const { data: createdUser, error: userError } = await supabaseAdmin
      .from('users')
      .insert([userData])
      .select()
      .single();

    console.log('[Auth] User creation result:', { createdUser, userError });

    // --- АВТОМАТИЧНЕ ПІДТВЕРДЖЕННЯ EMAIL ДЛЯ telegramuser.com ---
    if (createdUser && createdUser.email && createdUser.email.endsWith('@telegramuser.com')) {
      await supabase
        .from('users')
        .update({ email_confirmed_at: new Date().toISOString() })
        .eq('id', createdUser.id);
      console.log('[Auth] Email auto-confirmed for:', createdUser.email);
    }
    // --- КІНЕЦЬ БЛОКУ ---
    if (userError) {
      console.error('[Auth] Registration error:', userError);
      return res.status(500).json({
        status: 'error',
        code: 'USER_CREATION_FAILED',
        message: 'Помилка при створенні користувача',
      });
    }

    if (!createdUser) {
      console.error('[Auth] Registration error: No user data returned');
      return res.status(500).json({
        status: 'error',
        code: 'USER_CREATION_FAILED',
        message: 'Помилка при створенні користувача',
      });
    }

    // Генеруємо пару токенів
    const tokenPair = generateTokenPair(
      createdUser.id,
      createdUser.role,
      createdUser.email || createdUser.phone
    );

    // Зберігаємо refresh token у базі даних
    const { error: tokenError } = await supabase.from('refresh_tokens').insert([
      {
        user_id: createdUser.id,
        token: tokenPair.refreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 днів
      },
    ]);

    if (tokenError) {
      console.error('[Auth] Error saving refresh token:', tokenError);
      // Продовжуємо виконання, навіть якщо не вдалося зберегти refresh token
    }

    const identifier = hasEmail ? email : phone;
    console.log('[Auth] Registration successful for user:', identifier);

    // Підготовка даних користувача для відповіді
    const userResponse = {
      id: createdUser.id,
      role: createdUser.role,
    };

    // Додаємо email або телефон в залежності від наявності
    if (hasEmail) userResponse.email = createdUser.email;
    if (hasPhone) userResponse.phone = createdUser.phone;

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
    console.log('[Auth] Getting current user info for ID:', req.user.id);

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, twoFactorEnabled, created_at')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      console.log('[Auth] User not found for ID:', req.user.id);
      return res.status(404).json({
        status: 'error',
        code: 'USER_NOT_FOUND',
        message: 'Користувача не знайдено',
      });
    }

    console.log('[Auth] Successfully retrieved user info for ID:', req.user.id);
    res.json({
      status: 'success',
      user,
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

    console.log('[Auth] Processing refresh token request');

    // Перевіряємо refresh token
    const decoded = verifyRefreshToken(refresh_token);
    if (!decoded) {
      console.log('[Auth] Invalid refresh token');
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Недійсний або прострочений refresh token',
      });
    }

    // Перевіряємо, чи існує цей токен у базі даних і чи не був відкликаний
    const { data: tokenData, error: tokenError } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token', refresh_token)
      .eq('user_id', decoded.id)
      .eq('is_revoked', false)
      .single();

    if (tokenError || !tokenData) {
      console.log('[Auth] Refresh token not found in database or revoked');
      return res.status(401).json({
        status: 'error',
        code: 'REFRESH_TOKEN_INVALID',
        message: 'Токен не знайдено або він був відкликаний',
      });
    }

    // Перевіряємо, чи не закінчився термін діїї токена
    const tokenExpiry = new Date(tokenData.expires_at);
    if (tokenExpiry < new Date()) {
      console.log('[Auth] Refresh token expired');
      return res.status(401).json({
        status: 'error',
        code: 'REFRESH_TOKEN_EXPIRED',
        message: 'Термін діїї refresh token закінчився',
      });
    }

    // Отримуємо інформацію про користувача
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, phone, role')
      .eq('id', decoded.id)
      .single();

    if (userError || !user) {
      console.log('[Auth] User not found for refresh token');
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
    await supabase.from('refresh_tokens').update({ is_revoked: true }).eq('token', refresh_token);

    // Зберігаємо новий refresh token
    await supabase.from('refresh_tokens').insert([
      {
        user_id: user.id,
        token: tokenPair.refreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]);

    console.log('[Auth] Successfully refreshed token for user ID:', user.id);

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

// Контролер для генерації секрету 2FA
exports.generateTwoFactorSecret = async (req, res) => {
  try {
    // Отримуємо користувача
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      throw error;
    }

    // Генеруємо секрет
    const secret = speakeasy.generateSecret({
      name: `Avtoservis:${user.email}`,
    });

    // Зберігаємо секрет тимчасово (він буде активований після підтвердження)
    const { error: updateError } = await supabase
      .from('users')
      .update({
        twoFactorSecret: secret.base32,
        twoFactorPending: true,
      })
      .eq('id', req.user.id);

    if (updateError) {
      throw updateError;
    }

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
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      throw error;
    }

    // Перевіряємо токен
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!verified) {
      return res.status(400).json({ message: 'Невірний код верифікації' });
    }

    // Активуємо 2FA
    const { error: updateError } = await supabase
      .from('users')
      .update({
        twoFactorEnabled: true,
        twoFactorPending: false,
      })
      .eq('id', req.user.id);

    if (updateError) {
      throw updateError;
    }

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
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      throw error;
    }

    // Перевіряємо пароль
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Невірний пароль' });
    }

    // Відключаємо 2FA
    const { error: updateError } = await supabase
      .from('users')
      .update({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorPending: false,
      })
      .eq('id', req.user.id);

    if (updateError) {
      throw updateError;
    }

    res.json({
      message: 'Двофакторну автентифікацію відключено',
      twoFactorEnabled: false,
    });
  } catch (err) {
    console.error('Disable 2FA error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};
