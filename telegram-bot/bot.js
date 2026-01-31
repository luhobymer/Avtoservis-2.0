const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const moment = require('moment');
const winston = require('winston');
require('dotenv').config();



// Імпорт модулів
const userManager = require('./src/userManager');
const { Validator, ErrorHandler } = require('./src/validator');
const AppointmentFlow = require('./src/appointmentFlow');
const {
  formatLicensePlate,
  normalizeLicensePlate,
  getRequiredFields,
  getMissingFields,
  formatVehicleDataMessage,
} = require('./src/utils/vehicle');

// Налаштування логування
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'telegram-bot' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});


// Конфігурація
const BOT_MODE = process.env.BOT_MODE || 'polling';
const config = {
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  // За замовчуванням використовуємо порт 5001 для локального сервера
  serverUrl: process.env.SERVER_API_URL || 'http://localhost:5001',
  port: process.env.PORT || 3001,
  registryUrl:
    process.env.VEHICLE_REGISTRY_URL ||
    process.env.REGISTRY_API_URL ||
    process.env.SERVER_API_URL ||
    'http://localhost:5001'
};

// Перевірка конфігурації
if (!config.telegramToken) {
  logger.error('TELEGRAM_BOT_TOKEN не вказано в .env файлі');
  process.exit(1);
}

// Якщо режим не polling — не запускаємо цей процес, щоб не дублювати відповіді з webhook-сервером
if (BOT_MODE !== 'polling') {
  console.warn(`BOT_MODE='${BOT_MODE}' — bot.js не запускає polling. Використовуйте webhook.js для режиму webhook.`);
  process.exit(0);
}

// Ініціалізація бота (без миттєвого старту polling)
const bot = new TelegramBot(config.telegramToken, {
  polling: false,
  request: {
    agentOptions: {
      rejectUnauthorized: false
    }
  }
});

// Видаляємо вебхук та явно запускаємо polling
(async () => {
  try {
    await bot.deleteWebHook({ drop_pending_updates: true });
    await bot.startPolling({
      timeout: 30,
      params: { timeout: 30 }
    });
    logger.info('✅ Webhook видалено. Polling запущено.');
  } catch (e) {
    logger.error('❌ Не вдалося запустити polling після видалення вебхука:', e);
    process.exit(1);
  }
})();

// Ініціалізація API клієнта
const apiClient = axios.create({
  baseURL: config.serverUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Додавання API ключа до запитів
apiClient.interceptors.request.use((config) => {
  const apiKey = process.env.SERVER_API_KEY;
  if (apiKey) {
    config.headers['x-api-key'] = apiKey;
  }
  return config;
});

// Обробка помилок
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    logger.error('API Error:', {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      url: error.config?.url
    });
    return Promise.reject(error);
  }
);

// Ініціалізація потоку запису
const appointmentFlow = new AppointmentFlow(bot, apiClient);

// Сховище тимчасових даних авто під час додавання
const vehicleData = new Map();

// Обробка введення номера авто (вимкнено на користь єдиного обробника 'message' для уникнення дублювань)
bot.onText(/^[A-ZА-ЯІЇЄ0-9]{5,10}$/i, async (msg) => {
  // Вся логіка обробки держномерів тепер у bot.on('message')
  return;
});

// Функція для бронювання сервісу
async function handleBookService(chatId, messageId, vin) {
  try {
    const credentials = await userManager.getServerCredentials(chatId);
    if (!credentials) {
      await bot.editMessageText('❌ Для запису на ТО необхідно авторизуватися', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [[
            { text: '🔑 Авторизуватися', callback_data: 'login' }
          ]]
        }
      });
      return;
    }
    
    // Запускаємо потік запису на ТО з вказаним VIN
    await appointmentFlow.startFlow(chatId, vin);
    
    // Видаляємо повідомлення з деталями автомобіля
    await bot.deleteMessage(chatId, messageId);
  } catch (error) {
    logger.error('Error in handleBookService:', error);
    await bot.editMessageText('❌ Помилка при спробі запису на ТО', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [[
          { text: '⬅️ Назад', callback_data: `vehicle_details_${vin}` }
        ]]
      }
    });
  }
}

// Функція для показу повної історії обслуговування
async function handleFullHistory(chatId, messageId, vin) {
  try {
    const credentials = await userManager.getServerCredentials(chatId);
    const vehicles = await AutoServiceAPI.getUserVehicles(credentials.userId, credentials.token);
    const vehicle = vehicles.find(v => v.vin === vin);

    if (!vehicle) {
      await bot.editMessageText('❌ Автомобіль не знайдено', {
        chat_id: chatId,
        message_id: messageId
      });
      return;
    }

    let message = `📊 <b>Повна історія обслуговування</b>\n\n`;
    message += `🚗 <b>Автомобіль:</b> ${vehicle.make} ${vehicle.model} (${vehicle.year})\n`;
    message += `📋 <b>VIN:</b> <code>${vehicle.vin}</code>\n\n`;

    if (vehicle.service_history && vehicle.service_history.length > 0) {
      message += '🔧 <b>Історія обслуговування:</b>\n\n';
      vehicle.service_history.forEach((service, index) => {
        message += `<b>${index + 1}.</b> ${moment(service.service_date).format('DD.MM.YYYY')}\n`;
        message += `   📝 ${service.description}\n`;
        if (service.cost) {
          message += `   💰 Вартість: ${service.cost} грн\n`;
        }
        if (service.mileage) {
          message += `   🛣️ Пробіг: ${service.mileage.toLocaleString()} км\n`;
        }
        if (service.notes) {
          message += `   📋 Примітки: ${service.notes}\n`;
        }
        message += '\n';
      });
    } else {
      message += '📝 Історія обслуговування відсутня\n\n';
      message += '💡 <b>Рекомендація:</b> Регулярне технічне обслуговування допоможе підтримати ваш автомобіль у відмінному стані.';
    }

    const inlineKeyboard = [
      [{ text: '📋 Записатися на ТО', callback_data: `book_service_${vin}` }],
      [{ text: '⬅️ Назад до деталей', callback_data: `vehicle_details_${vin}` }],
      [{ text: '🏠 Головне меню', callback_data: 'back_to_main' }]
    ];

    await bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  } catch (error) {
    logger.error('Error in handleFullHistory:', error);
    await bot.editMessageText('❌ Помилка при отриманні історії обслуговування', {
      chat_id: chatId,
      message_id: messageId
    });
  }
}

// Функція для показу деталей автомобіля
async function handleVehicleDetails(chatId, messageId, vin) {
  try {
    const credentials = await userManager.getServerCredentials(chatId);
    const vehicles = await AutoServiceAPI.getUserVehicles(credentials.userId, credentials.token);
    const vehicle = vehicles.find(v => v.vin === vin);

    if (!vehicle) {
      await bot.editMessageText('❌ Автомобіль не знайдено', {
        chat_id: chatId,
        message_id: messageId
      });
      return;
    }

    let message = `🚗 <b>${vehicle.make} ${vehicle.model}</b> (${vehicle.year})\n\n`;
    message += `📋 <b>VIN:</b> <code>${vehicle.vin}</code>\n`;
    message += `🎨 <b>Колір:</b> ${vehicle.color || 'не вказано'}\n`;
    if (vehicle.mileage) {
      message += `🛣️ <b>Пробіг:</b> ${vehicle.mileage.toLocaleString()} км\n`;
    }
    message += '\n';

    // Показуємо активні записи
    if (vehicle.appointments && vehicle.appointments.length > 0) {
      const activeAppointments = vehicle.appointments.filter(apt => apt.status === 'pending' || apt.status === 'confirmed');
      if (activeAppointments.length > 0) {
        message += '📅 <b>Активні записи:</b>\n';
        activeAppointments.forEach(apt => {
          message += `• ${moment(apt.scheduled_time).format('DD.MM.YYYY HH:mm')} - ${apt.services?.name || 'Обслуговування'}\n`;
        });
        message += '\n';
      }
    }

    // Показуємо історію обслуговування
    if (vehicle.service_history && vehicle.service_history.length > 0) {
      message += '🔧 <b>Історія обслуговування:</b>\n';
      vehicle.service_history.slice(0, 3).forEach(service => {
        message += `• ${moment(service.service_date).format('DD.MM.YYYY')} - ${service.description}\n`;
        if (service.cost) message += `  💰 ${service.cost} грн\n`;
      });
      if (vehicle.service_history.length > 3) {
        message += `... та ще ${vehicle.service_history.length - 3} записів\n`;
      }
    }

    const inlineKeyboard = [
      [{ text: '📋 Записатися на ТО', callback_data: `book_service_${vin}` }],
      [{ text: '📊 Повна історія', callback_data: `full_history_${vin}` }],
      [{ text: '⬅️ Назад до списку', callback_data: 'back_to_vehicles' }]
    ];

    await bot.editMessageText(message, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: inlineKeyboard }
    });
  } catch (error) {
    logger.error('Error in handleVehicleDetails:', error);
    await bot.editMessageText('❌ Помилка при отриманні деталей автомобіля', {
      chat_id: chatId,
      message_id: messageId
    });
  }
}

