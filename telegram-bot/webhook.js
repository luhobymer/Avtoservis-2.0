const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const BOT_MODE = (process.env.BOT_MODE || 'polling').toLowerCase();
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'change-me-secret';

// Middleware для обробки JSON
app.use(express.json());
// Безпека: заголовки
app.use(helmet());
// Безпека: ліміт запитів
const limiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
app.use(limiter);

// Якщо режим не webhook — попереджаємо в логах, але все одно ініціалізуємо сервер (для health/status)
if (BOT_MODE !== 'webhook') {
  console.warn(`BOT_MODE='${BOT_MODE}' — сервер вебхука запущено лише для health/status. Обробка оновлень Telegram вимкнена.`);
}

// Налаштування бота з вебхуком (тільки в режимі webhook)
let bot = null;
const WEBHOOK_URL = process.env.WEBHOOK_URL || `https://your-domain.com/telegram`;
const webhookPath = `/webhook/${WEBHOOK_SECRET}`;
if (BOT_MODE === 'webhook') {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  // Валідaція налаштувань вебхука
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN не задано. Завершення роботи.');
    process.exit(1);
  }
  if (!WEBHOOK_URL || !/^https:\/\//i.test(WEBHOOK_URL)) {
    console.error('❌ WEBHOOK_URL має бути публічним HTTPS-URL. Напр.: https://bot.example.com/telegram');
    process.exit(1);
  }
  if (!WEBHOOK_SECRET || WEBHOOK_SECRET === 'change-me-secret') {
    console.error('❌ WEBHOOK_SECRET має бути нестандартним та складним. Задайте змінну середовища.');
    process.exit(1);
  }

  bot = new TelegramBot(token, {
    webHook: { port: PORT }
  });
  bot.setWebHook(`${WEBHOOK_URL}${webhookPath}`, { drop_pending_updates: true });
}

// Ендпоінт для вебхуку
app.post(webhookPath, (req, res) => {
  // Якщо режим не webhook — ігноруємо оновлення
  if (BOT_MODE !== 'webhook' || !bot) {
    return res.sendStatus(404);
  }
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Health check ендпоінт
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Статус бота
app.get('/status', async (req, res) => {
  try {
    const botInfo = bot ? await bot.getMe() : null;
    res.json({
      status: 'running',
      bot: botInfo || { note: 'bot not initialized in non-webhook mode' },
      webhook: {
        url: WEBHOOK_URL,
        path: webhookPath,
        enabled: BOT_MODE === 'webhook'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running on port ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log(`🔎 Status: http://localhost:${PORT}/status`);
  if (BOT_MODE === 'webhook') {
    console.log(`🔗 Webhook URL: ${WEBHOOK_URL}${webhookPath}`);
  } else {
    console.log(`ℹ️ BOT_MODE='${BOT_MODE}'. Вебхук-ендпоінт вимкнено (тільки health/status).`);
  }
});

module.exports = { app, bot };