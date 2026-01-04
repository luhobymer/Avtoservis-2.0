const { Validator, ErrorHandler } = require('./validator');
const userManager = require('./userManager');

class AppointmentFlow {
  constructor(bot, apiClient) {
    this.bot = bot;
    this.api = apiClient;
    this.flows = new Map(); // Зберігаємо активні потоки для кожного користувача
  }

  async startFlow(chatId, preselectedVin = null) {
    try {
      const user = await userManager.getUser(chatId);
      if (!user || !user.isLinkedToServer()) {
        await this.bot.sendMessage(chatId, 
          '⚠️ Для запису на сервіс необхідно авторизуватися.', 
          {
            reply_markup: {
              keyboard: [
                ['🔑 Увійти', '📝 Зареєструватися'],
                ['⬅️ Назад']
              ],
              resize_keyboard: true
            }
          });
        return;
      }
      
      // Перевіряємо термін дії токена
      if (user.isTokenExpired()) {
        await this.bot.sendMessage(chatId, 
          '⚠️ Термін дії вашого сеансу закінчився. Будь ласка, авторизуйтесь знову.', 
          {
            reply_markup: {
              keyboard: [
                ['🔑 Увійти'],
                ['⬅️ Назад']
              ],
              resize_keyboard: true
            }
          });
        return;
      }
      const userId = user.serverUserId;
      const token = user.token;
      const vehicles = await this.getUserVehicles(userId, token);
      
      if (vehicles.length === 0) {
        await this.bot.sendMessage(chatId, 
          '🚗 У вас немає доданих автомобілів. Будь ласка, додайте авто через веб-інтерфейс або мобільний додаток.');
        return;
      }

      const services = await this.getServices();
      const serviceStations = await this.getServiceStations();

      // Якщо передано VIN, автоматично вибираємо автомобіль
      let selectedVehicle = null;
      if (preselectedVin) {
        selectedVehicle = vehicles.find(v => v.vin === preselectedVin);
      }

      const flowData = {
        step: selectedVehicle ? 'select_service' : 'select_vehicle',
        data: {
          vehicles,
          services,
          serviceStations,
          selected: {}
        }
      };

      // Якщо знайдено автомобіль за VIN, встановлюємо його як вибраний
      if (selectedVehicle) {
        flowData.data.selected.vehicle = selectedVehicle;
      }

      this.flows.set(chatId, flowData);

      // Показуємо відповідний крок
      if (selectedVehicle) {
        await this.showServiceSelection(chatId, services);
      } else {
        await this.showVehicleSelection(chatId, vehicles);
      }
    } catch (error) {
      await this.handleError(chatId, error);
    }
  }

  async handleMessage(chatId, text) {
    const flow = this.flows.get(chatId);
    if (!flow) return false;

    try {
      switch (flow.step) {
        case 'select_vehicle':
          return await this.handleVehicleSelection(chatId, text, flow);
        case 'select_service':
          return await this.handleServiceSelection(chatId, text, flow);
        case 'select_station':
          return await this.handleStationSelection(chatId, text, flow);
        case 'select_mechanic':
          return await this.handleMechanicSelection(chatId, text, flow);
        case 'select_date':
          return await this.handleDateSelection(chatId, text, flow);
        case 'select_time':
          return await this.handleTimeSelection(chatId, text, flow);
        case 'add_notes':
          return await this.handleNotesInput(chatId, text, flow);
        case 'confirm':
          return await this.handleConfirmation(chatId, text, flow);
        default:
          return false;
      }
    } catch (error) {
      await this.handleError(chatId, error);
      return true;
    }
  }

  async showVehicleSelection(chatId, vehicles) {
    const keyboard = {
      reply_markup: {
        keyboard: vehicles.map((v, i) => [{
          text: `${i + 1}. ${v.make} ${v.model} (${v.year})`
        }]).concat([['❌ Скасувати']]),
        resize_keyboard: true
      }
    };

    await this.bot.sendMessage(chatId, 
      '🚗 Оберіть автомобіль для запису:', keyboard);
  }