// Обробка callback-запитів від інтерактивних кнопок
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const messageId = callbackQuery.message.message_id;

  try {
    // Підтверджуємо отримання callback
    await bot.answerCallbackQuery(callbackQuery.id);

    switch (data) {
      case 'back_to_main':
        const mainKeyboard = await getMainKeyboard(chatId);
        await bot.editMessageText('🏠 Головне меню', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: mainKeyboard.reply_markup
        });
        break;

      case 'add_vehicle':
        // Запускаємо процес додавання автомобіля з держномера
        userStates.set(chatId, 'add_vehicle_license_plate');
        await bot.editMessageText(
          '🚗 <b>Додавання автомобіля</b>\n\n' +
          'Будь ласка, введіть державний номер вашого автомобіля:\n\n' +
          '<i>Приклад: AA1234BB</i>',
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '❌ Скасувати', callback_data: 'back_to_vehicles' }]
              ]
            }
          }
        );
        break;

      case 'back_to_vehicles':
        // Очищаємо дані та стан додавання автомобіля
        if (vehicleData.has(chatId)) {
          vehicleData.delete(chatId);
        }
        if (userStates.has(chatId) && userStates.get(chatId).startsWith('add_vehicle_')) {
          userStates.delete(chatId);
        }
        // Повертаємося до списку автомобілів
        const msg = { chat: { id: chatId } };
        await BotCommands.handleMyVehicles(msg);
        break;
        
      case 'use_existing_vehicle_data':
        // Використовуємо існуючі дані автомобіля
        if (vehicleData.has(chatId)) {
          const carData = vehicleData.get(chatId);
          const user = await userManager.getUser(chatId);
          
          if (user && user.isLinkedToServer()) {
            try {
              // Додаємо автомобіль до облікового запису користувача
              await AutoServiceAPI.addVehicle({
                vin: carData.vin,
                make: carData.make || carData.brand,
                model: carData.model,
                year: carData.year,
                color: carData.color || '',
                mileage: carData.mileage || 0,
                licensePlate: carData.licensePlate || carData.license_plate,
                user_id: user.serverUserId
              }, user.getToken());
              
              // Очищаємо тимчасові дані та стан
              vehicleData.delete(chatId);
              userStates.delete(chatId);
              
              // Повідомляємо про успішне додавання
              await bot.sendMessage(chatId, 
                '✅ Автомобіль успішно додано до вашого облікового запису!',
                await getMainKeyboard(chatId)
              );
              
              // Показуємо оновлений список автомобілів
              await BotCommands.handleMyVehicles({ chat: { id: chatId } });
            } catch (error) {
              logger.error('Error adding vehicle:', error);
              await bot.sendMessage(chatId, 
                '❌ Виникла помилка при додаванні автомобіля. Будь ласка, спробуйте ще раз.',
                await getMainKeyboard(chatId)
              );
            }
          } else {
            await bot.sendMessage(chatId, 
              '❌ Для додавання автомобіля необхідно авторизуватися.',
              { reply_markup: keyboards.auth.reply_markup }
            );
          }
        } else {
          await bot.sendMessage(chatId, 
            '❌ Дані автомобіля не знайдено. Будь ласка, спробуйте ще раз.',
            await getMainKeyboard(chatId)
          );
        }
        break;
        
      case 'enter_new_vehicle_data':
        // Переходимо до введення нових даних, починаючи з VIN-коду
        if (vehicleData.has(chatId)) {
          // Зберігаємо тільки номерний знак, решту даних очищаємо
          const licensePlate = vehicleData.get(chatId).licensePlate;
          vehicleData.set(chatId, { licensePlate });
          
          // Переходимо до введення VIN-коду
          userStates.set(chatId, 'add_vehicle_vin');
          
          await bot.sendMessage(chatId, 
            'Введіть VIN-код вашого автомобіля (17 символів):\n\n' +
            '<i>Приклад: WVWZZZ1KZAM123456</i>', 
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [[
                  { text: '❌ Скасувати', callback_data: 'back_to_vehicles' }
                ]]
              }
            }
          );
        } else {
          await bot.sendMessage(chatId, 
            '❌ Дані автомобіля не знайдено. Будь ласка, спробуйте ще раз.',
            await getMainKeyboard(chatId)
          );
        }
        break;

      case 'complete_missing_vehicle_fields':
        // Починаємо процес дозаповнення відсутніх полів
        if (vehicleData.has(chatId)) {
          const carData = vehicleData.get(chatId);
          const missing = getMissingFields(carData);
          
          if (missing.length === 0) {
            // Усі поля заповнені, можна додавати автомобіль
            await bot.sendMessage(chatId, 
              '✅ Всі необхідні дані вже заповнені!',
              await getMainKeyboard(chatId)
            );
          } else {
            // Почнемо з першого відсутнього поля
            const firstMissing = missing[0];
            await startFillingMissingField(chatId, firstMissing, carData);
          }
        } else {
          await bot.sendMessage(chatId, 
            '❌ Дані автомобіля не знайдено. Будь ласка, спробуйте ще раз.',
            await getMainKeyboard(chatId)
          );
        }
        break;

      // edit_license_plate видалено разом з OCR-функціоналом
        
      default:
        // Обробка вибору автомобіля зі списку знайдених
        if (data.startsWith('select_vehicle_')) {
          const vehicleIndex = parseInt(data.replace('select_vehicle_', ''));
          
          if (vehicleData.has(chatId)) {
            const carData = vehicleData.get(chatId);
            const foundVehicles = carData.foundVehicles;
            
            if (foundVehicles && foundVehicles[vehicleIndex]) {
              const selectedVehicle = foundVehicles[vehicleIndex];
              
              // Зберігаємо обрані дані автомобіля
              Object.assign(carData, selectedVehicle);
              delete carData.foundVehicles; // Очищаємо варіанти
              
              const formattedLicensePlate = formatLicensePlate(selectedVehicle.licensePlate);
              const selectedMissing = getMissingFields({
                vin: selectedVehicle.vin || '',
                make: selectedVehicle.make || selectedVehicle.brand || '',
                brand: selectedVehicle.brand || '',
                model: selectedVehicle.model || '',
                year: selectedVehicle.year || '',
                color: selectedVehicle.color || '',
                mileage: selectedVehicle.mileage || 0,
                licensePlate: selectedVehicle.licensePlate || ''
              });
              const selectedMessage = formatVehicleDataMessage({
                vin: selectedVehicle.vin || '',
                make: selectedVehicle.make || selectedVehicle.brand || '',
                brand: selectedVehicle.brand || '',
                model: selectedVehicle.model || '',
                year: selectedVehicle.year || '',
                color: selectedVehicle.color || '',
                mileage: selectedVehicle.mileage || 0,
                licensePlate: selectedVehicle.licensePlate || ''
              }, selectedMissing);
              
              await bot.editMessageText(
                selectedMessage,
                {
                  chat_id: chatId,
                  message_id: messageId,
                  parse_mode: 'HTML',
                  reply_markup: {
                    inline_keyboard: [
                      [
                        { text: '✅ Використати ці дані', callback_data: 'use_existing_vehicle_data' },
                        ...(selectedMissing.length > 0 ? [{ text: '✏️ Доповнити відсутні', callback_data: 'complete_missing_vehicle_fields' }] : []),
                        { text: '❌ Ввести нові дані', callback_data: 'enter_new_vehicle_data' }
                      ]
                    ]
                  }
                }
              );
            } else {
              await bot.editMessageText(
                '❌ Обраний автомобіль не знайдено. Спробуйте ще раз.',
                {
                  chat_id: chatId,
                  message_id: messageId,
                  reply_markup: {
                    inline_keyboard: [[
                      { text: '🔙 Назад', callback_data: 'back_to_vehicles' }
                    ]]
                  }
                }
              );
            }
          } else {
            await bot.editMessageText(
              '❌ Дані автомобіля не знайдено. Спробуйте ще раз.',
              {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                  inline_keyboard: [[
                    { text: '🔙 Назад', callback_data: 'back_to_vehicles' }
                  ]]
                }
              }
            );
          }
        }
        // Обробка callback-запитів для деталей автомобіля
        else if (data.startsWith('vehicle_details_')) {
          const vin = data.replace('vehicle_details_', '');
          await handleVehicleDetails(chatId, messageId, vin);
        } else if (data.startsWith('book_service_')) {
          const vin = data.replace('book_service_', '');
          await handleBookService(chatId, messageId, vin);
        } else if (data.startsWith('full_history_')) {
          const vin = data.replace('full_history_', '');
          await handleFullHistory(chatId, messageId, vin);
        }
        break;
    }
  } catch (error) {
    logger.error('Error handling callback query:', error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Виникла помилка при обробці запиту',
      show_alert: true
    });
  }
});

