const crypto = require('crypto');
const { getDb, getExistingColumn } = require('../db/d1');

const getMechanicSpecializationConfig = async (db) => {
  const columns = await db.prepare('PRAGMA table_info(mechanics)').all();
  const columnNames = new Set(columns.map((column) => column.name));
  if (columnNames.has('specialization')) {
    return { join: '', select: 'm.specialization AS specialization' };
  }
  if (columnNames.has('specialization_id')) {
    const specializationsTable = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='specializations'")
      .get();
    if (specializationsTable) {
      return {
        join: 'LEFT JOIN specializations sp ON sp.id = m.specialization_id',
        select: 'sp.name AS specialization',
      };
    }
    return { join: '', select: 'm.specialization_id AS specialization' };
  }
  return { join: '', select: 'NULL AS specialization' };
};

// Отримати всі СТО
exports.getAllStations = async (req, res) => {
  try {
    const db = await getDb();
    const serviceStationColumn = await getExistingColumn('services', [
      'service_station_id',
      'station_id',
    ]);
    const mechanicStationColumn = await getExistingColumn('mechanics', [
      'service_station_id',
      'station_id',
    ]);
    const serviceColumns = await db.prepare('PRAGMA table_info(services)').all();
    const serviceColumnNames = new Set((serviceColumns || []).map((column) => column.name));
    const mechanicColumns = await db.prepare('PRAGMA table_info(mechanics)').all();
    const mechanicColumnNames = new Set((mechanicColumns || []).map((column) => column.name));
    const serviceStationKey = serviceColumnNames.has(serviceStationColumn)
      ? serviceStationColumn
      : null;
    const mechanicStationKey = mechanicColumnNames.has(mechanicStationColumn)
      ? mechanicStationColumn
      : null;
    const servicePriceColumn = serviceColumnNames.has('base_price') ? 'base_price' : 'price';
    const serviceDurationColumn = serviceColumnNames.has('duration_minutes')
      ? 'duration_minutes'
      : 'duration';
    const mechanicSpec = await getMechanicSpecializationConfig(db);
    const stations = await db.prepare('SELECT * FROM service_stations').all();
    const result = await Promise.all(
      stations.map(async (station) => {
        const services = serviceStationKey
          ? await db
              .prepare(
                `SELECT id, name, ${servicePriceColumn} AS price, ${serviceDurationColumn} AS duration
                 FROM services WHERE ${serviceStationKey} = ?`
              )
              .all(station.id)
          : [];
        const mechanics = mechanicStationKey
          ? await db
              .prepare(
                `SELECT m.id, m.first_name, m.last_name, ${mechanicSpec.select}
                 FROM mechanics m
                 ${mechanicSpec.join}
                 WHERE m.${mechanicStationKey} = ?`
              )
              .all(station.id)
          : [];
        return { ...station, services, mechanics };
      })
    );

    res.json(result);
  } catch (err) {
    console.error('Get stations error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Отримати СТО за ID
exports.getStationById = async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const serviceStationColumn = await getExistingColumn('services', [
      'service_station_id',
      'station_id',
    ]);
    const mechanicStationColumn = await getExistingColumn('mechanics', [
      'service_station_id',
      'station_id',
    ]);
    const serviceColumns = await db.prepare('PRAGMA table_info(services)').all();
    const serviceColumnNames = new Set((serviceColumns || []).map((column) => column.name));
    const mechanicColumns = await db.prepare('PRAGMA table_info(mechanics)').all();
    const mechanicColumnNames = new Set((mechanicColumns || []).map((column) => column.name));
    const serviceStationKey = serviceColumnNames.has(serviceStationColumn)
      ? serviceStationColumn
      : null;
    const mechanicStationKey = mechanicColumnNames.has(mechanicStationColumn)
      ? mechanicStationColumn
      : null;
    const servicePriceColumn = serviceColumnNames.has('base_price') ? 'base_price' : 'price';
    const serviceDurationColumn = serviceColumnNames.has('duration_minutes')
      ? 'duration_minutes'
      : 'duration';
    const mechanicSpec = await getMechanicSpecializationConfig(db);
    const reviewStationColumn = await getExistingColumn('reviews', [
      'service_station_id',
      'station_id',
    ]);
    const station = await db.prepare('SELECT * FROM service_stations WHERE id = ?').get(id);

    if (!station) {
      return res.status(404).json({ message: 'СТО не знайдено' });
    }

    const services = serviceStationKey
      ? await db
          .prepare(
            `SELECT id, name, ${servicePriceColumn} AS price, ${serviceDurationColumn} AS duration
             FROM services WHERE ${serviceStationKey} = ?`
          )
          .all(id)
      : [];
    const mechanics = mechanicStationKey
      ? await db
          .prepare(
            `SELECT m.id, m.first_name, m.last_name, ${mechanicSpec.select}
             FROM mechanics m
             ${mechanicSpec.join}
             WHERE m.${mechanicStationKey} = ?`
          )
          .all(id)
      : [];
    const reviews = (
      await db
        .prepare(
          `SELECT r.id, r.rating, r.comment, r.created_at,
          u.id AS user_id_ref, u.email AS user_email
        FROM reviews r
        LEFT JOIN users u ON u.id = r.user_id
        WHERE r.${reviewStationColumn} = ?`
        )
        .all(id)
    ).map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at,
      users: review.user_id_ref ? { id: review.user_id_ref, email: review.user_email } : null,
    }));

    res.json({ ...station, services, mechanics, reviews });
  } catch (err) {
    console.error('Get station error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Створити нову СТО
exports.createStation = async (req, res) => {
  try {
    const { name, address, phone, working_hours, description } = req.body;

    const db = await getDb();
    const stationId = crypto.randomUUID();
    const workingHoursValue =
      typeof working_hours === 'string' ? working_hours : JSON.stringify(working_hours ?? null);
    await db
      .prepare(
        `INSERT INTO service_stations (id, name, address, phone, working_hours, description)
       VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(stationId, name, address, phone, workingHoursValue, description);

    const created = await db.prepare('SELECT * FROM service_stations WHERE id = ?').get(stationId);
    res.status(201).json(created);
  } catch (err) {
    console.error('Create station error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Оновити СТО
exports.updateStation = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, phone, working_hours, description } = req.body;

    const db = await getDb();
    const workingHoursValue =
      typeof working_hours === 'string' ? working_hours : JSON.stringify(working_hours ?? null);
    const updateResult = await db
      .prepare(
        `UPDATE service_stations
         SET name = ?, address = ?, phone = ?, working_hours = ?, description = ?
         WHERE id = ?`
      )
      .run(name, address, phone, workingHoursValue, description, id);

    if (updateResult.changes === 0) {
      return res.status(404).json({ message: 'СТО не знайдено' });
    }

    const updated = await db.prepare('SELECT * FROM service_stations WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('Update station error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Видалити СТО
exports.deleteStation = async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    await db.prepare('DELETE FROM service_stations WHERE id = ?').run(id);

    res.status(204).send();
  } catch (err) {
    console.error('Delete station error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};