  async handleVehicleSelection(chatId, text, flow) {
    const index = parseInt(text.split('.')[0]) - 1;
    const vehicle = flow.data.vehicles[index];

    if (!vehicle) {
      await this.bot.sendMessage(chatId, 
        '❌ Неправильний вибір. Будь ласка, оберіть автомобіль зі списку.');
      return true;
    }

    flow.data.selected.vehicle = vehicle;
    flow.step = 'select_service';
    this.flows.set(chatId, flow);

    await this.showServiceSelection(chatId, flow.data.services);
    return true;
  }

  async showServiceSelection(chatId, services) {
    const keyboard = {
      reply_markup: {
        keyboard: services.map((s, i) => [{
          text: `${i + 1}. ${s.name} (${s.price} грн)`
        }]).concat([['⬅️ Назад'], ['❌ Скасувати']]),
        resize_keyboard: true
      }
    };

    await this.bot.sendMessage(chatId, 
      '🔧 Оберіть послугу:', keyboard);
  }

  async handleServiceSelection(chatId, text, flow) {
    if (text === '⬅️ Назад') {
      flow.step = 'select_vehicle';
      this.flows.set(chatId, flow);
      await this.showVehicleSelection(chatId, flow.data.vehicles);
      return true;
    }

    const index = parseInt(text.split('.')[0]) - 1;
    const service = flow.data.services[index];

    if (!service) {
      await this.bot.sendMessage(chatId, 
        '❌ Неправильний вибір. Будь ласка, оберіть послугу зі списку.');
      return true;
    }

    flow.data.selected.service = service;
    flow.step = 'select_station';
    this.flows.set(chatId, flow);

    await this.showStationSelection(chatId, flow.data.serviceStations);
    return true;
  }

  async showStationSelection(chatId, stations) {
    const keyboard = {
      reply_markup: {
        keyboard: stations.map((s, i) => [{
          text: `${i + 1}. ${s.name}`
        }]).concat([['⬅️ Назад'], ['❌ Скасувати']]),
        resize_keyboard: true
      }
    };

    await this.bot.sendMessage(chatId, 
      '🏢 Оберіть станцію обслуговування:', keyboard);
  }

  async handleStationSelection(chatId, text, flow) {
    if (text === '⬅️ Назад') {
      flow.step = 'select_service';
      this.flows.set(chatId, flow);
      await this.showServiceSelection(chatId, flow.data.services);
      return true;
    }

    const index = parseInt(text.split('.')[0]) - 1;
    const station = flow.data.serviceStations[index];

    if (!station) {
      await this.bot.sendMessage(chatId, 
        '❌ Неправильний вибір. Будь ласка, оберіть станцію зі списку.');
      return true;
    }

    flow.data.selected.station = station;
    flow.step = 'select_mechanic';
    this.flows.set(chatId, flow);

    // Отримуємо механіків для обраної станції
    await this.showMechanicSelection(chatId, station.id);
    return true;
  }

  async showMechanicSelection(chatId, stationId) {
    try {
      const mechanics = await this.getMechanicsByStation(stationId);
      
      if (mechanics.length === 0) {
        await this.bot.sendMessage(chatId, 
          '❌ На цій станції немає доступних механіків. Спробуйте іншу станцію.', {
          reply_markup: {
            keyboard: [['⬅️ Назад'], ['❌ Скасувати']],
            resize_keyboard: true
          }
        });
        return;
      }

      const keyboard = {
        reply_markup: {
          keyboard: mechanics.map((m, i) => [{
            text: (() => {
              const spec = m.specialization || (Array.isArray(m.specializations) ? m.specializations[0]?.name : m.specializations?.name) || '—';
              return `${i + 1}. ${m.first_name} ${m.last_name} (${spec})`;
            })()
          }]).concat([['⬅️ Назад'], ['❌ Скасувати']]),
          resize_keyboard: true
        }
      };

      await this.bot.sendMessage(chatId, 
        '👨‍🔧 Оберіть механіка:', keyboard);

      // Зберігаємо механіків у потоці
      const flow = this.flows.get(chatId);
      flow.data.mechanics = mechanics;
      this.flows.set(chatId, flow);
    } catch (error) {
      await this.bot.sendMessage(chatId, 
        '❌ Помилка при отриманні списку механіків.');
    }
  }