// Клавіатури
const keyboards = {
  main: {
    reply_markup: {
      keyboard: [
        ['📋 Мої записи', '🚗 Мої авто'],
        ['➕ Новий запис', '➕ Додати авто'],
        ['🔧 Послуги', '📞 Контакти'],
        ['⚙️ Профіль']
      ],
      resize_keyboard: true
    }
  },

  auth: {
    reply_markup: {
      keyboard: [
        ['🔑 Увійти', '📝 Зареєструватися'],
        ['📞 Контакти']
      ],
      resize_keyboard: true
    }
  },

  profile: {
    reply_markup: {
      keyboard: [
        ['👤 Особисті дані'],
        ['🔔 Сповіщення', '🌐 Мова'],
        ['🔗 Прив\'язати Telegram'],
        ['🚪 Вийти з облікового запису'],
        ['⬅️ Назад']
      ],
      resize_keyboard: true
    }
  },

  back: {
    reply_markup: {
      keyboard: [['⬅️ Назад']],
      resize_keyboard: true
    }
  },

  cancel: {
    reply_markup: {
      keyboard: [['❌ Скасувати']],
      resize_keyboard: true
    }
  },

  remove: {
    reply_markup: { remove_keyboard: true }
  }
};

// Клас для роботи з API
class AutoServiceAPI {
  static async registerUser(userData) {
    // Формуємо дані для реєстрації відповідно до вимог сервера
    const normalizedPhone = normalizePhone(userData.phone);
    
    // Логуємо нормалізований номер для відлагодження
    console.log(`[Bot] Нормалізований номер для реєстрації: ${normalizedPhone}`);
    
    // Перевіряємо, чи номер відповідає українському формату
    if (!/^\+380\d{9}$/.test(normalizedPhone)) {
      console.log(`[Bot] Попередження: номер не відповідає формату +380XXXXXXXXX: ${normalizedPhone}`);
    }
    
    const registerData = {
      email: `${normalizedPhone.replace(/[^0-9]/g, '')}@telegram.local`,
      password: `telegram${normalizedPhone.replace(/[^0-9]/g, '')}`,
      name: userData.firstName + (userData.lastName ? ' ' + userData.lastName : ''),
      phone: normalizedPhone,
      role: 'client' // За замовчуванням роль клієнта
    };
    
    try {
      const response = await apiClient.post('/api/auth/register', registerData);
      console.log(`[Bot] Успішна реєстрація користувача з номером: ${normalizedPhone}`);
      return response.data;
    } catch (error) {
      console.error(`[Bot] Помилка реєстрації користувача з номером ${normalizedPhone}:`, 
                   error.response?.data || error.message);
      throw error;
    }
  }

  static async loginUser(credentials) {
    const normalizedPhone = normalizePhone(credentials.phone);
    
    // Логуємо нормалізований номер для відлагодження
    console.log(`[Bot] Нормалізований номер для входу: ${normalizedPhone}`);
    
    // Перевіряємо, чи номер відповідає українському формату
    if (!/^\+380\d{9}$/.test(normalizedPhone)) {
      console.log(`[Bot] Попередження: номер не відповідає формату +380XXXXXXXXX: ${normalizedPhone}`);
    }
    
    const loginData = {
      email: `${normalizedPhone.replace(/[^0-9]/g, '')}@telegram.local`,
      password: `telegram${normalizedPhone.replace(/[^0-9]/g, '')}`,
      phone: normalizedPhone
    };
    
    try {
      const response = await apiClient.post('/api/auth/login', loginData);
      console.log(`[Bot] Успішний вхід користувача з номером: ${normalizedPhone}`);
      return response.data;
    } catch (error) {
      console.error(`[Bot] Помилка входу користувача з номером ${normalizedPhone}:`, 
                   error.response?.data || error.message);
      throw error;
    }
  }

