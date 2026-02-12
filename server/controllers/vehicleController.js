const crypto = require('crypto');
const { getDb } = require('../db/d1');
const defaultMaintenanceTasks = require('../utils/defaultMaintenance');

const normalizeLicensePlate = (input) => {
  if (!input) return '';
  const raw = String(input)
    .replace(/[\s\-_.]/g, '')
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
  const columnNames = new Set((columns || []).map((column) => column.name));
  const makeColumn = columnNames.has('make') ? 'make' : columnNames.has('brand') ? 'brand' : 'make';
  const ownerColumn = columnNames.has('user_id')
    ? 'user_id'
    : columnNames.has('UserId')
      ? 'UserId'
      : columnNames.has('userId')
        ? 'userId'
        : 'user_id';
  const licenseColumn = columnNames.has('license_plate')
    ? 'license_plate'
    : columnNames.has('licensePlate')
      ? 'licensePlate'
      : columnNames.has('registration_number')
        ? 'registration_number'
        : 'license_plate';

  return {
    columnNames,
    makeColumn,
    ownerColumn,
    licenseColumn,
    hasCreatedAt: columnNames.has('created_at'),
  };
};

const ownerColumnCandidates = ['user_id', 'UserId', 'userId'];

const resolveOwnerColumn = async (db) => {
  try {
    const columns = await db.prepare('PRAGMA table_info(vehicles)').all();
    const names = new Set((columns || []).map((column) => column.name));
    const match = ownerColumnCandidates.find((c) => names.has(c));
    if (match) return match;
  } catch (_) {
    void _;
  }
  return ownerColumnCandidates[0];
};

const listVehiclesByOwner = async (db, ownerId, orderBy) => {
  const candidates = ownerColumnCandidates.slice();
  const preferred = await resolveOwnerColumn(db);
  candidates.sort((a, b) => (a === preferred ? -1 : b === preferred ? 1 : 0));

  let lastError = null;
  for (const col of candidates) {
    try {
      const rows = await db
        .prepare(`SELECT * FROM vehicles WHERE ${col} = ? ORDER BY ${orderBy}`)
        .all(ownerId);
      return { rows: rows || [], column: col };
    } catch (err) {
      lastError = err;
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('no such column') || msg.includes('unknown column')) {
        continue;
      }
      throw err;
    }
  }
  if (lastError) {
    throw lastError;
  }
  return { rows: [], column: preferred };
};

const getServiceHistoryInfo = async (db) => {
  const serviceHistoryTable = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='service_history'")
    .get();
  if (serviceHistoryTable) {
    const columns = await db.prepare('PRAGMA table_info(service_history)').all();
    const hasVehicleId = (columns || []).some((c) => c.name === 'vehicle_id');
    return { table: 'service_history', filterColumn: hasVehicleId ? 'vehicle_id' : 'vehicle_vin' };
  }

  const serviceRecordsTable = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='service_records'")
    .get();
  if (serviceRecordsTable) {
    return { table: 'service_records', filterColumn: 'vehicle_id' };
  }
  return null;
};

const getVehicleLicensePlate = (vehicle, licenseColumn) => {
  return (
    vehicle?.[licenseColumn] ||
    vehicle?.license_plate ||
    vehicle?.licensePlate ||
    vehicle?.registration_number ||
    null
  );
};

const parseServiceIdFromAppointment = (appointment) => {
  if (appointment && appointment.service_id) return String(appointment.service_id);
  const raw = appointment && appointment.service_ids ? String(appointment.service_ids) : '';
  if (!raw) return null;
  if (!raw.includes('[') && !raw.includes(',')) return raw.trim() || null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed[0]) return String(parsed[0]);
  } catch (_) {
    const first = raw.split(',')[0];
    const cleaned = String(first).replace(/[^a-zA-Z0-9-]/g, '');
    return cleaned || null;
  }
  return null;
};

