class Validator {
  static isValidPhone(phone) {
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
    return phoneRegex.test(phone);
  }

  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidVin(vin) {
    // VIN має бути 17 символів
    return /^[A-HJ-NPR-Z\d]{17}$/i.test(vin);
  }

  static isValidLicensePlate(plate) {
    // Український формат номерів (дозволяємо латиницю та кирилицю, без пробілів)
    const uaPlateRegex = /^[A-ZА-ЯІЇЄҐ]{2}\d{4}[A-ZА-ЯІЇЄҐ]{2}$/i;
    return uaPlateRegex.test(plate);
  }

  static isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date) && date > new Date();
  }

  static isValidTime(timeString) {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeString);
  }

  static sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[<>]/g, '');
  }

  static validateUserRegistration(userData) {
    const errors = [];

    if (!userData.name || userData.name.trim().length < 2) {
      errors.push('Ім\'я має містити щонайменше 2 символи');
    }

    if (!userData.email || !this.isValidEmail(userData.email)) {
      errors.push('Введіть коректну email адресу');
    }

    if (!userData.phone || !this.isValidPhone(userData.phone)) {
      errors.push('Введіть коректний номер телефону');
    }

    return errors;
  }

  static validateVehicleData(vehicleData) {
    const errors = [];

    if (!vehicleData.make || vehicleData.make.trim().length < 2) {
      errors.push('Вкажіть марку автомобіля');
    }

    if (!vehicleData.model || vehicleData.model.trim().length < 2) {
      errors.push('Вкажіть модель автомобіля');
    }

    if (!vehicleData.year || vehicleData.year < 1900 || vehicleData.year > new Date().getFullYear() + 1) {
      errors.push('Вкажіть коректний рік випуску');
    }

    if (!vehicleData.vin || !this.isValidVin(vehicleData.vin)) {
      errors.push('VIN номер має містити 17 символів');
    }

    return errors;
  }

  static validateAppointmentData(appointmentData) {
    const errors = [];

    if (!appointmentData.vehicle_id) {
      errors.push('Не вибрано автомобіль');
    }

    if (!appointmentData.service_id) {
      errors.push('Не вибрано послугу');
    }

    if (!appointmentData.appointment_date || !this.isValidDate(appointmentData.appointment_date)) {
      errors.push('Вкажіть коректну дату (майбутню)');
    }

    if (!appointmentData.appointment_time || !this.isValidTime(appointmentData.appointment_time)) {
      errors.push('Вкажіть коректний час');
    }

    return errors;
  }

  static formatPhone(phone) {
    // Форматуємо +380501234567 -> +380 (50) 123-45-67
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 12 && cleaned.startsWith('380')) {
      const cc = '+380';
      const p1 = cleaned.slice(3, 5);
      const p2 = cleaned.slice(5, 8);
      const p3 = cleaned.slice(8, 10);
      const p4 = cleaned.slice(10);
      return `${cc} (${p1}) ${p2}-${p3}-${p4}`;
    }
    return phone;
  }

  static formatDate(date) {
    const d = new Date(date);
    if (isNaN(d)) return date;
    return d.toLocaleDateString('uk-UA');
  }

  static formatDateTime(dateTime) {
    const d = new Date(dateTime);
    if (isNaN(d)) return dateTime;
    return d.toLocaleString('uk-UA');
  }

  static getAvailableTimeSlots() {
    const slots = [];
    for (let h = 9; h <= 17; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    return slots;
  }

  static isWorkingDay(date) {
    const d = new Date(date);
    const day = d.getDay();
    return day !== 0 && day !== 6; // Пн-Пт
  }

  static getNextWorkingDay() {
    const d = new Date();
    do {
      d.setDate(d.getDate() + 1);
    } while (!this.isWorkingDay(d));
    return d.toISOString();
  }
}

class ErrorHandler {
  static formatApiError(error) {
    // Виводимо найчитабельніше повідомлення
    if (error?.response?.data?.message) return error.response.data.message;

    const status = error?.response?.status;
    switch (status) {
      case 401:
        return 'Необхідна авторизація';
      case 403:
        return 'Доступ заборонено';
      case 404:
        return 'Запис не знайдено';
      case 500:
        return 'Помилка сервера, спробуйте пізніше';
      default:
        break;
    }

    if (error?.code === 'ECONNREFUSED') return 'Не вдалося підключитися до сервера';
    return error?.message || 'Сталася помилка';
  }

  static formatValidationError(errors) {
    if (Array.isArray(errors)) {
      return errors.join('\n• ');
    }
    return String(errors);
  }

  static logError(context, error, userId = null) {
    // Уніфікований логер
    const message = error?.message || String(error);
    const stack = error?.stack;
    const meta = { context, userId };
    // Тут міг би бути виклик зовнішнього лог-сервісу
    // console.error(message, { stack, ...meta });
    return { message, stack, ...meta };
  }
}

module.exports = {
  Validator,
  ErrorHandler
};