  static async getUserAppointments(userId, token) {
    const response = await apiClient.get('/api/appointments', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  }

  static async getUserVehicles(userId, token) {
    const response = await apiClient.get('/api/vehicles', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  }
  
  static async addVehicle(vehicleData, token) {
    const response = await apiClient.post('/api/telegram/vehicles', vehicleData, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  }

  static async getServices() {
    const response = await apiClient.get('/api/telegram/services');
    return response.data;
  }

  static async getServiceStations() {
    const response = await apiClient.get('/api/telegram/stations');
    return response.data;
  }

  static async createAppointment(appointmentData, token) {
    const response = await apiClient.post('/api/telegram/appointments', appointmentData, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  }

  static async getVehicleByLicensePlate(licensePlate) {
    try {
      const encoded = encodeURIComponent(licensePlate);
      const response = await apiClient.get(`/api/vehicles/bot/license/${encoded}`);
      return response.data;
    } catch (error) {
      console.error(`[Bot] Помилка отримання автомобіля за номерним знаком ${licensePlate}:`, 
                   error.response?.data || error.message);
      return null;
    }
  }

  static async getVehicleRegistryByLicensePlate(licensePlate) {
    try {
      const encoded = encodeURIComponent(licensePlate);
      const response = await axios.get(
        `${config.registryUrl}/api/vehicle-registry?license_plate=${encoded}`,
        { timeout: 10000 }
      );
      return response.data;
    } catch (error) {
      console.error(
        `[Bot] Помилка отримання даних реєстру за номерним знаком ${licensePlate}:`,
        error.response?.data || error.message
      );
      return null;
    }
  }

  static async getUserProfile(userId, token) {
    const response = await apiClient.get('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.data;
  }
}

// Функція для динамічного створення головного меню
async function getMainKeyboard(chatId) {
  try {
    const isLinked = await userManager.isUserLinked(chatId);
    
    if (!isLinked) {
      return keyboards.auth;
    }
    
    const credentials = await userManager.getServerCredentials(chatId);
    const vehicles = await AutoServiceAPI.getUserVehicles(credentials.userId, credentials.token);
    
    const hasVehicles = vehicles && vehicles.length > 0;
    
    return {
      reply_markup: {
        keyboard: [
          ['📋 Мої записи', hasVehicles ? '🚗 Мої авто' : '➕ Додати авто'],
          ['➕ Новий запис'],
          ['🔧 Послуги', '📞 Контакти'],
          ['⚙️ Профіль']
        ],
        resize_keyboard: true
      }
    };
  } catch (error) {
    logger.error('Error in getMainKeyboard:', error);
    // Fallback до базової авторизованої клавіатури з "Додати авто" за замовчуванням
    return {
      reply_markup: {
        keyboard: [
          ['📋 Мої записи', '➕ Додати авто'],
          ['➕ Новий запис'],
          ['🔧 Послуги', '📞 Контакти'],
          ['⚙️ Профіль']
        ],
        resize_keyboard: true
      }
    };
  }
}

// Клас команд бота
class BotCommands {
  static async handleStart(msg) {
    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name;

    const isLinked = await userManager.isUserLinked(chatId);
    const welcomeMessage = isLinked 
      ? `🚗 Ласкаво просимо, ${username}!\n\nВи успішно авторизовані в системі.`
      : `🚗 Ласкаво просимо до Автосервісу, ${username}!\n\nЯ ваш персональний помічник для запису на обслуговування автомобіля.`;

    const keyboard = await getMainKeyboard(chatId);
    await bot.sendMessage(chatId, welcomeMessage, keyboard);
  }

  static async handleHelp(msg) {
    const chatId = msg.chat.id;
    
    const helpMessage = `
🆘 Допомога

<b>Основні команди:</b>
/start - Почати роботу
/help - Показати цю допомогу

<b>Функції:</b>
📋 <b>Мої записи</b> - Переглянути активні записи
🚗 <b>Мої авто</b> - Переглянути ваші автомобілі
➕ <b>Новий запис</b> - Записатися на обслуговування
🔧 <b>Послуги</b> - Переглянути доступні послуги
📞 <b>Контакти</b> - Контактна інформація
⚙️ <b>Профіль</b> - Налаштування профілю

<b>Авторизація:</b>
🔑 <b>Увійти</b> - Авторизуватися в системі
📝 <b>Зареєструватися</b> - Створити новий обліковий запис

<b>Підтримка:</b>
📧 Email: support@avtoservis.ua
📱 Телефон: +380 (99) 123-45-67
    `;

    await bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
  }

  static async handleMyAppointments(msg) {
    const chatId = msg.chat.id;

    try {
      const isLinked = await userManager.isUserLinked(chatId);
      if (!isLinked) {
        await bot.sendMessage(chatId, '⚠️ Будь ласка, увійдіть в систему спочатку.');
        return;
      }

      const credentials = await userManager.getServerCredentials(chatId);
      const appointments = await AutoServiceAPI.getUserAppointments(credentials.userId, credentials.token);
      
      if (appointments.length === 0) {
        await bot.sendMessage(chatId, '📭 У вас ще немає активних записів.');
        return;
      }

      let message = '📋 Ваші активні записи:\n\n';
      appointments.forEach((appointment, index) => {
        const date = moment(appointment.appointment_date).format('DD.MM.YYYY HH:mm');
        const vehicle = appointment.vehicle || {};
        const service = appointment.service || {};
        const station = appointment.service_station || {};
        
        message += `${index + 1}. 📅 <b>${date}</b>\n`;
        message += `   🚗 ${vehicle.make || ''} ${vehicle.model || ''}\n`;
        message += `   🔧 ${service.name || ''}\n`;
        message += `   📍 ${station.name || ''}\n`;
        message += `   📝 Статус: <b>${appointment.status || 'pending'}</b>\n\n`;
      });

      await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    } catch (error) {
      await bot.sendMessage(chatId, '❌ Помилка при отриманні записів.');
    }
  }

  static async handleMyVehicles(msg) {
    const chatId = msg.chat.id;

    try {
      const isLinked = await userManager.isUserLinked(chatId);
      if (!isLinked) {
        await bot.sendMessage(chatId, '⚠️ Будь ласка, увійдіть в систему спочатку.');
        return;
      }

      const credentials = await userManager.getServerCredentials(chatId);
      const vehicles = await AutoServiceAPI.getUserVehicles(credentials.userId, credentials.token);
      
      if (vehicles.length === 0) {
        const addVehicleKeyboard = {
          reply_markup: {
            inline_keyboard: [
              [{ text: '➕ Додати автомобіль', callback_data: 'add_vehicle' }],
              [{ text: '⬅️ Головне меню', callback_data: 'back_to_main' }]
            ]
          }
        };
        await bot.sendMessage(chatId, '🚗 У вас ще немає доданих автомобілів.\n\n➕ Додайте свій перший автомобіль для запису на обслуговування!', addVehicleKeyboard);
        return;
      }

      let message = '🚗 <b>Ваші автомобілі:</b>\n\n';
      const inlineKeyboard = [];
      
      vehicles.forEach((vehicle, index) => {
        message += `${index + 1}. <b>${vehicle.make} ${vehicle.model}</b> (${vehicle.year})\n`;
        message += `   📋 VIN: <code>${vehicle.vin}</code>\n`;
        message += `   🎨 Колір: ${vehicle.color || 'не вказано'}\n`;
        if (vehicle.mileage) message += `   🛣️ Пробіг: ${vehicle.mileage.toLocaleString()} км\n`;
        
        // Додаємо інформацію про записи
        if (vehicle.appointments && vehicle.appointments.length > 0) {
          const activeAppointments = vehicle.appointments.filter(apt => apt.status === 'pending' || apt.status === 'confirmed');
          if (activeAppointments.length > 0) {
            message += `   📅 Активних записів: ${activeAppointments.length}\n`;
          }
        }
        
        // Додаємо інформацію про історію обслуговування
        if (vehicle.service_history && vehicle.service_history.length > 0) {
          const lastService = vehicle.service_history[0];
          message += `   🔧 Останнє ТО: ${moment(lastService.service_date).format('DD.MM.YYYY')}\n`;
        }
        
        message += '\n';
        inlineKeyboard.push([{ text: `🔧 ${vehicle.make} ${vehicle.model}`, callback_data: `vehicle_details_${vehicle.vin}` }]);
      });
      
      inlineKeyboard.push(
        [{ text: '➕ Додати автомобіль', callback_data: 'add_vehicle' }],
        [{ text: '📋 Записи на ТО', callback_data: 'my_appointments' }],
        [{ text: '⬅️ Головне меню', callback_data: 'back_to_main' }]
      );

      await bot.sendMessage(chatId, message, { 
        parse_mode: 'HTML', 
        reply_markup: { inline_keyboard: inlineKeyboard }
      });
    } catch (error) {
      logger.error('Error in handleMyVehicles:', error);
      await bot.sendMessage(chatId, '❌ Помилка при отриманні автомобілів.');
    }
  }

  static async handleServices(msg) {
    const chatId = msg.chat.id;

    try {
      const services = await AutoServiceAPI.getServices();
      
      if (services.length === 0) {
        await bot.sendMessage(chatId, '🔧 Наразі немає доступних послуг.');
        return;
      }

      let message = '🔧 Доступні послуги:\n\n';
      services.forEach((service, index) => {
        message += `${index + 1}. <b>${service.name}</b>\n`;
        message += `   💰 Ціна: <b>${service.price} грн</b>\n`;
        message += `   ⏱️ Тривалість: ${service.duration} хв\n`;
        message += `   📝 ${service.description || 'Опис відсутній'}\n\n`;
      });

      await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    } catch (error) {
      await bot.sendMessage(chatId, '❌ Помилка при отриманні послуг.');
    }
  }

  static async handleContacts(msg) {
    const chatId = msg.chat.id;
    
    const contactsMessage = `
📞 Контактна інформація:

📍 <b>Адреса:</b>
вул. Автосервісна, 123
м. Київ, 01001

📱 <b>Телефони:</b>
+380 (99) 123-45-67
+380 (66) 987-65-43

📧 <b>Email:</b>
info@avtoservis.ua
support@avtoservis.ua

🕒 <b>Графік роботи:</b>
Пн-Пт: 9:00 - 18:00
Сб: 9:00 - 15:00
Нд: вихідний

🌐 <b>Веб-сайт:</b>
https://avtoservis.ua
    `;

    await bot.sendMessage(chatId, contactsMessage, { parse_mode: 'HTML' });
  }

  static async handleProfile(msg) {
    const chatId = msg.chat.id;
    const user = await userManager.getUser(chatId);
    
    let message = '⚙️ <b>Налаштування профілю</b>\n\n';
    
    if (user && user.isLinkedToServer()) {
      // Користувач авторизований
      message += '✅ <b>Статус:</b> Авторизовано\n';
      
      // Перевіряємо термін дії токена
      if (user.isTokenExpired()) {
        message += '⚠️ <b>Увага:</b> Термін дії вашого сеансу закінчився. Будь ласка, авторизуйтесь знову.\n';
      } else {
        const expiresIn = user.getTokenExpirationTime() - Date.now();
        const hoursLeft = Math.floor(expiresIn / (1000 * 60 * 60));
        const minutesLeft = Math.floor((expiresIn % (1000 * 60 * 60)) / (1000 * 60));
        
        message += `⏱️ <b>Сеанс активний ще:</b> ${hoursLeft} год ${minutesLeft} хв\n`;
      }
      
      // Додаємо інформацію про сповіщення
      message += `🔔 <b>Сповіщення:</b> ${user.getNotificationsEnabled() ? 'Увімкнено' : 'Вимкнено'}\n`;
      
      // Додаємо кнопку для виходу з облікового запису
      await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboards.profile.reply_markup
      });
    } else {
      // Користувач не авторизований
      message += '❌ <b>Статус:</b> Не авторизовано\n\n';
      message += 'Для доступу до всіх функцій бота, будь ласка, авторизуйтесь або зареєструйтесь.';
      
      await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: keyboards.auth.reply_markup
      });
    }
  }
}




// Допоміжна функція для старту заповнення відсутнього поля
async function startFillingMissingField(chatId, field, carData = {}) {
  let prompt = '';
  let example = '';
  switch (field) {
    case 'vin':
      prompt = 'Введіть VIN-код вашого автомобіля (17 символів)';
      example = 'Приклад: WVWZZZ1KZAM123456';
      userStates.set(chatId, 'add_vehicle_vin');
      break;
    case 'make':
      prompt = 'Введіть марку автомобіля';
      example = 'Приклад: Volkswagen';
      userStates.set(chatId, 'add_vehicle_make');
      break;
    case 'model':
      prompt = 'Введіть модель автомобіля';
      example = 'Приклад: Golf';
      userStates.set(chatId, 'add_vehicle_model');
      break;
    case 'year':
      prompt = 'Введіть рік випуску автомобіля (4 цифри)';
      example = 'Приклад: 2015';
      userStates.set(chatId, 'add_vehicle_year');
      break;
    case 'licensePlate':
      prompt = 'Введіть державний номер автомобіля';
      example = 'Приклад: AA1234BB';
      userStates.set(chatId, 'add_vehicle_license_plate');
      break;
    case 'color':
      prompt = 'Введіть колір автомобіля';
      example = 'Приклад: Сірий';
      userStates.set(chatId, 'add_vehicle_color');
      break;
    case 'mileage':
      prompt = 'Введіть поточний пробіг (км)';
      example = 'Приклад: 125000';
      userStates.set(chatId, 'add_vehicle_mileage');
      break;
    default:
      prompt = 'Введіть значення';
      userStates.set(chatId, `add_vehicle_${field}`);
  }

  await bot.sendMessage(chatId,
    `${prompt}:\n\n<i>${example}</i>`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: '❌ Скасувати', callback_data: 'back_to_vehicles' }]]
      }
    }
  );
}

