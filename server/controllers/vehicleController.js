const crypto = require('crypto');
const { getDb } = require('../db/d1');

// Хелпер: нормалізація держномеру (прибирає пробіли/розділювачі, upper-case, мапить кирилицю на латиницю для однакових символів)
const normalizeLicensePlate = (input) => {
  if (!input) return '';
  const raw = String(input)
    .replace(/[\s\-_.]/g, '') // прибираємо пробіли та розділювачі
    .toUpperCase();
  const map = {
    А: 'A',
    В: 'B',
    С: 'C',
    Е: 'E',
    Н: 'H',
    І: 'I',
    К: 'K',
    М: 'M',
    О: 'O',
    Р: 'P',
    Т: 'T',
    Х: 'X',
  };
  return raw
    .split('')
    .map((ch) => map[ch] || ch)
    .join('');
};

const getVehicleColumnInfo = async (db) => {
  const columns = await db.prepare('PRAGMA table_info(vehicles)').all();
  const columnNames = new Set(columns.map((column) => column.name));
  const makeColumn = columnNames.has('make') ? 'make' : 'brand';
  const licenseColumn = columnNames.has('license_plate')
    ? 'license_plate'
    : columnNames.has('licensePlate')
      ? 'licensePlate'
      : columnNames.has('registration_number')
        ? 'registration_number'
        : 'license_plate';
  return {
    hasId: columnNames.has('id'),
    makeColumn,
    licenseColumn,
    hasCreatedAt: columnNames.has('created_at'),
    hasUpdatedAt: columnNames.has('updated_at'),
  };
};

const getServiceHistoryInfo = async (db) => {
  const serviceHistoryTable = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='service_history'")
    .get();
  if (serviceHistoryTable) {
    return { table: 'service_history', filterColumn: 'vehicle_vin' };
  }
  const serviceRecordsTable = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='service_records'")
    .get();
  if (serviceRecordsTable) {
    return { table: 'service_records', filterColumn: 'vehicle_id' };
  }
  return null;
};

