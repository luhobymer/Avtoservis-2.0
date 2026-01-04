const { Validator, ErrorHandler } = require('../src/validator');

describe('Validator', () => {
  test('isValidPhone', () => {
    expect(Validator.isValidPhone('+380501234567')).toBe(true);
    expect(Validator.isValidPhone('050 123 45 67')).toBe(true);
    expect(Validator.isValidPhone('123')).toBe(false);
  });

  test('isValidEmail', () => {
    expect(Validator.isValidEmail('user@example.com')).toBe(true);
    expect(Validator.isValidEmail('bad@com')).toBe(false);
  });

  test('isValidVin', () => {
    expect(Validator.isValidVin('WVWZZZ1JZXW000001')).toBe(true);
    expect(Validator.isValidVin('SHORTVIN')).toBe(false);
  });

  test('isValidLicensePlate', () => {
    expect(Validator.isValidLicensePlate('AA1234BB')).toBe(true);
    expect(Validator.isValidLicensePlate('AA 1234 BB')).toBe(false); // пробіли не допускаються валідатором
    expect(Validator.isValidLicensePlate('1234')).toBe(false);
  });

  test('isValidDate (майбутня дата валідна, минула не валідна)', () => {
    const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const past = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    expect(Validator.isValidDate(future)).toBe(true);
    expect(Validator.isValidDate(past)).toBe(false);
  });

  test('isValidTime', () => {
    expect(Validator.isValidTime('09:00')).toBe(true);
    expect(Validator.isValidTime('23:59')).toBe(true);
    expect(Validator.isValidTime('24:00')).toBe(false);
  });

  test('sanitizeInput', () => {
    expect(Validator.sanitizeInput('<b>test</b>')).toBe('btest/b');
    expect(Validator.sanitizeInput('  ok  ')).toBe('ok');
    expect(Validator.sanitizeInput(123)).toBe('');
  });

  test('validateUserRegistration', () => {
    const good = { name: 'Іван', email: 'a@b.com', phone: '+380501234567' };
    const bad = { name: 'І', email: 'bad', phone: '123' };
    expect(Validator.validateUserRegistration(good)).toHaveLength(0);
    expect(Validator.validateUserRegistration(bad)).toHaveLength(3);
  });

  test('validateVehicleData', () => {
    const good = { make: 'Toyota', model: 'Camry', year: new Date().getFullYear(), vin: 'WVWZZZ1JZXW000001' };
    const bad = { make: 'T', model: 'C', year: 1800, vin: 'SHORTVIN' };
    expect(Validator.validateVehicleData(good)).toHaveLength(0);
    expect(Validator.validateVehicleData(bad).length).toBeGreaterThanOrEqual(3);
  });

  test('validateAppointmentData', () => {
    const future = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const good = { vehicle_id: 1, service_id: 1, appointment_date: future, appointment_time: '10:30' };
    const bad = { vehicle_id: null, service_id: null, appointment_date: '2000-01-01', appointment_time: '99:99' };
    expect(Validator.validateAppointmentData(good)).toHaveLength(0);
    expect(Validator.validateAppointmentData(bad).length).toBe(4);
  });

  test('formatPhone', () => {
    expect(Validator.formatPhone('+380501234567')).toBe('+380 (50) 123-45-67');
    expect(Validator.formatPhone('invalid')).toBe('invalid');
  });

  test('formatDate/formatDateTime return strings', () => {
    const now = new Date().toISOString();
    expect(typeof Validator.formatDate(now)).toBe('string');
    expect(typeof Validator.formatDateTime(now)).toBe('string');
  });

  test('getAvailableTimeSlots returns every 30 min 9-18', () => {
    const slots = Validator.getAvailableTimeSlots();
    expect(slots[0]).toBe('09:00');
    expect(slots[1]).toBe('09:30');
    expect(slots[slots.length - 1]).toBe('17:30');
  });

  test('isWorkingDay and getNextWorkingDay', () => {
    // Переконуємося, що повертає наступний робочий день
    const next = Validator.getNextWorkingDay();
    expect(Validator.isWorkingDay(next)).toBe(true);
  });
});

describe('ErrorHandler', () => {
  test('formatApiError by status', () => {
    expect(ErrorHandler.formatApiError({ response: { status: 400, data: { message: 'Bad' } } })).toBe('Bad');
    expect(ErrorHandler.formatApiError({ response: { status: 401 } })).toBe('Необхідна авторизація');
    expect(ErrorHandler.formatApiError({ response: { status: 403 } })).toBe('Доступ заборонено');
    expect(ErrorHandler.formatApiError({ response: { status: 404 } })).toBe('Запис не знайдено');
    expect(ErrorHandler.formatApiError({ response: { status: 500 } })).toBe('Помилка сервера, спробуйте пізніше');
    expect(ErrorHandler.formatApiError({ code: 'ECONNREFUSED' })).toBe('Не вдалося підключитися до сервера');
    expect(ErrorHandler.formatApiError({ message: 'Other' })).toBe('Other');
  });

  test('formatValidationError', () => {
    expect(ErrorHandler.formatValidationError(['A', 'B'])).toBe('A\n• B');
    expect(ErrorHandler.formatValidationError('X')).toBe('X');
  });
});