// ...

// Обробка текстових повідомлень
const activeSearches = new Set();
bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ігноруємо команди та повідомлення без тексту
    if (!text || text.startsWith('/')) return;

    // Уніфікована обробка держномерів тут (єдиний вхід)
    const plateRegex = /^[A-ZА-ЯІЇЄ0-9]{5,10}$/i;
    const trimmed = (text || '').trim();
    const normalized = normalizeLicensePlate(trimmed);
    if (plateRegex.test(normalized)) {
      const key = `${chatId}:${normalized}`;
      if (activeSearches.has(key)) {
        // Уже виконується пошук для цього ж чату і номеру — уникаємо дублювання
        return;
      }
      activeSearches.add(key);
      const waitingMessage = await bot.sendMessage(
        chatId,
        '🔍 Шукаю інформацію про автомобіль...\n\n⏳ Будь ласка, зачекайте...'
      );
      try {
        await searchVehicleByLicensePlate(chatId, normalized, waitingMessage.message_id);
      } finally {
        activeSearches.delete(key);
      }
      return;
    }

    switch (text) {
      case '🚗 Мої авто':
        await BotCommands.handleMyVehicles(msg);
        break;
      case '➕ Новий запис':
        await appointmentFlow.startFlow(chatId);
        break;
      case '🔧 Послуги':
        await BotCommands.handleServices(msg);
        break;
      case '📞 Контакти':
        await BotCommands.handleContacts(msg);
        break;
    case '⚙️ Профіль':
      await BotCommands.handleProfile(msg);
      break;
    case '🔑 Увійти':
      await handleLogin(msg);
      break;
    case '📝 Зареєструватися':
      await handleRegistration(msg);
      break;
    case '⬅️ Назад':
      {
        const keyboard = await getMainKeyboard(chatId);
        await bot.sendMessage(chatId, 'Головне меню:', keyboard);
      }
      break;
    case '❌ Скасувати':
      // Перевіряємо, чи користувач в процесі авторизації/реєстрації
      if (userStates.has(chatId)) {
        userStates.delete(chatId);
        await bot.sendMessage(chatId, '❌ Дію скасовано.', keyboards.auth);
      } else {
        // Скасування запису на сервіс
        appointmentFlow.cancelFlow(chatId);
        await bot.sendMessage(chatId, '❌ Дію скасовано.', await getMainKeyboard(chatId));
      }
      break;
    case '🚪 Вийти з облікового запису':
      // Вихід з облікового запису
      await userManager.unlinkUserFromServer(chatId);
      await bot.sendMessage(chatId, 
        '🚪 Ви успішно вийшли з облікового запису. Для доступу до всіх функцій бота, будь ласка, авторизуйтесь знову.', 
        keyboards.auth);
      break;
    case '🔔 Сповіщення':
      // Перемикання сповіщень
      const user = await userManager.getUser(chatId);
      if (user && user.isLinkedToServer()) {
        const notificationsEnabled = await userManager.toggleNotifications(chatId);
        await bot.sendMessage(chatId, 
          `🔔 Сповіщення ${notificationsEnabled ? 'увімкнено' : 'вимкнено'}.`, 
          keyboards.profile);
      } else {
        await bot.sendMessage(chatId, 
          '❌ Для керування сповіщеньми необхідно авторизуватися.', 
          keyboards.auth);
      }
      break;
    case '🌐 Мова':
      // Вибір мови
      await bot.sendMessage(chatId, 
        '🌐 Оберіть мову інтерфейсу:', 
        {
          reply_markup: {
            keyboard: [
              ['🇺🇦 Українська'],
              ['🇬🇧 English'],
              ['🇷🇺 Русский'],
              ['⬅️ Назад']
            ],
            resize_keyboard: true
          }
        }
      );
      break;
    case '🇺🇦 Українська':
      await userManager.setUserLanguage(chatId, 'uk');
      await bot.sendMessage(chatId, '✅ Мову змінено на українську.', keyboards.profile);
      break;
    case '🇬🇧 English':
      await userManager.setUserLanguage(chatId, 'en');
      await bot.sendMessage(chatId, '✅ Language changed to English.', keyboards.profile);
      break;
    case '🇷🇺 Русский':
      await userManager.setUserLanguage(chatId, 'ru');
      await bot.sendMessage(chatId, '✅ Язык изменен на русский.', keyboards.profile);
      break;
    case '👤 Особисті дані':
      // Показуємо особисті дані користувача
      const userData = await userManager.getUser(chatId);
      if (userData && userData.isLinkedToServer()) {
        let message = '👤 <b>Особисті дані</b>\n\n';
        
        if (userData.firstName) message += `<b>Ім'я:</b> ${userData.firstName}\n`;
        if (userData.lastName) message += `<b>Прізвище:</b> ${userData.lastName}\n`;
        if (userData.username) message += `<b>Нікнейм:</b> ${userData.username}\n`;
        if (userData.phone) message += `<b>Телефон:</b> ${userData.phone}\n`;
        if (userData.email) message += `<b>Email:</b> ${userData.email}\n`;
        
        message += `\n<i>Зареєстровано:</i> ${new Date(userData.registeredAt).toLocaleDateString()}`;
        
        await bot.sendMessage(chatId, message, {
          parse_mode: 'HTML',
          reply_markup: keyboards.profile.reply_markup
        });
      } else {
        await bot.sendMessage(chatId, 
          '❌ Для перегляду особистих даних необхідно авторизуватися.', 
          keyboards.auth);
      }
      break;
    case '🔗 Прив\'язати Telegram':
      // Прив'язка Telegram до існуючого облікового запису
      const userTelegram = await userManager.getUser(chatId);
      if (userTelegram && userTelegram.isLinkedToServer()) {
        await bot.sendMessage(chatId, 
          '✅ Ваш Telegram вже прив\'язаний до облікового запису.', 
          keyboards.profile);
      } else {
        // Запитуємо номер телефону для прив'язки
        userStates.set(chatId, 'login'); // Використовуємо існуючий стан для авторизації
        await bot.sendMessage(chatId, 
          'Для прив\'язки Telegram до існуючого облікового запису, будь ласка, надайте свій номер телефону:', 
          {
            reply_markup: {
              keyboard: [
                [{
                  text: '📱 Надіслати номер телефону',
                  request_contact: true
                }],
                ['❌ Скасувати']
              ],
              resize_keyboard: true,
              one_time_keyboard: true
            }
          }
        );
      }
      break;
    default:
      {
        const keyboard = await getMainKeyboard(chatId);
        await bot.sendMessage(chatId, 'Будь ласка, оберіть дію з меню нижче:', keyboard);
      }
  }
  } catch (error) {
    logger.error('Error in message handler:', {
      error: error.message,
      stack: error.stack,
      chatId: msg?.chat?.id,
      text: msg?.text
    });
    console.error('Message handler error:', error);
  }
});

// Зберігаємо стан користувача для розрізнення авторизації та реєстрації
const userStates = new Map();

// Обробка фото повністю видалена. OCR не використовується.

