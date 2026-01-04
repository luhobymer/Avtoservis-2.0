const { Pool } = require('pg');
const logger = require('../middleware/logger');

// Налаштування підключення до PostgreSQL через Supabase
const pool = new Pool({
  host: 'db.pfrhqvzpwburvteiolmh.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function fixRLSPolicy() {
  let client;
  try {
    console.log('Підключення до бази даних...');
    client = await pool.connect();

    console.log('Видалення проблемної RLS політики...');

    // Видаляємо проблемну політику що викликає infinite recursion
    const result = await client.query('DROP POLICY IF EXISTS "Admins can manage users" ON users;');

    console.log('Проблемна RLS політика успішно видалена');
    logger.info('RLS policy removed successfully');
  } catch (err) {
    console.error('Помилка при видаленні політики:', err.message);
    logger.error('RLS policy removal failed:', err);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Запускаємо виправлення
fixRLSPolicy()
  .then(() => {
    console.log('Скрипт завершено');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Скрипт завершився з помилкою:', err);
    process.exit(1);
  });
