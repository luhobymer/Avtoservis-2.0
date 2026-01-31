jest.mock('../utils/ocrUtils', () => ({
  ocrManager: {
    initialize: jest.fn().mockResolvedValue(),
    recognizeLicensePlate: jest.fn(async () => 'AA1234BB'),
    recognizeLicensePlateAndGetVehicleData: jest.fn(async () => ({
      licensePlate: 'AA1234BB'
    }))
  }
}));

const plateRegex = /[A-ZА-ЯІЇЄ]{2}[ ]?[0-9]{4}[ ]?[A-ZА-ЯІЇЄ]{2}/gi;

const normalizeLicensePlate = (plate) => {
  if (!plate) return null;
  return plate.replace(/[\s-]/g, '').toUpperCase();
};

describe('Логіка розпізнавання номерного знаку (regex + нормалізація)', () => {
  test('коректно знаходить номер у тексті без пробілів', () => {
    const text = 'Номерний знак AA1234BB зареєстровано в Україні';
    const matches = text.match(plateRegex);
    expect(matches).not.toBeNull();
    const normalized = normalizeLicensePlate(matches[0]);
    expect(normalized).toBe('AA1234BB');
  });

  test('коректно знаходить і нормалізує номер з пробілами', () => {
    const text = 'Номерний знак: AA 1234 BB';
    const matches = text.match(plateRegex);
    expect(matches).not.toBeNull();
    const normalized = normalizeLicensePlate(matches[0]);
    expect(normalized).toBe('AA1234BB');
  });
});