// Обробка контактів для авторизації та реєстрації
bot.on('contact', async (msg) => {
  try {
    const chatId = msg.chat.id;
    const phone = normalizePhone(msg.contact.phone_number);
    const state = userStates.get(chatId) || 'login';
    if (state === 'register') {
      const userData = {
        phone,
        firstName: msg.from.first_name,
        lastName: msg.from.last_name,
        username: msg.from.username,
        role: 'client'
      };
      try {
        // Спочатку перевіримо, чи існує користувач з таким номером телефону
        try {
          console.log('[Bot] Перевірка існування користувача перед реєстрацією:', phone);
          const loginResponse = await AutoServiceAPI.loginUser({ phone });
          
          // Якщо запит успішний, значить користувач вже існує
          console.log('[Bot] Користувач вже існує, спроба автоматичного входу:', phone);
          
          const isLoginSuccess = loginResponse && (loginResponse.success === true || loginResponse.status === 'success');
          const loginToken = loginResponse.token || loginResponse.access_token;
          const loginUser = loginResponse.user;
          
          if (isLoginSuccess && loginToken && loginUser) {
            await userManager.linkUserToServer(chatId, loginUser.id, loginToken);
            await bot.sendMessage(chatId, '✅ Ви успішно авторизовані!', await getMainKeyboard(chatId));
            return;
          } else {
            await bot.sendMessage(chatId, '⚠️ Цей номер телефону вже зареєстрований. Спробуйте авторизуватися.', keyboards.auth);
            return;
          }
        } catch (loginError) {
          // Якщо отримали помилку 404, значить користувача немає і можна продовжити реєстрацію
          if (loginError.response?.status !== 404 && loginError.response?.data?.code !== 'USER_NOT_FOUND') {
            console.log('[Bot] Помилка при перевірці існування користувача:', loginError.message);
          } else {
            console.log('[Bot] Користувач не знайдений, продовжуємо реєстрацію');
          }
        }
        
        // Продовжуємо реєстрацію, якщо користувач не існує
        const response = await AutoServiceAPI.registerUser(userData);
        console.log('[Bot] Registration response:', JSON.stringify(response, null, 2));
        
        if (response && response.success === true) {
          try {
            const loginResponse = await AutoServiceAPI.loginUser({ phone });
            console.log('[Bot] Auto-login after registration response:', JSON.stringify(loginResponse, null, 2));
             
             const isLoginSuccess = loginResponse && (loginResponse.success === true || loginResponse.status === 'success');
             const loginToken = loginResponse.token || loginResponse.access_token;
             const loginUser = loginResponse.user;
             
             console.log('[Bot] Auto-login response analysis:', { 
               hasResponse: !!loginResponse, 
               success: loginResponse?.success, 
               status: loginResponse?.status, 
               hasToken: !!loginToken, 
               hasUser: !!loginUser,
               isLoginSuccess 
             });
            
            if (isLoginSuccess && loginToken && loginUser) {
              console.log('[Bot] Auto-linking user after registration:', { chatId, userId: loginUser.id, hasToken: !!loginToken });
              await userManager.linkUserToServer(chatId, loginUser.id, loginToken);
              
              // Перевіряємо, чи дані збереглися
              const savedUser = await userManager.getUser(chatId);
              console.log('[Bot] User data after auto-linking:', savedUser ? 'saved successfully' : 'failed to save');
              
              await bot.sendMessage(chatId, '✅ Ви успішно зареєстровані та авторизовані!', await getMainKeyboard(chatId));
            } else {
              console.log('[Bot] Auto-login failed - missing data:', { isLoginSuccess, hasToken: !!loginToken, hasUser: !!loginUser });
              await bot.sendMessage(chatId, '✅ Реєстрація успішна! Але не вдалося автоматично авторизуватися. Спробуйте увійти вручну.', keyboards.auth);
            }
          } catch (loginError) {
            logger.error('Помилка автоматичного входу після реєстрації:', loginError);
            console.error('[Bot] Auto-login error details:', loginError.response?.data || loginError.message);
            await bot.sendMessage(chatId, '✅ Реєстрація успішна! Але не вдалося автоматично авторизуватися. Спробуйте увійти вручну.', keyboards.auth);
          }
        } else {
          await bot.sendMessage(chatId, '❌ Не вдалося зареєструватися. Можливо, цей номер телефону вже зареєстрований.');
        }
      } catch (error) {
        console.log('[Bot] Детальна інформація про помилку реєстрації:', {
          status: error.response?.status,
          code: error.response?.data?.code,
          message: error.response?.data?.message,
          details: error.response?.data?.details
        });
        
        if (error.response && error.response.status === 409) {
          // Спробуємо автоматично авторизуватися, якщо номер вже зареєстрований
          try {
            console.log('[Bot] Спроба автоматичного входу для вже зареєстрованого номера:', phone);
            const loginResponse = await AutoServiceAPI.loginUser({ phone });
            
            const isLoginSuccess = loginResponse && (loginResponse.success === true || loginResponse.status === 'success');
            const loginToken = loginResponse.token || loginResponse.access_token;
            const loginUser = loginResponse.user;
            
            if (isLoginSuccess && loginToken && loginUser) {
              await userManager.linkUserToServer(chatId, loginUser.id, loginToken);
              await bot.sendMessage(chatId, '✅ Ви успішно авторизовані!', await getMainKeyboard(chatId));
              return;
            }
          } catch (loginError) {
            console.error('[Bot] Помилка автоматичного входу для вже зареєстрованого номера:', loginError.message);
          }
          
          await bot.sendMessage(chatId, '⚠️ Цей номер телефону вже зареєстрований. Спробуйте авторизуватися.', keyboards.auth);
        } else if (error.response?.data?.code === 'PHONE_EXISTS') {
          // Спробуємо автоматично авторизуватися, якщо номер вже зареєстрований
          try {
            console.log('[Bot] Спроба автоматичного входу для вже зареєстрованого номера (PHONE_EXISTS):', phone);
            const loginResponse = await AutoServiceAPI.loginUser({ phone });
            
            const isLoginSuccess = loginResponse && (loginResponse.success === true || loginResponse.status === 'success');
            const loginToken = loginResponse.token || loginResponse.access_token;
            const loginUser = loginResponse.user;
            
            if (isLoginSuccess && loginToken && loginUser) {
              await userManager.linkUserToServer(chatId, loginUser.id, loginToken);
              await bot.sendMessage(chatId, '✅ Ви успішно авторизовані!', await getMainKeyboard(chatId));
              return;
            }
          } catch (loginError) {
            console.error('[Bot] Помилка автоматичного входу для вже зареєстрованого номера (PHONE_EXISTS):', loginError.message);
          }
          
          await bot.sendMessage(chatId, '⚠️ Цей номер телефону вже зареєстрований. Спробуйте авторизуватися.', keyboards.auth);
        } else if (error.response?.data?.details) {
          await bot.sendMessage(chatId, `❌ Помилка реєстрації: ${error.response.data.details}`, keyboards.auth);
        } else if (error.response?.data?.message) {
          await bot.sendMessage(chatId, `❌ Помилка реєстрації: ${error.response.data.message}`, keyboards.auth);
        } else {
          logger.error('Помилка реєстрації:', error);
          await bot.sendMessage(chatId, '❌ Помилка реєстрації. Будь ласка, спробуйте пізніше.', keyboards.auth);
        }
      }
    } else {
      // Авторизація існуючого користувача
      try {
        const response = await AutoServiceAPI.loginUser({ phone });
        
        console.log('[Bot] Login response:', JSON.stringify(response, null, 2));
        
        // Перевіряємо різні формати відповіді від сервера
        const isSuccess = response && (response.success === true || response.status === 'success');
        const token = response.token || response.access_token;
        const user = response.user;
        
        console.log('[Bot] Login response analysis:', { 
          hasResponse: !!response, 
          success: response?.success, 
          status: response?.status, 
          hasToken: !!token, 
          hasUser: !!user,
          isSuccess 
        });
        
        if (isSuccess && token && user) {
          console.log('[Bot] Linking user to server:', { chatId, userId: user.id, hasToken: !!token });
          await userManager.linkUserToServer(chatId, user.id, token);
          
          // Перевіряємо, чи дані збереглися
          const savedUser = await userManager.getUser(chatId);
          console.log('[Bot] User data after linking:', savedUser ? 'saved successfully' : 'failed to save');
          
          await bot.sendMessage(chatId, '✅ Ви успішно авторизовані!', await getMainKeyboard(chatId));
        } else {
          console.log('[Bot] Login failed - missing data or unsuccessful response');
          await bot.sendMessage(chatId, 
            '❌ Не вдалося авторизуватися. Можливо, ваш номер телефону не зареєстрований в системі.', keyboards.auth);
        }
      } catch (error) {
        console.log('[Bot] Детальна інформація про помилку авторизації:', {
          status: error.response?.status,
          code: error.response?.data?.code,
          message: error.response?.data?.message,
          details: error.response?.data?.details
        });
        
        if (error.response && error.response.status === 404) {
          // Пропонуємо користувачу зареєструватися
          userStates.set(chatId, 'register');
          await bot.sendMessage(chatId, 
            '⚠️ Користувача з таким номером телефону не знайдено. Бажаєте зареєструватися?', {
              reply_markup: {
                keyboard: [
                  [{
                    text: '📱 Зареєструватися з цим номером',
                    request_contact: true
                  }],
                  ['❌ Скасувати']
                ],
                resize_keyboard: true,
                one_time_keyboard: true
              }
            });
        } else if (error.response?.data?.code === 'USER_NOT_FOUND') {
          // Пропонуємо користувачу зареєструватися
          userStates.set(chatId, 'register');
          await bot.sendMessage(chatId, 
            '⚠️ Користувача з таким номером телефону не знайдено. Бажаєте зареєструватися?', {
              reply_markup: {
                keyboard: [
                  [{
                    text: '📱 Зареєструватися з цим номером',
                    request_contact: true
                  }],
                  ['❌ Скасувати']
                ],
                resize_keyboard: true,
                one_time_keyboard: true
              }
            });
        } else if (error.response?.data?.details) {
          await bot.sendMessage(chatId, `❌ Помилка авторизації: ${error.response.data.details}`, keyboards.auth);
        } else if (error.response?.data?.message) {
          await bot.sendMessage(chatId, `❌ Помилка авторизації: ${error.response.data.message}`, keyboards.auth);
        } else {
          logger.error('Помилка авторизації:', error);
          await bot.sendMessage(chatId, 
            '❌ Помилка авторизації. Будь ласка, спробуйте пізніше.', keyboards.auth);
        }
      }
    }
  } catch (error) {
    logger.error('Error in contact handler:', {
      error: error.message,
      stack: error.stack,
      chatId: msg?.chat?.id,
      phone: msg?.contact?.phone_number
    });
    console.error('Contact handler error:', error);
    await bot.sendMessage(msg.chat.id, '❌ Виникла помилка. Спробуйте пізніше.', keyboards.auth);
  } finally {
    userStates.delete(msg.chat.id);
  }
});

