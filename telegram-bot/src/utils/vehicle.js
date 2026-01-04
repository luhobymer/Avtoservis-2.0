// src/utils/vehicle.js

// Форматування державного номерного знаку (вивід для користувача)
function formatLicensePlate(licensePlate) {
  if (!licensePlate) return '';
  const cleanPlate = String(licensePlate).replace(/[\s-]/g, '').toUpperCase();

  // AA 1234 BB
  if (cleanPlate.length === 8 && /^[A-ZА-ЯІЇЄҐ]{2}[0-9]{4}[A-ZА-ЯІЇЄҐ]{2}$/i.test(cleanPlate)) {
    return `${cleanPlate.substring(0, 2)} ${cleanPlate.substring(2, 6)} ${cleanPlate.substring(6, 8)}`;
  }
  // A 1234 BB або A 123 BB
  if (cleanPlate.length === 7 && /^[A-ZА-ЯІЇЄҐ]{1}[0-9]{3,4}[A-ZА-ЯІЇЄҐ]{2}$/i.test(cleanPlate)) {
    return `${cleanPlate.substring(0, 1)} ${cleanPlate.substring(1, 5)} ${cleanPlate.substring(5, 7)}`;
  }
  // AA 123 B
  if (cleanPlate.length === 7 && /^[A-ZА-ЯІЇЄҐ]{2}[0-9]{3,4}[A-ZА-ЯІЇЄҐ]{1}$/i.test(cleanPlate)) {
    return `${cleanPlate.substring(0, 2)} ${cleanPlate.substring(2, 6)} ${cleanPlate.substring(6, 7)}`;
  }
  return cleanPlate;
}

// Нормалізація номерного знаку для порівняння/пошуку
function normalizeLicensePlate(plate) {
  if (!plate) return '';
  const map = {
    'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H', 'І': 'I', 'Ї': 'YI', 'Є': 'YE', 'Ґ': 'G', 'К': 'K', 'М': 'M',
    'О': 'O', 'Р': 'P', 'Т': 'T', 'Х': 'X', 'Й': 'I', 'Ё': 'E', 'Ъ': '', 'Ь': '', 'Ы': 'Y', 'Я': 'YA', 'Ю': 'YU'
  };
  const cleaned = String(plate).toUpperCase().replace(/[^A-ZА-ЯЁІЇЄҐ0-9]/g, '');
  const cyrToLat = cleaned.replace(/[А-ЯЁІЇЄҐ]/g, ch => map[ch] || ch);
  return cyrToLat;
}

// Перелік обов'язкових полів авто для створення на сервері
function getRequiredFields() {
  return ['vin', 'make', 'model'];
}

// Визначення відсутніх полів у даних авто
function getMissingFields(carData = {}) {
  const requiredFields = getRequiredFields();
  const missing = [];
  for (const field of requiredFields) {
    const value = field === 'make' ? (carData.make || carData.brand) : carData[field];
    if (value === undefined || value === null || value === '') {
      missing.push(field);
    }
  }
  return missing;
}

// Формування повідомлення про знайдені/відсутні дані авто (чисте форматування без залежностей на bot)
function formatVehicleDataMessage(vehicle = {}, missingFields = []) {
  const formattedLicensePlate = formatLicensePlate(
    vehicle.licensePlate || vehicle.license_plate || vehicle.registration_number || ''
  );

  let message = '';
  const make = vehicle.brand || vehicle.make || '';
  const model = vehicle.model || '';

  // Блок знайдених даних
  if (make || model || vehicle.year || vehicle.vin || vehicle.color || vehicle.mileage || vehicle.engine || vehicle.engineCapacity || vehicle.fuel || vehicle.fuelType || vehicle.transmission || vehicle.drive || vehicle.driveType || vehicle.body || vehicle.bodyType || vehicle.ownersCount !== undefined || vehicle.registrationDate || vehicle.lastServiceDate || vehicle.last_service_date || vehicle.nextServiceDueKm || vehicle.next_service_due_km) {
    message += '✅ <b>Знайдені дані:</b>\n\n';
    if (make || model) {
      message += `🚗 ${make} ${model} ${vehicle.year ? `(${vehicle.year})` : ''}\n`;
    }
    if (formattedLicensePlate) message += `🚙 Держномер: <b>${formattedLicensePlate}</b>\n`;
    if (vehicle.vin) message += `🔢 VIN: ${vehicle.vin}\n`;
    if (vehicle.color) message += `🎨 Колір: ${vehicle.color}\n`;
    if (vehicle.mileage) message += `📊 Пробіг: ${vehicle.mileage} км\n`;

    if (vehicle.engine || vehicle.engineCapacity) {
      const engineStr = vehicle.engine ? String(vehicle.engine) : '';
      const capacity = vehicle.engineCapacity ? `${vehicle.engineCapacity} л` : '';
      const combined = [engineStr, capacity].filter(Boolean).join(' · ');
      if (combined) message += `🛠️ Двигун: ${combined}\n`;
    }
    if (vehicle.fuel || vehicle.fuelType) message += `⛽ Паливо: ${vehicle.fuel || vehicle.fuelType}\n`;
    if (vehicle.transmission) message += `⚙️ Трансмісія: ${vehicle.transmission}\n`;
    if (vehicle.drive || vehicle.driveType) message += `🧭 Привід: ${vehicle.drive || vehicle.driveType}\n`;
    if (vehicle.body || vehicle.bodyType) message += `🚘 Тип кузова: ${vehicle.body || vehicle.bodyType}\n`;
    if (vehicle.ownersCount !== undefined) message += `👥 Кількість власників: ${vehicle.ownersCount}\n`;
    if (vehicle.registrationDate) message += `🗓️ Дата реєстрації: ${vehicle.registrationDate}\n`;
    if (vehicle.lastServiceDate || vehicle.last_service_date) message += `🛠️ Останнє ТО: ${vehicle.lastServiceDate || vehicle.last_service_date}\n`;
    if (vehicle.nextServiceDueKm || vehicle.next_service_due_km) message += `📅 Наступне ТО: через ${vehicle.nextServiceDueKm || vehicle.next_service_due_km} км\n`;
  }

  // Блок відсутніх даних
  if (missingFields.length > 0) {
    if (message) message += '\n';
    message += '❌ <b>Відсутні обов\'язкові дані:</b>\n\n';
    const fieldNames = {
      vin: '🔢 VIN-код',
      make: '🚗 Марка автомобіля',
      model: '🚗 Модель автомобіля',
      year: '📅 Рік випуску',
      licensePlate: '🚙 Держномер',
      color: '🎨 Колір',
      mileage: '📊 Пробіг'
    };
    missingFields.forEach(f => {
      if (fieldNames[f]) message += `• ${fieldNames[f]}\n`;
    });
  }
  return message;
}

module.exports = {
  formatLicensePlate,
  normalizeLicensePlate,
  getRequiredFields,
  getMissingFields,
  formatVehicleDataMessage,
};
