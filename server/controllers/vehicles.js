const supabase = require('../config/supabase.js');
const logger = require('../middleware/logger.js');

const getAllVehicles = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('Unauthorized access attempt to vehicles');
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    // --- Реальний запит до Supabase ---
    logger.info(`[getAllVehicles] req.user.id: ${req.user.id}`);
    logger.info(`[getAllVehicles] Запит до БД Supabase для користувача ${req.user.id}`);
    const { data, error } = await supabase.from('vehicles').select('*').eq('user_id', req.user.id);

    if (error) {
      logger.error('[getAllVehicles] Помилка отримання транспортних засобів:', error);
      return res
        .status(500)
        .json({ error: 'Помилка отримання транспортних засобів', details: error.message });
    }
    logger.info(`[getAllVehicles] Отримано з БД: ${JSON.stringify(data)}`);

    const formattedData = (data || []).map((v) => ({
      id: v.id,
      vin: v.vin,
      make: v.brand || v.make || '',
      model: v.model,
      year: v.year,
      bodyType: v.body_type,
      licensePlate: v.license_plate || v.licensePlate || v.registration_number,
      registrationNumber: v.registration_number,
      engineType: v.engine_type,
      engineVolume: v.engine_volume,
      color: v.color,
      mileage: v.mileage,
      user_id: v.user_id,
      created_at: v.created_at,
    }));

    if (formattedData.length > 0) {
      logger.info(
        `[getAllVehicles] Перший транспортний засіб: ${JSON.stringify(formattedData[0])}`
      );
    } else {
      logger.warn('[getAllVehicles] Транспортні засоби не знайдено для цього користувача');
    }
    res.json(formattedData);
  } catch (err) {
    logger.error('Server error in getAllVehicles:', err);
    res.status(500).json({
      error: 'Failed to fetch vehicles',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
};

const getVehicleById = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('Unauthorized access attempt to vehicle details');
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    logger.info(
      `[getVehicleById] Запит автомобіля з ID: ${req.params.id} для користувача: ${req.user.id}`
    );

    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      logger.error(`[getVehicleById] Помилка отримання автомобіля з ID ${req.params.id}:`, error);
      return res.status(500).json({
        error: 'Помилка отримання даних автомобіля',
        details: error.message,
        code: error.code,
        request: {
          id: req.params.id,
          user_id: req.user.id,
        },
      });
    }

    logger.info(`[getVehicleById] Отримано з БД: ${JSON.stringify(data)}`);

    if (!data) {
      logger.warn(
        `[getVehicleById] Автомобіль з ID ${req.params.id} не знайдено для користувача ${req.user.id}`
      );
      return res.status(404).json({ msg: 'Автомобіль не знайдено' });
    }

    logger.info(
      `[getVehicleById] Успішно отримано автомобіль ${req.params.id} для користувача ${req.user.id}`
    );

    // Перетворюємо дані для клієнта (змінюємо назви полів)
    const formattedData = {
      id: data.id,
      vin: data.vin,
      make: data.brand || data.make || '',
      model: data.model,
      year: data.year,
      bodyType: data.body_type,
      licensePlate: data.license_plate,
      registrationNumber: data.registration_number,
      engineType: data.engine_type,
      engineVolume: data.engine_volume,
      color: data.color,
      mileage: data.mileage,
      user_id: data.user_id,
      created_at: data.created_at,
    };

    res.json(formattedData);
  } catch (err) {
    logger.error('[getVehicleById] Помилка сервера при отриманні автомобіля:', err);
    res.status(500).json({
      error: 'Помилка отримання даних автомобіля',
      details: err.message,
      request: {
        id: req.params.id,
        user_id: req.user?.id,
      },
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
};

const createVehicle = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('Unauthorized attempt to create vehicle');
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    // Отримуємо дані з запиту
    const {
      make,
      model,
      year,
      bodyType,
      vin,
      registrationNumber,
      engineType,
      engineVolume,
      color,
      mileage,
    } = req.body;

    logger.info(`Creating vehicle for user ${req.user.id} in Supabase`);

    // Додаємо автомобіль до бази даних Supabase
    const { data, error } = await supabase
      .from('vehicles')
      .insert([
        {
          brand: make,
          model,
          year,
          body_type: bodyType,
          vin,
          registration_number: registrationNumber,
          engine_type: engineType,
          engine_volume: engineVolume,
          color,
          mileage,
          user_id: req.user.id,
        },
      ])
      .single();

    if (error) {
      logger.error('Failed to create vehicle:', error);
      throw error;
    }

    logger.info(`Created new vehicle for user ${req.user.id}`);
    res.status(201).json(data);
  } catch (err) {
    logger.error('Server error in createVehicle:', err);
    res.status(500).json({
      error: 'Failed to create vehicle',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
};

const updateVehicle = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('Unauthorized attempt to update vehicle');
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const {
      make,
      model,
      year,
      bodyType,
      vin,
      registrationNumber,
      engineType,
      engineVolume,
      color,
      mileage,
    } = req.body;

    const { data, error } = await supabase
      .from('vehicles')
      .update([
        {
          brand: make,
          model,
          year,
          body_type: bodyType,
          vin,
          registration_number: registrationNumber,
          engine_type: engineType,
          engine_volume: engineVolume,
          color,
          mileage,
          user_id: req.user.id,
        },
      ])
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      logger.error('Failed to update vehicle:', error);
      throw error;
    }

    if (!data) {
      logger.warn(`Vehicle with ID ${req.params.id} not found for user ${req.user.id}`);
      return res.status(404).json({ msg: 'Vehicle not found' });
    }

    logger.info(`Updated vehicle with ID: ${req.params.id}`);
    res.json(data);
  } catch (err) {
    logger.error('Server error in updateVehicle:', err);
    res.status(500).json({
      error: 'Failed to update vehicle',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
};

const deleteVehicle = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('Unauthorized attempt to delete vehicle');
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    // Для тестування, повертаємо повідомлення про успішне видалення, щоб уникнути помилок з базою даних
    res.json({ msg: 'Vehicle removed' });

    /* Закоментовано до завершення міграції на Supabase
    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) {
      logger.error('Failed to delete vehicle:', error);
      throw error;
    }
    
    logger.info(`Deleted vehicle with ID: ${req.params.id}`);
    res.json({ msg: 'Vehicle removed' });
    */
  } catch (err) {
    logger.error('Server error in deleteVehicle:', err);
    res.status(500).json({
      error: 'Failed to delete vehicle',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
};

module.exports = {
  getAllVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
};