// Функція для обробки авторизації
async function handleLogin(msg) {
  const chatId = msg.chat.id;
  
  // Встановлюємо стан користувача як 'login'
  userStates.set(chatId, 'login');
  
  // Запитуємо номер телефону через кнопку
  const requestPhoneKeyboard = {
    reply_markup: {
      keyboard: [[
        {
          text: '📱 Надіслати номер телефону',
          request_contact: true
        }
      ], ['❌ Скасувати']],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  };
  
  await bot.sendMessage(chatId, 
    '🔑 Для авторизації, будь ласка, надайте доступ до вашого номера телефону.\n\n' +
    'Натисніть кнопку "📱 Надіслати номер телефону" нижче.', 
    requestPhoneKeyboard);
}

// Функція для обробки процесу додавання автомобіля
async function handleAddVehicleFlow(chatId, text, state) {
  try {
    const user = await userManager.getUser(chatId);
    if (!user || !user.isLinkedToServer()) {
      await bot.sendMessage(chatId, '❌ Для додавання автомобіля необхідно авторизуватися.', keyboards.auth);
      userStates.delete(chatId);
      return;
    }

    // Отримуємо або створюємо об'єкт для зберігання даних автомобіля
    if (!vehicleData.has(chatId)) {
      vehicleData.set(chatId, {});
    }
    const carData = vehicleData.get(chatId);

    // Обробка різних етапів додавання автомобіля
    switch (state) {
      // edit_license_plate (введення) видалено разом з OCR-функціоналом
      case 'add_vehicle_license_plate':
        // Валідація держномера (формат: AA1234BB)
        const licensePlateRegex = /^[А-ЯІЇЄҐA-Z]{2}\d{4}[А-ЯІЇЄҐA-Z]{2}$/i;
        if (!licensePlateRegex.test(text.replace(/\s/g, ''))) {
          await bot.sendMessage(chatId, '❌ Неправильний формат держномера. Введіть у форматі AA1234BB:');
          return;
        }
        
        // Зберігаємо держномер і шукаємо інформацію про автомобіль
        carData.licensePlate = text.replace(/\s/g, '').toUpperCase();
        
        // Спробуємо знайти інформацію про автомобіль за номерним знаком з повідомленням очікування
        try {
          const waitingMessage = await bot.sendMessage(chatId, '🔍 Шукаю інформацію про автомобіль...\n\n⏳ Будь ласка, зачекайте...');
          await searchVehicleByLicensePlate(chatId, carData.licensePlate, waitingMessage.message_id);
        } catch (e) {
          await searchVehicleByLicensePlate(chatId, carData.licensePlate);
        }
        break;
        
      case 'add_vehicle_vin':
        // Валідація VIN-коду
        if (text.length !== 17) {
          await bot.sendMessage(chatId, '❌ VIN-код повинен містити рівно 17 символів. Спробуйте ще раз:');
          return;
        }
        
        // Зберігаємо VIN і переходимо до наступного кроку
        carData.vin = text.toUpperCase();
        userStates.set(chatId, 'add_vehicle_make');
        
        await bot.sendMessage(chatId, 
          '✅ VIN-код прийнято!\n\n' +
          'Тепер введіть марку автомобіля (наприклад, Toyota, BMW, Audi):', 
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '❌ Скасувати', callback_data: 'back_to_vehicles' }
              ]]
            }
          }
        );
        break;
        
      case 'add_vehicle_make':
        // Зберігаємо марку і переходимо до моделі
        carData.make = text;
        userStates.set(chatId, 'add_vehicle_model');
        
        await bot.sendMessage(chatId, 
          `✅ Марка: ${text}\n\n` +
          'Тепер введіть модель автомобіля:', 
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '❌ Скасувати', callback_data: 'back_to_vehicles' }
              ]]
            }
          }
        );
        break;
        
      case 'add_vehicle_model':
        // Зберігаємо модель і переходимо до року
        carData.model = text;
        userStates.set(chatId, 'add_vehicle_year');
        
        await bot.sendMessage(chatId, 
          `✅ Модель: ${text}\n\n` +
          'Тепер введіть рік випуску автомобіля (наприклад, 2018):', 
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '❌ Скасувати', callback_data: 'back_to_vehicles' }
              ]]
            }
          }
        );
        break;
        
      case 'add_vehicle_year':
        // Валідація року
        const year = parseInt(text);
        const currentYear = new Date().getFullYear();
        
        if (isNaN(year) || year < 1900 || year > currentYear) {
          await bot.sendMessage(chatId, 
            `❌ Будь ласка, введіть коректний рік випуску (від 1900 до ${currentYear}):`
          );
          return;
        }
        
        // Зберігаємо рік і переходимо до кольору
        carData.year = year;
        userStates.set(chatId, 'add_vehicle_color');
        
        await bot.sendMessage(chatId, 
          `✅ Рік випуску: ${year}\n\n` +
          'Тепер введіть колір автомобіля:', 
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '❌ Скасувати', callback_data: 'back_to_vehicles' }
              ]]
            }
          }
        );
        break;
        
      case 'add_vehicle_color':
        // Зберігаємо колір і переходимо до пробігу
        carData.color = text;
        userStates.set(chatId, 'add_vehicle_mileage');
        
        await bot.sendMessage(chatId, 
          `✅ Колір: ${text}\n\n` +
          'Тепер введіть поточний пробіг автомобіля (в кілометрах):', 
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '❌ Скасувати', callback_data: 'back_to_vehicles' }
              ]]
            }
          }
        );
        break;
        
      case 'add_vehicle_mileage':
        // Валідація пробігу
        const mileage = parseInt(text);
        
        if (isNaN(mileage) || mileage < 0 || mileage > 1000000) {
          await bot.sendMessage(chatId, 
            '❌ Будь ласка, введіть коректний пробіг (від 0 до 1 000 000 км):'
          );
          return;
        }
        
        // Зберігаємо пробіг і завершуємо додавання автомобіля
        carData.mileage = mileage;
        
        // Відправляємо запит на додавання автомобіля
        try {
          const token = user.getToken();
          
          // Мапимо поля згідно з очікуваннями серверного контролера (Telegram API)
          const vehicleForServer = {
            vin: carData.vin,
            make: carData.make || carData.brand, // використовуємо make, контролер очікує make
            model: carData.model,
            year: carData.year,
            color: carData.color, // сервер зберігає color
            mileage: carData.mileage,
            licensePlate: carData.licensePlate || carData.license_plate, // контролер очікує licensePlate
            user_id: user.serverUserId // обов'язковий для Telegram API
          };
          
          const result = await AutoServiceAPI.addVehicle(vehicleForServer, token);
          
          // Очищаємо дані та стан
          vehicleData.delete(chatId);
          userStates.delete(chatId);
          
          // Відправляємо повідомлення про успішне додавання
          await bot.sendMessage(chatId, 
            '✅ Автомобіль успішно додано!\n\n' +
            `🚗 ${(carData.make || carData.brand) ?? ''} ${carData.model || ''} ${carData.year ? `(${carData.year})` : ''}\n` +
            `🚙 Держномер: <b>${formatLicensePlate(carData.licensePlate || carData.license_plate || '')}</b>\n` +
            (carData.vin ? `🔢 VIN: ${carData.vin}\n` : '') +
            (carData.color ? `🎨 Колір: ${carData.color}\n` : '') +
            (carData.mileage ? `📊 Пробіг: ${carData.mileage} км` : ''), 
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '📋 Переглянути мої автомобілі', callback_data: 'my_vehicles' }],
                  [{ text: '🏠 Головне меню', callback_data: 'back_to_main' }]
                ]
              }
            }
          );
        } catch (error) {
          console.error('Error adding vehicle:', error);
          await bot.sendMessage(chatId, 
            '❌ Помилка при додаванні автомобіля. ' + 
            (error.response?.data?.message || 'Спробуйте пізніше.'), 
            await getMainKeyboard(chatId)
          );
          
          // Очищаємо дані та стан
          vehicleData.delete(chatId);
          userStates.delete(chatId);
        }
        break;
    }
  } catch (error) {
    console.error('Error in handleAddVehicleFlow:', error);
    await bot.sendMessage(chatId, '❌ Виникла помилка. Спробуйте пізніше.', await getMainKeyboard(chatId));
    
    // Очищаємо дані та стан
    vehicleData.delete(chatId);
    userStates.delete(chatId);
  }
}

