const {
  formatLicensePlate,
  normalizeLicensePlate,
  getRequiredFields,
  getMissingFields,
  formatVehicleDataMessage,
} = require('../src/utils/vehicle');

describe('vehicle utils', () => {
  describe('formatLicensePlate', () => {
    test('formats AA1234BB -> AA 1234 BB', () => {
      expect(formatLicensePlate('aa1234bb')).toBe('AA 1234 BB');
    });
    test('keeps unknown formats normalized', () => {
      expect(formatLicensePlate('AX12Z')).toBe('AX12Z');
    });
    test('handles spaces/dashes', () => {
      expect(formatLicensePlate(' AA-1234-bb ')).toBe('AA 1234 BB');
    });
    test('empty -> empty', () => {
      expect(formatLicensePlate('')).toBe('');
    });
  });

  describe('normalizeLicensePlate', () => {
    test('normalizes cyrillic to latin and strips non-alnum', () => {
      expect(normalizeLicensePlate('АА 1234 ВВ')).toBe('AA1234BB');
    });
    test('returns empty for falsy', () => {
      expect(normalizeLicensePlate('')).toBe('');
    });
  });

  describe('getRequiredFields/getMissingFields', () => {
    test('required are vin, make, model', () => {
      expect(getRequiredFields()).toEqual(['vin', 'make', 'model']);
    });
    test('missing considers brand as make fallback', () => {
      const data = { vin: 'VIN', brand: 'VW', model: '' };
      expect(getMissingFields(data)).toEqual(['model']);
    });
    test('all missing', () => {
      expect(getMissingFields({})).toEqual(['vin', 'make', 'model']);
    });
  });

  describe('formatVehicleDataMessage', () => {
    test('shows found data and missing list', () => {
      const vehicle = {
        make: 'Volkswagen',
        model: 'Golf',
        year: 2014,
        licensePlate: 'AA1234BB',
        vin: 'WVWZZZ1KZAM123456',
        color: 'Gray',
      };
      const missing = ['model']; // intentionally include one missing that actually exists -> should be ignored by formatter
      const msg = formatVehicleDataMessage(vehicle, missing);
      expect(msg).toContain('✅ <b>Знайдені дані:</b>');
      expect(msg).toContain('Volkswagen Golf (2014)');
      expect(msg).toContain('🚙 Держномер: <b>AA 1234 BB</b>');
      expect(msg).toContain('🔢 VIN: WVWZZZ1KZAM123456');
      // Missing list will include only known keys; provided array contains 'model' which is known
      expect(msg).toContain('❌ <b>Відсутні обов\'язкові дані:</b>');
      expect(msg).toContain('• 🚗 Модель автомобіля');
    });

    test('only missing block when nothing found', () => {
      const msg = formatVehicleDataMessage({}, ['vin', 'make']);
      expect(msg).toContain('❌ <b>Відсутні обов\'язкові дані:</b>');
      expect(msg).toContain('VIN-код');
      expect(msg).toContain('Марка автомобіля');
    });
  });
});
