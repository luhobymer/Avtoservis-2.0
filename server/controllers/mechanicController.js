const crypto = require('crypto');
const { getDb, getExistingColumn } = require('../db/d1');

// Отримати всіх механіків
exports.getAllMechanics = async (req, res) => {
  try {
    const db = await getDb();
    const cityQuery = req.query?.city ? String(req.query.city).trim() : null;
    const stationColumn = await getExistingColumn('mechanics', [
      'service_station_id',
      'station_id',
    ]);

    let stationCityField = null;
    try {
      const stationColumns = await db.prepare('PRAGMA table_info(service_stations)').all();
      const stationNames = new Set((stationColumns || []).map((column) => column.name));
      if (stationNames.has('city')) {
        stationCityField = 'city';
      }
    } catch (_) {
      stationCityField = null;
    }

    const where = [];
    const params = [];
    if (cityQuery) {
      if (stationCityField) {
        where.push('lower(s.city) = lower(?)');
        params.push(cityQuery);
      } else {
        where.push('lower(s.address) LIKE lower(?)');
        params.push(`%${cityQuery}%`);
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const mechanics = (
      await db
        .prepare(
          `SELECT m.*,
          s.id AS station_id_ref,
          s.name AS station_name,
          sp.id AS specialization_id_ref,
          sp.name AS specialization_name
        FROM mechanics m
        LEFT JOIN service_stations s ON s.id = m.${stationColumn}
        LEFT JOIN specializations sp ON sp.id = m.specialization_id
        ${whereSql}`
        )
        .all(...params)
    ).map((mechanic) => {
      const { station_id_ref, station_name, specialization_id_ref, specialization_name, ...rest } =
        mechanic;
      return {
        ...rest,
        service_stations: station_id_ref ? { id: station_id_ref, name: station_name } : null,
        specializations: specialization_id_ref
          ? { id: specialization_id_ref, name: specialization_name }
          : null,
      };
    });

    res.json(mechanics);
  } catch (err) {
    console.error('Get mechanics error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Отримати механіка за ID
exports.getMechanicById = async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const stationColumn = await getExistingColumn('mechanics', [
      'service_station_id',
      'station_id',
    ]);
    const mechanic = await db
      .prepare(
        `SELECT m.*,
          s.id AS station_id_ref,
          s.name AS station_name,
          sp.id AS specialization_id_ref,
          sp.name AS specialization_name
        FROM mechanics m
        LEFT JOIN service_stations s ON s.id = m.${stationColumn}
        LEFT JOIN specializations sp ON sp.id = m.specialization_id
        WHERE m.id = ?`
      )
      .get(id);

    if (!mechanic) {
      return res.status(404).json({ message: 'Механіка не знайдено' });
    }

    const appointments = (
      await db
        .prepare(
          `SELECT a.id, a.scheduled_time, a.status,
          s.id AS service_id_ref,
          s.name AS service_name
        FROM appointments a
        LEFT JOIN services s ON s.id = a.service_id
        WHERE a.mechanic_id = ?`
        )
        .all(id)
    ).map((appointment) => ({
      id: appointment.id,
      scheduled_time: appointment.scheduled_time,
      status: appointment.status,
      services: appointment.service_id_ref
        ? { id: appointment.service_id_ref, name: appointment.service_name }
        : null,
    }));

    const { station_id_ref, station_name, specialization_id_ref, specialization_name, ...rest } =
      mechanic;

    res.json({
      ...rest,
      service_stations: station_id_ref ? { id: station_id_ref, name: station_name } : null,
      specializations: specialization_id_ref
        ? { id: specialization_id_ref, name: specialization_name }
        : null,
      appointments,
    });
  } catch (err) {
    console.error('Get mechanic error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Отримати розклад механіка
exports.getMechanicSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    const db = await getDb();
    const params = [id];
    let whereClause = 'WHERE a.mechanic_id = ?';

    if (start_date) {
      whereClause += ' AND a.scheduled_time >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND a.scheduled_time <= ?';
      params.push(end_date);
    }

    const appointments = (
      await db
        .prepare(
          `SELECT a.id, a.scheduled_time, a.status,
          s.id AS service_id_ref, s.name AS service_name, s.duration AS service_duration,
          u.id AS user_id_ref, u.email AS user_email
        FROM appointments a
        LEFT JOIN services s ON s.id = a.service_id
        LEFT JOIN users u ON u.id = a.user_id
        ${whereClause}
        ORDER BY a.scheduled_time ASC`
        )
        .all(...params)
    ).map((appointment) => ({
      id: appointment.id,
      scheduled_time: appointment.scheduled_time,
      status: appointment.status,
      services: appointment.service_id_ref
        ? {
            id: appointment.service_id_ref,
            name: appointment.service_name,
            duration: appointment.service_duration,
          }
        : null,
      users: appointment.user_id_ref
        ? { id: appointment.user_id_ref, email: appointment.user_email }
        : null,
    }));

    res.json(appointments);
  } catch (err) {
    console.error('Get mechanic schedule error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Створити нового механіка
exports.createMechanic = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      phone,
      email,
      specialization_id,
      service_station_id,
      experience_years,
    } = req.body;

    const db = await getDb();
    const stationColumn = await getExistingColumn('mechanics', [
      'service_station_id',
      'station_id',
    ]);
    const mechanicId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO mechanics
        (id, first_name, last_name, phone, email, specialization_id, ${stationColumn}, experience_years)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        mechanicId,
        first_name,
        last_name,
        phone,
        email,
        specialization_id,
        service_station_id,
        experience_years
      );

    const created = await db.prepare('SELECT * FROM mechanics WHERE id = ?').get(mechanicId);
    res.status(201).json(created);
  } catch (err) {
    console.error('Create mechanic error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Оновити інформацію про механіка
exports.updateMechanic = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      phone,
      email,
      specialization_id,
      service_station_id,
      experience_years,
    } = req.body;

    const db = await getDb();
    const stationColumn = await getExistingColumn('mechanics', [
      'service_station_id',
      'station_id',
    ]);
    const updateResult = await db
      .prepare(
        `UPDATE mechanics
         SET first_name = ?, last_name = ?, phone = ?, email = ?, specialization_id = ?,
         ${stationColumn} = ?, experience_years = ?
         WHERE id = ?`
      )
      .run(
        first_name,
        last_name,
        phone,
        email,
        specialization_id,
        service_station_id,
        experience_years,
        id
      );

    if (updateResult.changes === 0) {
      return res.status(404).json({ message: 'Механіка не знайдено' });
    }

    const updated = await db.prepare('SELECT * FROM mechanics WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('Update mechanic error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Видалити механіка
exports.deleteMechanic = async (req, res) => {
  try {
    const { id } = req.params;

    // Перевіряємо чи є активні записи
    const db = await getDb();
    const activeAppointment = await db
      .prepare(
        `SELECT id FROM appointments
         WHERE mechanic_id = ? AND status IN ('pending', 'confirmed')
         LIMIT 1`
      )
      .get(id);

    if (activeAppointment) {
      return res.status(400).json({
        message: 'Неможливо видалити механіка з активними записами',
      });
    }

    await db.prepare('DELETE FROM mechanics WHERE id = ?').run(id);

    res.status(204).send();
  } catch (err) {
    console.error('Delete mechanic error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};
