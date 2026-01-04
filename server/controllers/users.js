const supabase = require('../config/supabase.js');
const jwt = require('jsonwebtoken');
const { generateTokenPair } = require('../config/jwt');
const logger = require('../middleware/logger.js');
const bcrypt = require('bcryptjs');

// Оновлення профілю користувача
const updateUserProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('users')
      .update({ name, phone })
      .eq('id', userId)
      .select();

    if (error) {
      logger.error('Помилка оновлення профілю:', error);
      return res.status(400).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      message: 'Профіль успішно оновлено',
      user: data[0],
    });
  } catch (error) {
    logger.error('Помилка при оновленні профілю:', error);
    res.status(500).json({
      success: false,
      error: 'Внутрішня помилка сервера',
    });
  }
};

// Логін користувача
const loginUser = async (req, res) => {
  logger.info('Початок обробки запиту на логін');
  console.log('[loginUser] Отримано запит на логін:', { email: req.body?.email });

  // Перевірка наявності JWT_SECRET
  if (!process.env.JWT_SECRET) {
    logger.error('JWT_SECRET не знайдено в змінних середовища');
    console.error('[loginUser] Відсутній JWT_SECRET');
    return res.status(500).json({
      success: false,
      error: 'Помилка конфігурації сервера',
      details: 'Відсутній ключ JWT',
    });
  }

  // Перевірка наявності email та password
  const { email, password } = req.body;
  if (!email || !password) {
    logger.warn('Спроба логіну без email або password');
    return res.status(400).json({
      success: false,
      error: "Відсутні обов'язкові поля",
      details: "Email та пароль обов'язкові",
    });
  }

  try {
    // Знаходимо користувача в базі даних
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError || !user) {
      logger.warn('Користувач не знайдений:', email);
      return res.status(401).json({ success: false, error: 'Неправильний email або пароль' });
    }

    // Перевіряємо пароль
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      logger.warn('Неправильний пароль для користувача:', email);
      return res.status(401).json({ success: false, error: 'Неправильний email або пароль' });
    }

    // Генеруємо JWT токен
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

    logger.info('Успішний логін користувача:', email);
    console.log('[loginUser] Успішна автентифікація для:', email);

    // Повертаємо успішну відповідь з токеном
    return res.status(200).json({
      success: true,
      message: 'Успішний логін',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (error) {
    logger.error('Помилка при логіні:', error);
    console.error('[loginUser] Помилка:', error);
    return res.status(500).json({ success: false, error: 'Внутрішня помилка сервера' });
  }
};

// Отримання профілю користувача
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, phone, role, created_at')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Помилка отримання профілю:', error);
      return res.status(400).json({ success: false, error: error.message });
    }

    if (!data) {
      return res.status(404).json({ success: false, error: 'Користувач не знайдений' });
    }

    res.json({
      success: true,
      user: data,
    });
  } catch (error) {
    logger.error('Помилка при отриманні профілю:', error);
    res.status(500).json({
      success: false,
      error: 'Внутрішня помилка сервера',
    });
  }
};

// Реєстрація користувача
const registerUser = async (req, res) => {
  logger.info('Початок обробки запиту на реєстрацію');
  console.log('[registerUser] Отримано запит на реєстрацію:', {
    email: req.body?.email,
    role: req.body?.role,
  });

  const { email, password, name, role } = req.body;

  // Перевірка обов'язкових полів
  if (!email || !password || !name || !role) {
    logger.warn("Спроба реєстрації без обов'язкових полів");
    return res.status(400).json({ success: false, error: "Відсутні обов'язкові поля" });
  }

  try {
    // Перевіряємо, чи користувач вже існує
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      logger.warn('Спроба реєстрації з існуючим email:', email);
      return res.status(400).json({ success: false, error: 'Користувач з таким email вже існує' });
    }

    // Хешуємо пароль
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Створюємо користувача напряму в таблиці
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          email,
          password_hash: hashedPassword,
          name,
          role,
          phone: req.body.phone || null,
        },
      ])
      .select()
      .single();

    if (insertError) {
      logger.error('Помилка створення користувача:', insertError);
      return res.status(500).json({ success: false, error: 'Помилка створення користувача' });
    }

    logger.info('Користувач успішно зареєстрований:', email);
    console.log('[registerUser] Успішна реєстрація для:', email);

    return res.status(201).json({
      success: true,
      message: 'Користувач успішно зареєстрований',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        phone: newUser.phone,
      },
    });
  } catch (error) {
    logger.error('Помилка при реєстрації:', error);
    console.error('[registerUser] Помилка:', error);
    return res.status(500).json({ success: false, error: 'Внутрішня помилка сервера' });
  }
};

module.exports = { updateUserProfile, loginUser, getUserProfile, registerUser };