exports.getUserVehicles = async (req, res) => {
  try {
    const db = await getDb();
    const { makeColumn, licenseColumn } = await getVehicleColumnInfo(db);
    const historyInfo = await getServiceHistoryInfo(db);

    const isMaster = req.user && req.user.role === 'master';
    const isAdminView = isMaster && String(req.query.admin || '') === '1';

    if (isAdminView) {
      const vehicles = await db
        .prepare(
          `SELECT v.*, u.name AS owner_name, u.email AS owner_email
           FROM vehicles v
           LEFT JOIN users u ON u.id = v.user_id
           ORDER BY v.created_at DESC`
        )
        .all();

      const vehiclesWithDetails = await Promise.all(
        vehicles.map(async (vehicle) => {
          const appointments = await db
            .prepare(
              'SELECT id, scheduled_time, status, completion_notes, service_id, mechanic_id FROM appointments WHERE vehicle_vin = ?'
            )
            .all(vehicle.vin);
          const historyTarget =
            historyInfo?.filterColumn === 'vehicle_id' ? vehicle.id : vehicle.vin;
          const serviceHistory = historyInfo
            ? await db
                .prepare(`SELECT * FROM ${historyInfo.table} WHERE ${historyInfo.filterColumn} = ?`)
                .all(historyTarget)
            : [];

          const appointmentsWithServices = await Promise.all(
            (appointments || []).map(async (appointment) => {
              if (appointment.service_id) {
                const service = await db
                  .prepare('SELECT name, description FROM services WHERE id = ?')
                  .get(appointment.service_id);
                return { ...appointment, services: service || null };
              }
              return appointment;
            })
          );

          return {
            ...vehicle,
            make: vehicle[makeColumn] || vehicle.make || vehicle.brand,
            brand: vehicle[makeColumn] || vehicle.brand || vehicle.make,
            licensePlate:
              vehicle[licenseColumn] ||
              vehicle.license_plate ||
              vehicle.licensePlate ||
              vehicle.registration_number,
            appointments: appointmentsWithServices,
            service_history: serviceHistory || [],
          };
        })
      );

      return res.json(vehiclesWithDetails);
    }

    const requestedUserId = req.query?.user_id ? String(req.query.user_id) : null;
    const userId =
      isMaster && requestedUserId
        ? requestedUserId
        : req.user?.id || req.params.userId || req.query?.user_id;
    if (!userId) {
      return res.status(400).json({ message: 'Не вказано користувача' });
    }

    const vehicles = await db
      .prepare('SELECT * FROM vehicles WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId);

    const vehiclesWithDetails = await Promise.all(
      vehicles.map(async (vehicle) => {
        const appointments = await db
          .prepare(
            'SELECT id, scheduled_time, status, completion_notes, service_id, mechanic_id FROM appointments WHERE vehicle_vin = ?'
          )
          .all(vehicle.vin);
        const historyTarget = historyInfo?.filterColumn === 'vehicle_id' ? vehicle.id : vehicle.vin;
        const serviceHistory = historyInfo
          ? await db
              .prepare(`SELECT * FROM ${historyInfo.table} WHERE ${historyInfo.filterColumn} = ?`)
              .all(historyTarget)
          : [];

        const appointmentsWithServices = await Promise.all(
          (appointments || []).map(async (appointment) => {
            if (appointment.service_id) {
              const service = await db
                .prepare('SELECT name, description FROM services WHERE id = ?')
                .get(appointment.service_id);
              return { ...appointment, services: service || null };
            }
            return appointment;
          })
        );

        return {
          ...vehicle,
          make: vehicle[makeColumn] || vehicle.make || vehicle.brand,
          brand: vehicle[makeColumn] || vehicle.brand || vehicle.make,
          licensePlate:
            vehicle[licenseColumn] ||
            vehicle.license_plate ||
            vehicle.licensePlate ||
            vehicle.registration_number,
          appointments: appointmentsWithServices,
          service_history: serviceHistory || [],
        };
      })
    );

    res.json(vehiclesWithDetails);
  } catch (err) {
    console.error('Get user vehicles error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Отримати автомобіль за VIN
exports.getVehicleByVin = async (req, res) => {
  try {
    const { vin } = req.params;

    const db = await getDb();
    const { makeColumn, licenseColumn } = await getVehicleColumnInfo(db);
    const historyInfo = await getServiceHistoryInfo(db);
    const vehicle = await db
      .prepare('SELECT * FROM vehicles WHERE vin = ? AND user_id = ?')
      .get(vin, req.user.id);

    if (!vehicle) {
      return res.status(404).json({ message: 'Автомобіль не знайдено' });
    }

    const appointments = await db
      .prepare(
        'SELECT id, scheduled_time, status, completion_notes, service_id, mechanic_id FROM appointments WHERE vehicle_vin = ?'
      )
      .all(vin);
    const historyTarget = historyInfo?.filterColumn === 'vehicle_id' ? vehicle.id : vin;
    const serviceHistory = historyInfo
      ? await db
          .prepare(`SELECT * FROM ${historyInfo.table} WHERE ${historyInfo.filterColumn} = ?`)
          .all(historyTarget)
      : [];

    const appointmentsWithDetails = await Promise.all(
      (appointments || []).map(async (appointment) => {
        let serviceData = null;
        let mechanicData = null;

        if (appointment.service_id) {
          serviceData = await db
            .prepare('SELECT name, description FROM services WHERE id = ?')
            .get(appointment.service_id);
        }

        if (appointment.mechanic_id) {
          mechanicData = await db
            .prepare('SELECT id, first_name, last_name FROM mechanics WHERE id = ?')
            .get(appointment.mechanic_id);
        }

        return {
          ...appointment,
          services: serviceData,
          mechanics: mechanicData,
        };
      })
    );

    const result = {
      ...vehicle,
      make: vehicle[makeColumn] || vehicle.make || vehicle.brand,
      brand: vehicle[makeColumn] || vehicle.brand || vehicle.make,
      licensePlate:
        vehicle[licenseColumn] ||
        vehicle.license_plate ||
        vehicle.licensePlate ||
        vehicle.registration_number,
      appointments: appointmentsWithDetails,
      service_history: serviceHistory || [],
    };

    res.json(result);
  } catch (err) {
    console.error('Get vehicle error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Додати новий автомобіль
exports.addVehicle = async (req, res) => {
  try {
    const {
      vin,
      make,
      model,
      year,
      color,
      mileage,
      licensePlate,
      license_plate,
      brand,
      user_id, // для Telegram API
    } = req.body;

    const db = await getDb();
    const { hasId, makeColumn, licenseColumn, hasCreatedAt, hasUpdatedAt } =
      await getVehicleColumnInfo(db);
    const existingVehicle = await db.prepare('SELECT vin FROM vehicles WHERE vin = ?').get(vin);

    if (existingVehicle) {
      return res.status(400).json({ message: 'Автомобіль з таким VIN вже існує' });
    }

    const brandValue = brand || make;
    const licensePlateValue = licensePlate || license_plate;
    const normalizedLicensePlate = normalizeLicensePlate(licensePlateValue);
    const vehicleId = crypto.randomUUID();
    const now = new Date().toISOString();

    const insertColumns = ['user_id', 'vin', makeColumn, 'model', 'year', 'color', 'mileage'];
    const effectiveUserId =
      req.user && req.user.role === 'master' && user_id ? String(user_id) : req.user?.id || user_id;

    const insertValues = [
      effectiveUserId,
      vin,
      brandValue,
      model,
      year,
      color || null,
      mileage ?? null,
    ];

    if (hasId) {
      insertColumns.unshift('id');
      insertValues.unshift(vehicleId);
    }
    if (licenseColumn) {
      insertColumns.push(licenseColumn);
      insertValues.push(normalizedLicensePlate || null);
    }
    if (hasCreatedAt) {
      insertColumns.push('created_at');
      insertValues.push(now);
    }
    if (hasUpdatedAt) {
      insertColumns.push('updated_at');
      insertValues.push(now);
    }

    const placeholders = insertColumns.map(() => '?').join(', ');
    await db
      .prepare(`INSERT INTO vehicles (${insertColumns.join(', ')}) VALUES (${placeholders})`)
      .run(...insertValues);

    const inserted = hasId
      ? await db.prepare('SELECT * FROM vehicles WHERE id = ?').get(vehicleId)
      : await db.prepare('SELECT * FROM vehicles WHERE vin = ?').get(vin);

    const result = {
      ...inserted,
      make: inserted[makeColumn] || inserted.make || inserted.brand,
      licensePlate:
        inserted[licenseColumn] ||
        inserted.license_plate ||
        inserted.licensePlate ||
        inserted.registration_number,
    };

    res.status(201).json(result);
  } catch (err) {
    console.error('Add vehicle error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Оновити інформацію про автомобіль
exports.updateVehicle = async (req, res) => {
  try {
    const { vin } = req.params;
    const { make, model, year, color, mileage, brand, user_id } = req.body;

    const licensePlateValue = req.body.licensePlate || req.body.license_plate;
    const normalizedLicensePlate = licensePlateValue
      ? normalizeLicensePlate(licensePlateValue)
      : undefined;

    const db = await getDb();
    const { makeColumn, licenseColumn, hasUpdatedAt } = await getVehicleColumnInfo(db);
    const isMaster = req.user && req.user.role === 'master';
    const existingVehicle = isMaster
      ? await db.prepare('SELECT * FROM vehicles WHERE vin = ?').get(vin)
      : await db
          .prepare('SELECT * FROM vehicles WHERE vin = ? AND user_id = ?')
          .get(vin, req.user.id);

    if (!existingVehicle) {
      return res.status(404).json({ message: 'Автомобіль не знайдено' });
    }

    const updateData = {};
    if (isMaster && user_id !== undefined) {
      updateData.user_id = user_id || null;
    }
    if (brand !== undefined || make !== undefined) {
      updateData[makeColumn] = brand ?? make;
    }
    if (model !== undefined) updateData.model = model;
    if (year !== undefined) updateData.year = year;
    if (color !== undefined) updateData.color = color;
    if (mileage !== undefined) updateData.mileage = mileage;
    if (licensePlateValue) {
      updateData[licenseColumn] = normalizedLicensePlate || null;
    }
    if (hasUpdatedAt) {
      updateData.updated_at = new Date().toISOString();
    }

    const fields = Object.keys(updateData);
    if (fields.length > 0) {
      const setClause = fields.map((field) => `${field} = ?`).join(', ');
      const values = fields.map((field) => updateData[field]);
      if (isMaster) {
        await db.prepare(`UPDATE vehicles SET ${setClause} WHERE vin = ?`).run(...values, vin);
      } else {
        await db
          .prepare(`UPDATE vehicles SET ${setClause} WHERE vin = ? AND user_id = ?`)
          .run(...values, vin, req.user.id);
      }
    }

    const data = isMaster
      ? await db.prepare('SELECT * FROM vehicles WHERE vin = ?').get(vin)
      : await db
          .prepare('SELECT * FROM vehicles WHERE vin = ? AND user_id = ?')
          .get(vin, req.user.id);

    const result = {
      ...data,
      make: data[makeColumn] || data.make || data.brand,
      licensePlate:
        data[licenseColumn] || data.license_plate || data.licensePlate || data.registration_number,
    };

    res.json(result);
  } catch (err) {
    console.error('Update vehicle error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Видалити автомобіль
exports.deleteVehicle = async (req, res) => {
  try {
    const { vin } = req.params;

    const db = await getDb();
    const activeAppointment = await db
      .prepare(
        "SELECT id FROM appointments WHERE vehicle_vin = ? AND status IN ('pending', 'confirmed') LIMIT 1"
      )
      .get(vin);

    if (activeAppointment) {
      return res.status(400).json({
        message: 'Неможливо видалити автомобіль з активними записами на обслуговування',
      });
    }

    const isMaster = req.user && req.user.role === 'master';
    if (isMaster) {
      await db.prepare('DELETE FROM vehicles WHERE vin = ?').run(vin);
    } else {
      await db.prepare('DELETE FROM vehicles WHERE vin = ? AND user_id = ?').run(vin, req.user.id);
    }

    res.status(204).send();
  } catch (err) {
    console.error('Delete vehicle error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Отримати автомобіль за номерним знаком
exports.getVehicleByLicensePlate = async (req, res) => {
  try {
    const { licensePlate } = req.params;
    const normalizedPlate = normalizeLicensePlate(licensePlate);

    const db = await getDb();
    const { makeColumn, licenseColumn } = await getVehicleColumnInfo(db);
    const vehicle = await db
      .prepare(`SELECT * FROM vehicles WHERE ${licenseColumn} = ?`)
      .get(normalizedPlate);

    if (!vehicle) {
      return res.status(404).json({ message: 'Автомобіль не знайдено' });
    }

    const result = {
      ...vehicle,
      make: vehicle[makeColumn] || vehicle.make || vehicle.brand,
      brand: vehicle[makeColumn] || vehicle.brand || vehicle.make,
      licensePlate:
        vehicle[licenseColumn] ||
        vehicle.license_plate ||
        vehicle.licensePlate ||
        vehicle.registration_number,
    };

    res.json(result);
  } catch (err) {
    console.error('Get vehicle by license plate error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Отримати автомобіль за номерним знаком для Telegram бота
exports.getVehicleByLicensePlateForBot = async (req, res) => {
  try {
    const { licensePlate } = req.params;
    const normalizedPlate = normalizeLicensePlate(licensePlate);

    const db = await getDb();
    const { makeColumn, licenseColumn } = await getVehicleColumnInfo(db);
    const vehicle = await db
      .prepare(`SELECT * FROM vehicles WHERE ${licenseColumn} = ?`)
      .get(normalizedPlate);

    if (!vehicle) {
      return res.status(404).json({ message: 'Автомобіль не знайдено' });
    }

    const owner = await db
      .prepare('SELECT id, name, phone FROM users WHERE id = ?')
      .get(vehicle.user_id);

    const result = {
      ...vehicle,
      make: vehicle[makeColumn] || vehicle.make || vehicle.brand,
      brand: vehicle[makeColumn] || vehicle.brand || vehicle.make,
      licensePlate:
        vehicle[licenseColumn] ||
        vehicle.license_plate ||
        vehicle.licensePlate ||
        vehicle.registration_number,
      owner: owner || null,
    };

    res.json(result);
  } catch (err) {
    console.error('Get vehicle by license plate for bot error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};