const getAppointmentColumnConfig = async (db) => {
  try {
    const columns = await db.prepare('PRAGMA table_info(appointments)').all();
    const names = new Set((columns || []).map((column) => column.name));
    return {
      hasServiceId: names.has('service_id'),
      hasServiceIds: names.has('service_ids'),
      hasMechanicId: names.has('mechanic_id'),
      hasUserId: names.has('user_id'),
    };
  } catch (_) {
    void _;
    return { hasServiceId: false, hasServiceIds: false, hasMechanicId: false, hasUserId: true };
  }
};

exports.getUserVehicles = async (req, res) => {
  try {
    const query = req.query || {};
    const role = String(req.user?.role || '').toLowerCase();
    const isMaster = ['master', 'mechanic', 'admin'].includes(role);
    const isAdminView = isMaster && String(query.admin || '') === '1';
    const isServicedView = isMaster && String(query.serviced || '') === '1';
    const requestedUserId = typeof query.user_id === 'string' ? query.user_id.trim() : '';
    const userId = isMaster && requestedUserId ? requestedUserId : req.user?.id;

    if (!userId) {
      return res.status(400).json({ message: 'Не вказано користувача' });
    }

    const db = await getDb();
    const { makeColumn, licenseColumn, ownerColumn, hasCreatedAt } = await getVehicleColumnInfo(db);
    const appointmentColumns = await getAppointmentColumnConfig(db);
    const historyInfo = await getServiceHistoryInfo(db);

    const orderBy = hasCreatedAt ? 'created_at DESC' : 'vin ASC';

    let vehicles = [];
    if (isAdminView) {
      vehicles = await db
        .prepare(
          `SELECT v.*, u.name AS owner_name, u.email AS owner_email FROM vehicles v LEFT JOIN users u ON u.id = v.${ownerColumn} ORDER BY v.${orderBy}`
        )
        .all();
    } else if (isServicedView) {
      const table = await db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='mechanic_serviced_vehicles'"
        )
        .get();
      if (!table) {
        vehicles = [];
      } else {
        vehicles = await db
          .prepare(
            `SELECT v.*
             FROM mechanic_serviced_vehicles mv
             JOIN vehicles v ON v.id = mv.vehicle_id
             WHERE mv.mechanic_id = ?
             ORDER BY v.${orderBy}`
          )
          .all(userId);
      }
    } else {
      const resolved = await listVehiclesByOwner(db, userId, orderBy);
      vehicles = resolved.rows;
    }

    if (!vehicles || vehicles.length === 0) {
      return res.json([]);
    }

    const vehiclesWithDetails = await Promise.all(
      vehicles.map(async (vehicle) => {
        const appointments = await db
          .prepare(
            `SELECT
              id,
              scheduled_time,
              status,
              ${appointmentColumns.hasServiceId ? 'service_id' : 'NULL AS service_id'},
              ${appointmentColumns.hasServiceIds ? 'service_ids' : 'NULL AS service_ids'},
              ${appointmentColumns.hasUserId ? 'user_id' : 'NULL AS user_id'},
              ${appointmentColumns.hasMechanicId ? 'mechanic_id' : 'NULL AS mechanic_id'}
            FROM appointments
            WHERE vehicle_vin = ?
            ORDER BY scheduled_time DESC`
          )
          .all(vehicle.vin);

        const historyTarget = historyInfo?.filterColumn === 'vehicle_id' ? vehicle.id : vehicle.vin;
        const serviceHistory = historyInfo
          ? await db
              .prepare(
                `SELECT * FROM ${historyInfo.table} WHERE ${historyInfo.filterColumn} = ? ORDER BY service_date DESC`
              )
              .all(historyTarget)
          : [];

        const mainPhoto = await db
          .prepare(
            `SELECT url FROM photos WHERE object_type = 'vehicle' AND object_id = ? ORDER BY created_at DESC LIMIT 1`
          )
          .get(vehicle.id);

        return {
          ...vehicle,
          make: vehicle[makeColumn] || vehicle.make || vehicle.brand,
          brand: vehicle[makeColumn] || vehicle.brand || vehicle.make,
          licensePlate: getVehicleLicensePlate(vehicle, licenseColumn),
          appointments: appointments || [],
          service_history: serviceHistory || [],
          photo_url: mainPhoto?.url || null,
        };
      })
    );

    res.json(vehiclesWithDetails);
  } catch (err) {
    const includeDetails = String(process.env.NODE_ENV || '').toLowerCase() !== 'production';
    res
      .status(500)
      .json({ message: 'Помилка сервера', ...(includeDetails ? { details: err?.message } : {}) });
  }
};