  async handleMechanicSelection(chatId, text, flow) {
    if (text === '⬅️ Назад') {
      flow.step = 'select_station';
      this.flows.set(chatId, flow);
      await this.showStationSelection(chatId, flow.data.serviceStations);
      return true;
    }

    const index = parseInt(text.split('.')[0]) - 1;
    const mechanic = flow.data.mechanics[index];

    if (!mechanic) {
      await this.bot.sendMessage(chatId, 
        '❌ Неправильний вибір. Будь ласка, оберіть механіка зі списку.');
      return true;
    }

    flow.data.selected.mechanic = mechanic;
    flow.step = 'select_date';
    this.flows.set(chatId, flow);

    await this.showDateSelection(chatId);
    return true;
  }

  async showDateSelection(chatId) {
    const today = new Date();
    const dates = [];
    
    // Показуємо дати на наступні 14 днів
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      // Пропускаємо неділі (вихідні)
      if (date.getDay() !== 0) {
        dates.push({
          text: date.toLocaleDateString('uk-UA', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short' 
          }),
          date: date.toISOString().split('T')[0]
        });
      }
    }

    const keyboard = {
      reply_markup: {
        keyboard: dates.map(d => [d.text]).concat([['⬅️ Назад'], ['❌ Скасувати']]),
        resize_keyboard: true
      }
    };

    await this.bot.sendMessage(chatId, 
      '📅 Оберіть дату:', keyboard);
  }

  async handleDateSelection(chatId, text, flow) {
    if (text === '⬅️ Назад') {
      flow.step = 'select_station';
      this.flows.set(chatId, flow);
      await this.showStationSelection(chatId, flow.data.serviceStations);
      return true;
    }

    // Парсинг дати з тексту
    const parts = text.split(' ');
    if (parts.length < 2) {
      await this.bot.sendMessage(chatId, 
        '❌ Неправильний формат дати.');
      return true;
    }

    // Конвертація в ISO формат
    const selectedDate = this.parseDateFromText(text);
    if (!selectedDate) {
      await this.bot.sendMessage(chatId, 
        '❌ Не вдалося розпізнати дату.');
      return true;
    }

    flow.data.selected.date = selectedDate;
    flow.step = 'select_time';
    this.flows.set(chatId, flow);

    await this.showTimeSelection(chatId);
    return true;
  }

  async showTimeSelection(chatId) {
    const timeSlots = [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
      '15:00', '15:30', '16:00', '16:30', '17:00'
    ];

    const keyboard = {
      reply_markup: {
        keyboard: timeSlots.map(t => [t]).concat([['⬅️ Назад'], ['❌ Скасувати']]),
        resize_keyboard: true
      }
    };

    await this.bot.sendMessage(chatId, 
      '⏰ Оберіть час:', keyboard);
  }

  async handleTimeSelection(chatId, text, flow) {
    if (text === '⬅️ Назад') {
      flow.step = 'select_date';
      this.flows.set(chatId, flow);
      await this.showDateSelection(chatId);
      return true;
    }

    if (!Validator.isValidTime(text)) {
      await this.bot.sendMessage(chatId, 
        '❌ Неправильний формат часу.');
      return true;
    }

    flow.data.selected.time = text;
    flow.step = 'add_notes';
    this.flows.set(chatId, flow);

    await this.bot.sendMessage(chatId, 
      '📝 Додаткові примітки (необов\'язково):\n\n' +
      'Наприклад: потрібна заміна масла, перевірка гальмівної системи\n\n' +
      'Натисніть "Пропустити" якщо немає приміток:', {
      reply_markup: {
        keyboard: [['Пропустити'], ['⬅️ Назад'], ['❌ Скасувати']],
        resize_keyboard: true
      }
    });
    return true;
  }

  async handleNotesInput(chatId, text, flow) {
    if (text === '⬅️ Назад') {
      flow.step = 'select_time';
      this.flows.set(chatId, flow);
      await this.showTimeSelection(chatId);
      return true;
    }

    if (text === 'Пропустити') {
      flow.data.selected.notes = '';
    } else {
      flow.data.selected.notes = text;
    }

    flow.step = 'confirm';
    this.flows.set(chatId, flow);

    await this.showConfirmation(chatId, flow.data.selected);
    return true;
  }

  async showConfirmation(chatId, selected) {
    const appointmentDate = new Date(`${selected.date}T${selected.time}`);
    const formattedDate = appointmentDate.toLocaleDateString('uk-UA', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });

    const message = `
📋 Підтвердження запису:

🚗 Автомобіль: ${selected.vehicle.make} ${selected.vehicle.model} (${selected.vehicle.year})
🔧 Послуга: ${selected.service.name}
🏢 Станція: ${selected.station.name}
👨‍🔧 Механік: ${selected.mechanic.first_name} ${selected.mechanic.last_name}
📅 Дата та час: ${formattedDate}
${selected.notes ? `📝 Примітки: ${selected.notes}` : ''}

💰 Вартість: ${selected.service.price} грн
⏱️ Тривалість: ${selected.service.duration} хв

Підтверджуєте запис?
    `;

    const keyboard = {
      reply_markup: {
        keyboard: [['✅ Підтвердити'], ['❌ Скасувати']],
        resize_keyboard: true
      }
    };

    await this.bot.sendMessage(chatId, message, keyboard);
  }

  async handleConfirmation(chatId, text, flow) {
    if (text === '✅ Підтвердити') {
      try {
        const user = await userManager.getUser(chatId);
        
        // Перевіряємо термін дії токена
        if (user.isTokenExpired()) {
          await this.bot.sendMessage(chatId, 
            '⚠️ Термін дії вашого сеансу закінчився. Будь ласка, авторизуйтесь знову.', 
            {
              reply_markup: {
                keyboard: [
                  ['🔑 Увійти'],
                  ['⬅️ Назад']
                ],
                resize_keyboard: true
              }
            });
          this.flows.delete(chatId);
          return true;
        }
        
        // Формуємо дані для створення запису відповідно до серверного API
        const appointmentData = {
          user_id: user.serverUserId,
          service_id: flow.data.selected.service.id,
          mechanic_id: flow.data.selected.mechanic.id,
          scheduled_time: `${flow.data.selected.date}T${flow.data.selected.time}:00.000Z`,
          notes: flow.data.selected.notes || null,
          car_info: {
            make: flow.data.selected.vehicle.make,
            model: flow.data.selected.vehicle.model,
            year: flow.data.selected.vehicle.year,
            license_plate: flow.data.selected.vehicle.license_plate,
            vin: flow.data.selected.vehicle.vin
          }
        };

        const result = await this.createAppointment(appointmentData, user.token);
        
        await this.bot.sendMessage(chatId, 
          '✅ Запис успішно створено!\n\n' +
          'Ви отримаєте сповіщення про підтвердження запису.',
          { reply_markup: { remove_keyboard: true } }
        );

        // Додаємо затримку перед переходом до головного меню
        setTimeout(async () => {
          await this.returnToMainMenu(chatId);
        }, 1000);

        this.flows.delete(chatId);
        return true;
      } catch (error) {
        await this.handleError(chatId, error);
        return true;
      }
    }

    // Скасування
    this.flows.delete(chatId);
    await this.bot.sendMessage(chatId, 
      '❌ Запис скасовано.',
      { reply_markup: { remove_keyboard: true } }
    );

    // Повертаємо користувача до головного меню
    await this.returnToMainMenu(chatId);
    return true;
  }

  // API методи
  async getUserVehicles(userId, token) {
    try {
      const response = await this.api.get('/api/vehicles', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      throw new Error('Не вдалося отримати список автомобілів');
    }
  }

  async getServices() {
    try {
      const response = await this.api.get('/api/telegram/services');
      return response.data;
    } catch (error) {
      throw new Error('Не вдалося отримати список послуг');
    }
  }

  async getServiceStations() {
    try {
      const response = await this.api.get('/api/telegram/stations');
      return response.data;
    } catch (error) {
      throw new Error('Не вдалося отримати список станцій');
    }
  }

  async createAppointment(appointmentData, token) {
    try {
      const response = await this.api.post('/api/telegram/appointments', appointmentData, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      throw new Error('Не вдалося створити запис');
    }
  }

  async getMechanicsByStation(stationId) {
    try {
      // Отримуємо всіх механіків і фільтруємо за станцією локально
      const response = await this.api.get('/api/mechanics');
      const mechanics = Array.isArray(response.data) ? response.data : [];
      return mechanics.filter(m => 
        m.service_station_id === stationId ||
        m.station_id === stationId ||
        m.service_stations?.id === stationId
      );
    } catch (error) {
      throw new Error('Не вдалося отримати список механіків');
    }
  }

  // Допоміжні методи
  parseDateFromText(text) {
    // Парсинг дати з формату "Пн, 25 груд."
    const parts = text.split(', ')[1].split(' ');
    const day = parseInt(parts[0]);
    const monthMap = {
      'січ': 0, 'лют': 1, 'бер': 2, 'кві': 3, 'тра': 4, 'чер': 5,
      'лип': 6, 'сер': 7, 'вер': 8, 'жов': 9, 'лис': 10, 'гру': 11
    };
    const month = monthMap[parts[1].slice(0, 3)];
    
    if (isNaN(day) || isNaN(month)) return null;
    
    const date = new Date();
    date.setMonth(month);
    date.setDate(day);
    
    // Якщо дата вже пройшла в цьому місяці, беремо наступний рік
    if (date < new Date()) {
      date.setFullYear(date.getFullYear() + 1);
    }
    
    return date.toISOString().split('T')[0];
  }

  async handleError(chatId, error) {
    const errorMessage = ErrorHandler.formatApiError(error);
    await this.bot.sendMessage(chatId, 
      `❌ Помилка: ${errorMessage}\n\nСпробуйте пізніше або зверніться до адміністратора.`,
      { reply_markup: { remove_keyboard: true } }
    );
    
    this.flows.delete(chatId);

    // Додаємо затримку перед переходом до головного меню
    setTimeout(async () => {
      await this.returnToMainMenu(chatId);
    }, 1500);
  }

  isActive(chatId) {
    return this.flows.has(chatId);
  }

  cancelFlow(chatId) {
    this.flows.delete(chatId);
  }

  async returnToMainMenu(chatId) {
    try {
      // Надсилаємо службове повідомлення та динамічну клавіатуру головного меню
      await this.bot.sendMessage(chatId, '🏠 Головне меню:', {
        reply_markup: {
          keyboard: [
            ['📋 Мої записи', '🚗 Мої авто'],
            ['➕ Новий запис', '➕ Додати авто'],
            ['🔧 Послуги', '📞 Контакти'],
            ['⚙️ Профіль']
          ],
          resize_keyboard: true
        }
      });
    } catch (e) {
      // fallback: просто прибираємо клавіатуру
      await this.bot.sendMessage(chatId, '🏠', { reply_markup: { remove_keyboard: true } });
    }
  }
}

module.exports = AppointmentFlow;