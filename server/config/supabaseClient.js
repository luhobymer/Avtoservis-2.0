require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const logger = require('../middleware/logger.js');

// Validate environment variables
if (!process.env.SUPABASE_URL) {
  logger.error('Supabase URL not found in environment variables');
  process.exit(1);
}

if (!process.env.SUPABASE_ANON_KEY) {
  logger.error('Supabase anon key not found in environment variables');
  logger.info(
    'Available environment variables:',
    Object.keys(process.env).filter((key) => key.includes('SUPABASE'))
  );
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

// Initialize Supabase client with enhanced configuration
logger.info(`Initializing Supabase client with URL: ${supabaseUrl}`);
logger.info('[supabaseClient] Ініціалізація клієнта Supabase:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseKey,
  keyLength: supabaseKey?.length,
});

// Клієнт з анонімним ключем для звичайних операцій
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'x-application-name': 'avtoservis',
    },
  },
  // Додаємо обробку помилок
  debug: process.env.NODE_ENV === 'development',
});

// Перевірка, чи клієнт створено успішно
if (!supabase || !supabase.auth) {
  logger.error('Помилка створення клієнта Supabase');
  logger.error('[supabaseClient] Критична помилка: клієнт Supabase не ініціалізовано');
  process.exit(1);
}

// Test connection and auth setup (із ретраями для стабільності)
(async () => {
  try {
    logger.info('[supabaseClient] Тестування підключення до бази даних...');

    const maxRetries = 3;
    const baseDelayMs = 500;
    let connected = false;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const { error: dbError } = await supabase.from('vehicles').select('count').single();

        if (dbError) throw dbError;
        logger.info('[supabaseClient] Підключення до бази даних успішне');
        connected = true;
        break;
      } catch (err) {
        lastError = err;
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        logger.warn(
          `[supabaseClient] Спроба ${attempt}/${maxRetries} не вдалася: ${err.message}. Повтор через ${delay}мс`
        );
        await new Promise((res) => setTimeout(res, delay));
      }
    }

    if (!connected) {
      logger.error('Supabase database connection test failed after retries:', lastError);
      logger.error('[supabaseClient] Помилка підключення до бази даних після ретраїв:', lastError);
      logger.warn('[supabaseClient] Продовжуємо роботу, незважаючи на помилку підключення');
    }

    // Перевірка конфігурації JWT
    if (!process.env.JWT_SECRET) {
      logger.error('JWT_SECRET not found in environment variables');
      logger.error('[supabaseClient] JWT_SECRET не знайдено в змінних середовища');
      // Не завершуємо процес, а лише логуємо помилку
      logger.warn('[supabaseClient] Продовжуємо роботу, але автентифікація може не працювати');
    } else {
      logger.info('[supabaseClient] JWT_SECRET знайдено');
    }

    // Test auth configuration
    logger.info('[supabaseClient] Тестування конфігурації автентифікації...');
    const { error: authError } = await supabase.auth.getSession();

    if (authError) {
      logger.error('Supabase auth configuration test failed:', authError);
      logger.error('[supabaseClient] Помилка конфігурації автентифікації:', authError);
      // Не завершуємо процес, а лише логуємо помилку
      logger.warn('[supabaseClient] Продовжуємо роботу, незважаючи на помилку автентифікації');
    } else {
      logger.info('[supabaseClient] Конфігурація автентифікації успішна');
    }

    logger.info('Supabase connection and auth setup completed');
  } catch (err) {
    logger.error('Critical error during Supabase initialization:', err);
    logger.error('[supabaseClient] Критична помилка під час ініціалізації Supabase:', err);
    // Не завершуємо процес, а лише логуємо помилку
    logger.warn('[supabaseClient] Продовжуємо роботу, незважаючи на помилку ініціалізації');
  }
})();

// Set up auth state change listener
supabase.auth.onAuthStateChange((event, nextSession) => {
  logger.info(`Auth state changed: ${event}`);
  // Перевіряємо, чи доступний localStorage (тільки в браузерному середовищі)
  if (
    event === 'SIGNED_OUT' &&
    typeof globalThis !== 'undefined' &&
    typeof globalThis.localStorage !== 'undefined'
  ) {
    globalThis.localStorage.clear();
  }
});

// Клієнт з сервісним ключем для адміністративних операцій (обходить RLS)
let supabaseAdmin = null;
if (supabaseServiceKey) {
  try {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          'x-application-name': 'avtoservis-admin',
        },
      },
    });
  } catch (err) {
    logger.error('Failed to create Supabase admin client:', err);
    supabaseAdmin = null;
  }
} else {
  logger.warn('SUPABASE_SERVICE_ROLE_KEY not found, admin operations will be limited');
}

// Перевірка підключення адміністративного клієнта
(async () => {
  try {
    if (!supabaseAdmin) {
      logger.warn('Supabase admin client not available');
      return;
    }

    // Простіша перевірка без запиту до бази даних
    if (supabaseAdmin.supabaseUrl && supabaseAdmin.supabaseKey) {
      logger.info('Supabase admin client initialized successfully');
    } else {
      logger.error('Supabase admin client configuration invalid');
    }
  } catch (err) {
    logger.error('Error checking Supabase admin client:', err);
  }
})();

module.exports = { supabase, supabaseAdmin: supabaseAdmin || supabase };
