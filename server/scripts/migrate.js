require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const logger = require('../middleware/logger');

async function runMigrations() {
  let pool;

  try {
    // Отримуємо URL бази даних з Supabase URL
    const supabaseUrl = new URL(process.env.SUPABASE_URL);
    const host = supabaseUrl.hostname;
    const database = host.split('.')[0];

    // Створюємо пул з'єднань до бази даних
    pool = new Pool({
      host,
      database,
      port: 5432,
      user: 'postgres',
      password: process.env.SUPABASE_SERVICE_ROLE_KEY,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    // Отримуємо всі файли міграцій
    const migrationsDir = path.join(__dirname, '../../supabase/migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    // Створюємо таблицю міграцій, якщо вона не існує
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Отримуємо виконані міграції
    const { rows: migrationTable } = await pool.query('SELECT name FROM migrations');
    const completedMigrations = migrationTable.map((m) => m.name);

    // Виконуємо нові міграції
    for (const file of files) {
      if (!completedMigrations.includes(file)) {
        logger.info(`Виконується міграція: ${file}`);

        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

        // Виконуємо SQL
        await pool.query(sql);

        // Записуємо міграцію як виконану
        await pool.query('INSERT INTO migrations (name) VALUES ($1)', [file]);

        logger.info(`Міграція ${file} успішно виконана`);
      }
    }

    logger.info('Всі міграції успішно виконані');
  } catch (error) {
    logger.error('Помилка виконання міграцій:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

runMigrations();