exports.getVehicleByVin = async (req, res) => {
  try {
    const { vin } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const role = String(req.user?.role || '').toLowerCase();
    const isMaster = ['master', 'mechanic', 'admin'].includes(role);

    const db = await getDb();
    const { makeColumn, licenseColumn } = await getVehicleColumnInfo(db);
    const ownerColumn = await resolveOwnerColumn(db);
    const appointmentColumns = await getAppointmentColumnConfig(db);
    const historyInfo = await getServiceHistoryInfo(db);

    let vehicle;
    if (isMaster) {
      vehicle = await db.prepare(`SELECT * FROM vehicles WHERE vin = ?`).get(vin);
    } else {
      vehicle = await db
        .prepare(`SELECT * FROM vehicles WHERE vin = ? AND ${ownerColumn} = ?`)
        .get(vin, userId);
    }

    if (!vehicle) {
      return res.status(404).json({ message: 'Автомобіль не знайдено' });
    }

    const appointments = await db
      .prepare(
        `SELECT
          id,
          scheduled_time,
          status,
          ${appointmentColumns.hasServiceId ? 'service_id' : 'NULL AS service_id'},
          ${appointmentColumns.hasServiceIds ? 'service_ids' : 'NULL AS service_ids'},
          ${appointmentColumns.hasMechanicId ? 'mechanic_id' : 'NULL AS mechanic_id'},
          ${appointmentColumns.hasUserId ? 'user_id' : 'NULL AS user_id'}
        FROM appointments
        WHERE vehicle_vin = ?
        ORDER BY scheduled_time DESC`
      )
      .all(vin);

    const historyTarget = historyInfo?.filterColumn === 'vehicle_id' ? vehicle.id : vin;
    const serviceHistory = historyInfo
      ? await db
          .prepare(
            `SELECT * FROM ${historyInfo.table} WHERE ${historyInfo.filterColumn} = ? ORDER BY service_date DESC`
          )
          .all(historyTarget)
      : [];

    const mainPhoto = await db
      .prepare(
        `SELECT url FROM photos WHERE object_type = 'vehicle' AND object_id = ? ORDER BY created_at DESC LIMIT 1`
      )
      .get(vehicle.id);

    const appointmentsWithDetails = await Promise.all(
      (appointments || []).map(async (appointment) => {
        const serviceId = parseServiceIdFromAppointment(appointment);
        const mechanicId =
          appointment && appointment.mechanic_id ? String(appointment.mechanic_id) : null;

        const services = serviceId
          ? await db
              .prepare('SELECT id, name, description, price, duration FROM services WHERE id = ?')
              .get(serviceId)
          : null;
        const mechanics = mechanicId
          ? await db
              .prepare(
                'SELECT id, first_name, last_name, phone, email, specialization_id FROM mechanics WHERE id = ?'
              )
              .get(mechanicId)
          : null;

        return {
          ...appointment,
          services,
          mechanics,
        };
      })
    );

    res.json({
      ...vehicle,
      make: vehicle[makeColumn] || vehicle.make || vehicle.brand,
      brand: vehicle[makeColumn] || vehicle.brand || vehicle.make,
      licensePlate: getVehicleLicensePlate(vehicle, licenseColumn),
      appointments: appointmentsWithDetails || [],
      service_history: serviceHistory || [],
      photo_url: mainPhoto?.url || null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

exports.addVehicle = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const {
      vin,
      make,
      brand,
      model,
      year,
      color,
      mileage,
      license_plate,
      licensePlate,
      registration_number,
      photoUrl,
    } = req.body || {};

    const normalizedPlate = normalizeLicensePlate(
      license_plate || licensePlate || registration_number || ''
    );

    const db = await getDb();
    const { columnNames, makeColumn, licenseColumn } = await getVehicleColumnInfo(db);

    const exists = await db
      .prepare('SELECT id FROM vehicles WHERE vin = ? AND user_id = ? LIMIT 1')
      .get(vin, userId);

    if (exists) {
      return res.status(400).json({ message: 'Автомобіль з таким VIN вже існує' });
    }

    const vehicleId = crypto.randomUUID();
    const now = new Date().toISOString();

    const row = {
      id: vehicleId,
      user_id: userId,
      vin,
      [makeColumn]: make || brand || null,
      model: model || null,
      year: year != null ? Number(year) : null,
      color: color || null,
      mileage: mileage != null ? Number(mileage) : null,
      [licenseColumn]: normalizedPlate || null,
      created_at: now,
      updated_at: now,
    };

    const entries = Object.entries(row).filter(
      ([key, value]) => columnNames.has(key) && value !== undefined
    );
    const columns = entries.map(([key]) => key);
    const placeholders = entries.map(() => '?').join(', ');
    const values = entries.map(([, value]) => value);

    await db
      .prepare(`INSERT INTO vehicles (${columns.join(', ')}) VALUES (${placeholders})`)
      .run(...values);

    if (photoUrl && String(photoUrl).trim()) {
      const photoId = crypto.randomUUID();
      await db
        .prepare(
          `INSERT INTO photos (id, object_id, object_type, url, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(photoId, vehicleId, 'vehicle', String(photoUrl).trim(), now, now);
    }

    // Додаємо базовий регламент обслуговування
    try {
      const maintenanceInsert = db.prepare(`
        INSERT INTO maintenance_schedules (
          id, vehicle_vin, service_item, interval_km, interval_months, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const task of defaultMaintenanceTasks) {
        await maintenanceInsert.run(
          crypto.randomUUID(),
          vin,
          task.service_item,
          task.interval_km,
          task.interval_months,
          now,
          now
        );
      }
    } catch (maintenanceErr) {
      console.error('Помилка при створенні регламенту обслуговування:', maintenanceErr);
      // Не перериваємо створення авто, якщо не вдалося створити регламент
    }

    const created = await db
      .prepare('SELECT * FROM vehicles WHERE vin = ? AND user_id = ?')
      .get(vin, userId);

    const createdPhoto = await db
      .prepare(
        `SELECT url FROM photos WHERE object_type = 'vehicle' AND object_id = ? ORDER BY created_at DESC LIMIT 1`
      )
      .get(vehicleId);

    res.status(201).json({
      ...created,
      make: created?.[makeColumn] || created?.make || created?.brand,
      brand: created?.[makeColumn] || created?.brand || created?.make,
      licensePlate: getVehicleLicensePlate(created, licenseColumn),
      photo_url: createdPhoto?.url || null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

exports.updateVehicle = async (req, res) => {
  try {
    const { vin } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const db = await getDb();
    const { columnNames, makeColumn, licenseColumn } = await getVehicleColumnInfo(db);
    const existing = await db
      .prepare('SELECT * FROM vehicles WHERE vin = ? AND user_id = ?')
      .get(vin, userId);

    if (!existing) {
      return res.status(404).json({ message: 'Автомобіль не знайдено' });
    }

    const payload = req.body || {};
    const normalizedPlate =
      payload.license_plate !== undefined ||
      payload.licensePlate !== undefined ||
      payload.registration_number !== undefined
        ? normalizeLicensePlate(
            payload.license_plate || payload.licensePlate || payload.registration_number || ''
          )
        : undefined;

    const updateRow = {
      [makeColumn]:
        payload.make !== undefined || payload.brand !== undefined
          ? payload.make || payload.brand || null
          : undefined,
      model: payload.model !== undefined ? payload.model : undefined,
      year: payload.year !== undefined ? Number(payload.year) : undefined,
      color: payload.color !== undefined ? payload.color : undefined,
      mileage: payload.mileage !== undefined ? Number(payload.mileage) : undefined,
      [licenseColumn]: normalizedPlate !== undefined ? normalizedPlate || null : undefined,
      updated_at: new Date().toISOString(),
    };

    const fields = Object.entries(updateRow)
      .filter(([key, value]) => columnNames.has(key) && value !== undefined)
      .map(([key]) => key);

    if (fields.length > 0) {
      const setClause = fields.map((field) => `${field} = ?`).join(', ');
      const values = fields.map((field) => updateRow[field]);
      await db
        .prepare(`UPDATE vehicles SET ${setClause} WHERE vin = ? AND user_id = ?`)
        .run(...values, vin, userId);
    }

    if (payload.photoUrl && String(payload.photoUrl).trim()) {
      const existingPhoto = await db
        .prepare(
          `SELECT id FROM photos WHERE object_type = 'vehicle' AND object_id = ? ORDER BY created_at ASC LIMIT 1`
        )
        .get(existing.id);
      const now = new Date().toISOString();
      if (existingPhoto && existingPhoto.id) {
        await db
          .prepare(`UPDATE photos SET url = ?, updated_at = ? WHERE id = ?`)
          .run(String(payload.photoUrl).trim(), now, existingPhoto.id);
      } else {
        await db
          .prepare(
            `INSERT INTO photos (id, object_id, object_type, url, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(
            crypto.randomUUID(),
            existing.id,
            'vehicle',
            String(payload.photoUrl).trim(),
            now,
            now
          );
      }
    }

    const updated = await db
      .prepare('SELECT * FROM vehicles WHERE vin = ? AND user_id = ?')
      .get(vin, userId);

    const updatedPhoto = await db
      .prepare(
        `SELECT url FROM photos WHERE object_type = 'vehicle' AND object_id = ? ORDER BY created_at DESC LIMIT 1`
      )
      .get(updated.id);

    res.json({
      ...updated,
      make: updated?.[makeColumn] || updated?.make || updated?.brand,
      brand: updated?.[makeColumn] || updated?.brand || updated?.make,
      licensePlate: getVehicleLicensePlate(updated, licenseColumn),
      photo_url: updatedPhoto?.url || null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

exports.deleteVehicle = async (req, res) => {
  try {
    const { vin } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const db = await getDb();
    const vehicle = await db
      .prepare('SELECT id FROM vehicles WHERE vin = ? AND user_id = ?')
      .get(vin, userId);

    if (!vehicle) {
      return res.status(404).json({ message: 'Автомобіль не знайдено' });
    }

    const active = await db
      .prepare(
        "SELECT id FROM appointments WHERE vehicle_vin = ? AND status IN ('pending','confirmed','scheduled','in_progress') LIMIT 1"
      )
      .get(vin);

    if (active) {
      return res.status(400).json({
        message: 'Неможливо видалити автомобіль з активними записами на обслуговування',
      });
    }

    await db.prepare('DELETE FROM vehicles WHERE vin = ? AND user_id = ?').run(vin, userId);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

exports.getVehicleByLicensePlate = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }
    const plate = normalizeLicensePlate(req.params.licensePlate);
    const db = await getDb();
    const { licenseColumn } = await getVehicleColumnInfo(db);

    const vehicle = await db
      .prepare(`SELECT * FROM vehicles WHERE user_id = ? AND ${licenseColumn} = ? LIMIT 1`)
      .get(userId, plate);

    if (!vehicle) {
      return res.status(404).json({ message: 'Автомобіль не знайдено' });
    }

    res.json({
      ...vehicle,
      licensePlate: getVehicleLicensePlate(vehicle, licenseColumn),
    });
  } catch (err) {
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

exports.getVehicleByLicensePlateForBot = async (req, res) => {
  try {
    const plate = normalizeLicensePlate(req.params.licensePlate);
    const db = await getDb();
    const { licenseColumn } = await getVehicleColumnInfo(db);

    const vehicle = await db
      .prepare(`SELECT * FROM vehicles WHERE ${licenseColumn} = ? LIMIT 1`)
      .get(plate);

    if (!vehicle) {
      return res.status(404).json({ message: 'Автомобіль не знайдено' });
    }

    res.json({
      ...vehicle,
      licensePlate: getVehicleLicensePlate(vehicle, licenseColumn),
    });
  } catch (err) {
    res.status(500).json({ message: 'Помилка сервера' });
  }
};
