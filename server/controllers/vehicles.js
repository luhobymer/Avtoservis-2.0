const crypto = require('crypto');
const { getDb } = require('../db/d1');
const logger = require('../middleware/logger.js');

const formatVehicleRow = (vehicle) => {
  if (!vehicle) return null;
  return {
    id: vehicle.id,
    vin: vehicle.vin,
    make: vehicle.make || '',
    model: vehicle.model,
    year: vehicle.year,
    bodyType: vehicle.body_type || null,
    licensePlate:
      vehicle.license_plate || vehicle.licensePlate || vehicle.registration_number || null,
    registrationNumber: vehicle.registration_number || null,
    engineType: vehicle.engine_type || null,
    engineVolume: vehicle.engine_volume || null,
    color: vehicle.color,
    mileage: vehicle.mileage,
    user_id: vehicle.user_id,
    created_at: vehicle.created_at,
  };
};

const getAllVehicles = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('Unauthorized access attempt to vehicles');
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    logger.info(`[getAllVehicles] req.user.id: ${req.user.id}`);
    logger.info(`[getAllVehicles] Запит до БД D1 для користувача ${req.user.id}`);
    const db = await getDb();
    const data = await db.prepare('SELECT * FROM vehicles WHERE user_id = ?').all(req.user.id);
    logger.info(`[getAllVehicles] Отримано з БД: ${JSON.stringify(data)}`);

    const formattedData = (data || []).map(formatVehicleRow);

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

    const db = await getDb();
    const data = await db
      .prepare('SELECT * FROM vehicles WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
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
    res.json(formatVehicleRow(data));
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
    const { make, model, year, vin, registrationNumber, color, mileage } = req.body;

    logger.info(`Creating vehicle for user ${req.user.id} in D1`);

    const vehicleId = crypto.randomUUID();
    const now = new Date().toISOString();
    const db = await getDb();
    await db
      .prepare(
        `INSERT INTO vehicles
        (id, user_id, vin, make, model, year, color, license_plate, mileage, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        vehicleId,
        req.user.id,
        vin,
        make,
        model,
        year,
        color || null,
        registrationNumber || req.body.licensePlate || null,
        mileage ?? null,
        now,
        now
      );

    const createdVehicle = await db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId);
    logger.info(`Created new vehicle for user ${req.user.id}`);
    res.status(201).json(formatVehicleRow(createdVehicle));
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

    const { make, model, year, vin, registrationNumber, color, mileage } = req.body;

    const now = new Date().toISOString();
    const db = await getDb();
    const result = await db
      .prepare(
        `UPDATE vehicles
         SET vin = ?, make = ?, model = ?, year = ?, color = ?, license_plate = ?,
             mileage = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .run(
        vin,
        make,
        model,
        year,
        color || null,
        registrationNumber || req.body.licensePlate || null,
        mileage ?? null,
        now,
        req.params.id,
        req.user.id
      );

    if (result.changes === 0) {
      logger.warn(`Vehicle with ID ${req.params.id} not found for user ${req.user.id}`);
      return res.status(404).json({ msg: 'Vehicle not found' });
    }

    const updatedVehicle = await db
      .prepare('SELECT * FROM vehicles WHERE id = ?')
      .get(req.params.id);
    logger.info(`Updated vehicle with ID: ${req.params.id}`);
    res.json(formatVehicleRow(updatedVehicle));
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

    const db = await getDb();
    const result = await db
      .prepare('DELETE FROM vehicles WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);

    if (result.changes === 0) {
      logger.warn(`Vehicle with ID ${req.params.id} not found for user ${req.user.id}`);
      return res.status(404).json({ msg: 'Vehicle not found' });
    }

    logger.info(`Deleted vehicle with ID: ${req.params.id}`);
    res.json({ msg: 'Vehicle removed' });
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