// Функція для обробки реєстрації
async function handleRegistration(msg) {
  const chatId = msg.chat.id;
  userStates.set(chatId, 'register');
  const requestPhoneKeyboard = {
    reply_markup: {
      keyboard: [[
        {
          text: '📱 Надіслати номер телефону',
          request_contact: true
        }
      ], ['❌ Скасувати']],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  };
  await bot.sendMessage(chatId,
    '📝 Для реєстрації, будь ласка, надайте доступ до вашого номера телефону.\n\n' +
    'Натисніть кнопку "📱 Надіслати номер телефону" нижче.\n\n' +
    'Після цього вам потрібно буде заповнити додаткову інформацію на сайті або в мобільному додатку.',
    requestPhoneKeyboard);
}

// Обробка помилок
bot.on('polling_error', (error) => {
  logger.error('Polling error:', {
    message: error?.message,
    code: error?.code,
    stack: error?.stack,
    name: error?.name,
    response: error?.response?.data
  });
  console.error('Full polling error:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', {
    promise: promise,
    reason: reason,
    stack: reason?.stack,
    message: reason?.message,
    name: reason?.name
  });
  console.error('Full error details:', reason);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Отримано SIGINT, зупинка бота...');
  bot.stopPolling();
  process.exit(0);
});

// Функція для пошуку інформації про автомобіль за номерним знаком
async function searchVehicleByLicensePlate(chatId, licensePlate, waitingMessageId = null) {
  try {
    const user = await userManager.getUser(chatId);
    if (!user || !user.isLinkedToServer()) {
      // Видаляємо повідомлення про очікування якщо воно є
      if (waitingMessageId) {
        try {
          await bot.deleteMessage(chatId, waitingMessageId);
        } catch (error) {
          console.error('Помилка при видаленні повідомлення про очікування:', error);
        }
      }
      await bot.sendMessage(chatId, '❌ Для пошуку автомобіля необхідно авторизуватися.', keyboards.auth);
      return;
    }
    // Спочатку спробуємо знайти автомобіль у нашій базі даних
    try {
      const vehicle = await AutoServiceAPI.getVehicleByLicensePlate(licensePlate);
      if (vehicle) {
        // Коректно визначаємо поле держномера з відповіді API (snake_case або camelCase)
        const plateFromDb = vehicle.license_plate || vehicle.licensePlate || vehicle.registration_number || '';
        // Форматуємо номер для кращого відображення (AA 1234 BB)
        const formattedLicensePlate = formatLicensePlate(plateFromDb);
        // Видаляємо повідомлення про очікування якщо воно є
        if (waitingMessageId) {
          try {
            await bot.deleteMessage(chatId, waitingMessageId);
          } catch (error) {
            console.error('Помилка при видаленні повідомлення про очікування:', error);
          }
        }

        // Автомобіль знайдено в нашій базі даних
        // Підготуємо дані та визначимо відсутні
        const availableData = {
          vin: vehicle.vin || '',
          make: vehicle.brand || vehicle.make || '', // Пріоритет brand з сервера
          model: vehicle.model || '',
          year: vehicle.year || '',
          color: vehicle.color || '', // Зберігаємо для відображення, хоча в БД немає
          mileage: vehicle.mileage || 0,
          licensePlate: plateFromDb
        };
        const missingFields = getMissingFields(availableData);
        const message = formatVehicleDataMessage(availableData, missingFields);

        // Показуємо спочатку знайдені дані, а тоді список відсутніх
        await bot.sendMessage(chatId,
          message,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Використати ці дані', callback_data: 'use_existing_vehicle_data' },
                  ...(missingFields.length > 0 ? [{ text: '✏️ Доповнити відсутні', callback_data: 'complete_missing_vehicle_fields' }] : []),
                  { text: '❌ Ввести нові дані', callback_data: 'enter_new_vehicle_data' }
                ]
              ]
            }
          }
        );
        
        // Зберігаємо дані автомобіля у внутрішній стан у форматі, який потрібен для нашої БД Supabase
        if (!vehicleData.has(chatId)) {
          vehicleData.set(chatId, {});
        }
        const carData = vehicleData.get(chatId);
        Object.assign(carData, availableData);
        
        return;
      }
    } catch (error) {
      console.error('Error searching vehicle in database:', error);
      // Продовжуємо пошук у локальному CSV, якщо не знайдено в нашій базі
    }
    const registryVehicle = await AutoServiceAPI.getVehicleRegistryByLicensePlate(licensePlate);
    if (registryVehicle) {
      const registryPlate =
        registryVehicle.n_reg_new ||
        registryVehicle.license_plate_normalized ||
        licensePlate;
      const availableData = {
        vin: registryVehicle.vin || '',
        make: registryVehicle.brand || registryVehicle.make || '',
        model: registryVehicle.model || '',
        year: registryVehicle.make_year || '',
        color: registryVehicle.color || '',
        mileage: 0,
        licensePlate: registryPlate
      };
      const missingFields = getMissingFields(availableData);
      const message = formatVehicleDataMessage(availableData, missingFields);

      if (waitingMessageId) {
        try {
          await bot.deleteMessage(chatId, waitingMessageId);
        } catch (error) {
          console.error('Помилка при видаленні повідомлення про очікування:', error);
        }
      }

      await bot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Використати ці дані', callback_data: 'use_existing_vehicle_data' },
              ...(missingFields.length > 0 ? [{ text: '✏️ Доповнити відсутні', callback_data: 'complete_missing_vehicle_fields' }] : []),
              { text: '❌ Ввести нові дані', callback_data: 'enter_new_vehicle_data' }
            ]
          ]
        }
      });

      if (!vehicleData.has(chatId)) {
        vehicleData.set(chatId, {});
      }
      const carData = vehicleData.get(chatId);
      Object.assign(carData, availableData);
      return;
    }
    // Якщо через API нічого не знайдено, пропонуємо ввести дані вручну

    // Якщо не знайдено ніде, переходимо до введення VIN-коду
    userStates.set(chatId, 'add_vehicle_vin');
    // Видаляємо повідомлення про очікування якщо воно є
    if (waitingMessageId) {
      try {
        await bot.deleteMessage(chatId, waitingMessageId);
      } catch (error) {
        console.error('Помилка при видаленні повідомлення про очікування:', error);
      }
    }
    await bot.sendMessage(chatId, 
      `✅ Держномер: <b>${formatLicensePlate(licensePlate)}</b>\n\n` +
      'Автомобіль не знайдено в базі. Тепер введіть VIN-код вашого автомобіля (17 символів):\n\n' +
      '<i>Приклад: WVWZZZ1KZAM123456</i>', 
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ Скасувати', callback_data: 'back_to_vehicles' }
          ]]
        }
      }
    );
  } catch (error) {
    console.error('Error in searchVehicleByLicensePlate:', error);
    // Видаляємо повідомлення про очікування якщо воно є
    if (waitingMessageId) {
      try {
        await bot.deleteMessage(chatId, waitingMessageId);
      } catch (e) {
        console.error('Помилка при видаленні повідомлення про очікування у catch:', e);
      }
    }
    await bot.sendMessage(chatId, '❌ Виникла помилка при пошуку автомобіля. Спробуйте ще раз.');
  }
}

// Запуск бота
async function startBot() {
  try {
    // Перевірка з'єднання з сервером
    await apiClient.get('/health');
    logger.info('✅ З\'єднання з сервером успішне');
  } catch (error) {
    logger.warn('⚠️ Не вдалося підключитися до сервера, але бот продовжує роботу');
  }

  logger.info('🚀 Telegram бот запущений!');
  logger.info(`🔗 Server API: ${config.serverUrl}`);
  logger.info(`🤖 Bot: @${(await bot.getMe()).username}`);
}

startBot();

// Додаємо функцію нормалізації номера телефону
function normalizePhone(phone) {
  // Очищаємо номер від усіх символів, крім цифр та +
  let clean = phone.replace(/[^0-9+]/g, '');
  
  // Конвертуємо номер в єдиний формат +380XXXXXXXXX
  if (clean.startsWith('0')) {
    clean = '+380' + clean.slice(1);
  } else if (clean.startsWith('380')) {
    clean = '+' + clean;
  } else if (!clean.startsWith('+380')) {
    // Перевіряємо, чи це вже міжнародний формат іншої країни
    if (clean.startsWith('+')) {
      // Якщо це інший міжнародний формат, залишаємо як є
      return clean;
    }
    // Інакше додаємо український код
    clean = '+380' + clean;
  }
  
  // Перевіряємо фінальний формат за допомогою регулярного виразу
  if (!/^\+380\d{9}$/.test(clean)) {
    console.log(`[Bot] Номер телефону не відповідає формату +380XXXXXXXXX: ${clean}`);
  }
  
  return clean;
}
