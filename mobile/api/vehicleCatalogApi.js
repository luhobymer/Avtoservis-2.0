import axiosAuth from './axiosConfig';

// Функція для отримання списку марок автомобілів
export const getVehicleMakes = async (token) => {
  try {
    const response = await axiosAuth.get('/api/vehicle-registry', {
      params: { type: 'makes' }
    });
    const rows = Array.isArray(response.data) ? response.data : [];
    return rows.map((row, index) => ({
      id: row.id || index + 1,
      name: row.name || row.make || ''
    }));
  } catch (apiError) {
    console.error('[API] Error fetching vehicle makes:', apiError);
    return [];
  }
};

// Функція для отримання списку моделей автомобілів за маркою
export const getVehicleModels = async (makeId, token) => {
  try {
    const otherModel = { id: `other_${makeId}`, name: 'Інша модель', make_id: makeId };
    const response = await axiosAuth.get('/api/vehicle-registry', {
      params: { type: 'models', make_id: makeId }
    });
    const rows = Array.isArray(response.data) ? response.data : [];
    return [...rows, otherModel];
  } catch (error) {
    console.error(`Error fetching vehicle models for make ID ${makeId}:`, error);
    return [{ id: `other_${makeId}`, name: 'Інша модель', make_id: makeId }];
  }
};

// Функція для отримання списку років випуску
export const getVehicleYears = async (makeId = null, modelId = null) => {
  try {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear; year >= 1970; year--) {
      years.push(year);
    }
    return years;
  } catch (error) {
    console.error('Error getting vehicle years:', error);
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = currentYear; year >= 1970; year--) {
      years.push(year);
    }
    return years;
  }
};

// Функція для отримання кольорів автомобілів
export const getVehicleColors = async () => {
  return [
    { id: 1, name: 'Білий', code: '#FFFFFF' },
    { id: 2, name: 'Чорний', code: '#000000' },
    { id: 3, name: 'Сірий', code: '#808080' },
    { id: 4, name: 'Сріблястий', code: '#C0C0C0' },
    { id: 5, name: 'Червоний', code: '#FF0000' },
    { id: 6, name: 'Синій', code: '#0000FF' },
    { id: 7, name: 'Зелений', code: '#008000' },
    { id: 8, name: 'Жовтий', code: '#FFFF00' },
    { id: 9, name: 'Коричневий', code: '#A52A2A' },
    { id: 10, name: 'Бежевий', code: '#F5F5DC' },
    { id: 11, name: 'Помаранчевий', code: '#FFA500' },
    { id: 12, name: 'Фіолетовий', code: '#800080' }
  ];
};
