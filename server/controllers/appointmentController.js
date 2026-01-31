const crypto = require('crypto');
const { getDb } = require('../db/d1');

const getMechanicSpecializationConfig = async (db) => {
  const columns = await db.prepare('PRAGMA table_info(mechanics)').all();
  const columnNames = new Set(columns.map((column) => column.name));
  if (columnNames.has('specialization')) {
    return {
      join: '',
      select: 'm.specialization AS mechanic_specialization',
    };
  }
  if (columnNames.has('specialization_id')) {
    const specializationsTable = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='specializations'")
      .get();
    if (specializationsTable) {
      return {
        join: 'LEFT JOIN specializations sp ON sp.id = m.specialization_id',
        select: 'sp.name AS mechanic_specialization',
      };
    }
    return {
      join: '',
      select: 'm.specialization_id AS mechanic_specialization',
    };
  }
  return {
    join: '',
    select: 'NULL AS mechanic_specialization',
  };
};

const safeParseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

const normalizeServiceIds = (value) => {
  const raw = Array.isArray(value) ? value : safeParseJsonArray(value);
  const ids = raw.map((id) => (id == null ? '' : String(id).trim())).filter(Boolean);
  return Array.from(new Set(ids));
};

const collectServiceIdsFromRow = (row) => {
  const ids = normalizeServiceIds(row.service_ids);
  if (row.service_id) ids.push(String(row.service_id));
  if (row.service_id_ref) ids.push(String(row.service_id_ref));
  return Array.from(new Set(ids.filter(Boolean)));
};

const buildServiceMap = async (db, serviceIds) => {
  const ids = Array.from(new Set((serviceIds || []).filter(Boolean)));
  if (ids.length === 0) return new Map();
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await db
    .prepare(
      `SELECT id, name, price, duration, description FROM services WHERE id IN (${placeholders})`
    )
    .all(...ids);
  const map = new Map();
  for (const row of rows || []) {
    map.set(String(row.id), {
      id: row.id,
      name: row.name,
      price: row.price,
      duration: row.duration,
      description: row.description,
    });
  }
  return map;
};

const mapAppointmentRow = (row, serviceMap) => {
  const {
    user_id_ref,
    user_email,
    service_id_ref,
    service_name,
    service_price,
    service_duration,
    mechanic_id_ref,
    mechanic_first_name,
    mechanic_last_name,
    mechanic_specialization,
    ...appointment
  } = row;

  const serviceIds = collectServiceIdsFromRow(row);
  const servicesList = serviceIds
    .map((id) => (serviceMap && serviceMap.get(id) ? serviceMap.get(id) : null))
    .filter(Boolean);

  return {
    ...appointment,
    users: user_id_ref ? { id: user_id_ref, email: user_email } : null,
    services: service_id_ref
      ? {
          id: service_id_ref,
          name: service_name,
          price: service_price,
          duration: service_duration,
        }
      : null,
    service_ids: serviceIds,
    services_list: servicesList,
    mechanics: mechanic_id_ref
      ? {
          id: mechanic_id_ref,
          first_name: mechanic_first_name,
          last_name: mechanic_last_name,
          specialization: mechanic_specialization,
        }
      : null,
  };
};

// Отримати всі записи
exports.getAllAppointments = async (req, res) => {
  try {
    const db = await getDb();
    const mechanicSpec = await getMechanicSpecializationConfig(db);
    const rows = await db
      .prepare(
        `SELECT a.*,
          u.id AS user_id_ref,
          u.email AS user_email,
          s.id AS service_id_ref,
          s.name AS service_name,
          s.price AS service_price,
          s.duration AS service_duration,
          m.id AS mechanic_id_ref,
          m.first_name AS mechanic_first_name,
          m.last_name AS mechanic_last_name,
          ${mechanicSpec.select}
        FROM appointments a
        LEFT JOIN users u ON u.id = a.user_id
        LEFT JOIN services s ON s.id = a.service_id
        LEFT JOIN mechanics m ON m.id = a.mechanic_id
        ${mechanicSpec.join}`
      )
      .all();

    const allServiceIds = [];
    for (const row of rows || []) {
      allServiceIds.push(...collectServiceIdsFromRow(row));
    }
    const serviceMap = await buildServiceMap(db, allServiceIds);

    res.json((rows || []).map((row) => mapAppointmentRow(row, serviceMap)));
  } catch (err) {
    console.error('Get appointments error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Отримати запис за ID
exports.getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    const mechanicSpec = await getMechanicSpecializationConfig(db);
    const row = await db
      .prepare(
        `SELECT a.*,
          u.id AS user_id_ref,
          u.email AS user_email,
          s.id AS service_id_ref,
          s.name AS service_name,
          s.price AS service_price,
          s.duration AS service_duration,
          m.id AS mechanic_id_ref,
          m.first_name AS mechanic_first_name,
          m.last_name AS mechanic_last_name,
          ${mechanicSpec.select}
        FROM appointments a
        LEFT JOIN users u ON u.id = a.user_id
        LEFT JOIN services s ON s.id = a.service_id
        LEFT JOIN mechanics m ON m.id = a.mechanic_id
        ${mechanicSpec.join}
        WHERE a.id = ?`
      )
      .get(id);

    if (!row) {
      return res.status(404).json({ message: 'Запис не знайдено' });
    }

    const serviceMap = await buildServiceMap(db, collectServiceIdsFromRow(row));
    res.json(mapAppointmentRow(row, serviceMap));
  } catch (err) {
    console.error('Get appointment error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Отримати записи користувача
exports.getUserAppointments = async (req, res) => {
  try {
    const userId = req.user.id;
    const db = await getDb();
    const mechanicSpec = await getMechanicSpecializationConfig(db);
    const rows = await db
      .prepare(
        `SELECT a.*,
          u.id AS user_id_ref,
          u.email AS user_email,
          s.id AS service_id_ref,
          s.name AS service_name,
          s.price AS service_price,
          s.duration AS service_duration,
          m.id AS mechanic_id_ref,
          m.first_name AS mechanic_first_name,
          m.last_name AS mechanic_last_name,
          ${mechanicSpec.select}
        FROM appointments a
        LEFT JOIN users u ON u.id = a.user_id
        LEFT JOIN services s ON s.id = a.service_id
        LEFT JOIN mechanics m ON m.id = a.mechanic_id
        ${mechanicSpec.join}
        WHERE a.user_id = ?
        ORDER BY a.scheduled_time ASC`
      )
      .all(userId);

    const allServiceIds = [];
    for (const row of rows || []) {
      allServiceIds.push(...collectServiceIdsFromRow(row));
    }
    const serviceMap = await buildServiceMap(db, allServiceIds);
    res.json((rows || []).map((row) => mapAppointmentRow(row, serviceMap)));
  } catch (err) {
    console.error('Get user appointments error:', err);
    res.status(500).json({
      message: 'Помилка сервера',
      ...(process.env.NODE_ENV === 'test' ? { details: err?.message } : {}),
    });
  }
};

// Створити новий запис
exports.createAppointment = async (req, res) => {
  try {
    const {
      user_id,
      service_id,
      service_ids,
      serviceIds,
      mechanic_id,
      scheduled_time,
      notes,
      car_info,
      vehicle_id,
      vehicle_vin,
      service_type,
      appointment_date,
    } = req.body;

    const effectiveUserId =
      req.user && req.user.role === 'master' && user_id ? String(user_id) : req.user.id;

    const normalizedServiceIds = normalizeServiceIds(service_ids || serviceIds);
    const hasServiceIds = normalizedServiceIds.length > 0;
    const effectiveServiceId = hasServiceIds ? normalizedServiceIds[0] : service_id;
    const serviceIdsJson = hasServiceIds
      ? JSON.stringify(normalizedServiceIds)
      : effectiveServiceId
        ? JSON.stringify([String(effectiveServiceId)])
        : null;

    // Перевірка доступності часу
    const db = await getDb();
    const existingAppointment = await db
      .prepare('SELECT id FROM appointments WHERE mechanic_id = ? AND scheduled_time = ? LIMIT 1')
      .get(mechanic_id, scheduled_time);

    if (existingAppointment) {
      return res.status(400).json({ message: 'Цей час вже зайнято' });
    }

    // Створення запису
    const appointmentId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO appointments
        (id, user_id, vehicle_id, vehicle_vin, service_type, service_id, service_ids, mechanic_id, scheduled_time, appointment_date, notes, car_info, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        appointmentId,
        effectiveUserId,
        vehicle_id ?? null,
        vehicle_vin ?? null,
        service_type ?? null,
        effectiveServiceId ?? null,
        serviceIdsJson,
        mechanic_id,
        scheduled_time,
        appointment_date ?? null,
        notes ?? null,
        car_info ?? null,
        'pending'
      );

    const created = await db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId);
    res.status(201).json(created);
  } catch (err) {
    console.error('Create appointment error:', err);
    res.status(500).json({
      message: 'Помилка сервера',
      ...(process.env.NODE_ENV === 'test' ? { details: err?.message } : {}),
    });
  }
};

// Оновити статус запису
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, completion_notes } = req.body;

    const db = await getDb();

    const before = await db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
    if (!before) {
      return res.status(404).json({ message: 'Запис не знайдено' });
    }

    const updateResult = await db
      .prepare('UPDATE appointments SET status = ?, completion_notes = ? WHERE id = ?')
      .run(status, completion_notes, id);

    if (updateResult.changes === 0) {
      return res.status(404).json({ message: 'Запис не знайдено' });
    }

    const updated = await db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);

    const nextStatus = status != null ? String(status) : String(updated?.status || '');
    const prevStatus = String(before?.status || '');

    if (prevStatus !== 'completed' && nextStatus === 'completed') {
      const existingServiceRecord = await db
        .prepare('SELECT id FROM service_records WHERE appointment_id = ? LIMIT 1')
        .get(id);

      if (!existingServiceRecord) {
        let vehicleId = updated.vehicle_id || null;
        if (!vehicleId && updated.vehicle_vin) {
          const v = await db
            .prepare('SELECT id FROM vehicles WHERE vin = ? LIMIT 1')
            .get(updated.vehicle_vin);
          vehicleId = v ? v.id : null;
        }

        if (vehicleId) {
          const serviceIds = normalizeServiceIds(updated.service_ids);
          const serviceMap = await buildServiceMap(db, serviceIds);
          const serviceNames = serviceIds.map((sid) => serviceMap.get(sid)?.name).filter(Boolean);

          const mechanic = updated.mechanic_id
            ? await db
                .prepare('SELECT first_name, last_name FROM mechanics WHERE id = ?')
                .get(updated.mechanic_id)
            : null;

          const performedBy = mechanic
            ? [mechanic.first_name, mechanic.last_name].filter(Boolean).join(' ').trim()
            : null;

          const cost = serviceIds
            .map((sid) => Number(serviceMap.get(sid)?.price || 0))
            .reduce((a, b) => a + b, 0);

          const description =
            (completion_notes && String(completion_notes).trim()) ||
            (updated.completion_notes && String(updated.completion_notes).trim()) ||
            (serviceNames.length > 0 ? serviceNames.join(', ') : '') ||
            updated.notes ||
            '' ||
            '';

          const recordId = crypto.randomUUID();
          const now = new Date().toISOString();
          await db
            .prepare(
              `INSERT INTO service_records
               (id, vehicle_id, user_id, appointment_id, service_type, service_date, mileage, description, performed_by, cost, parts, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              recordId,
              vehicleId,
              updated.user_id || null,
              id,
              updated.service_type || (serviceNames.length > 0 ? serviceNames.join(', ') : null),
              now,
              null,
              description,
              performedBy,
              cost || 0,
              null,
              now,
              now
            );
        }
      }
    }

    res.json(updated);
  } catch (err) {
    console.error('Update appointment status error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Скасувати запис
exports.cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Перевіряємо чи запис належить користувачу
    const db = await getDb();
    const appointment = await db
      .prepare('SELECT * FROM appointments WHERE id = ? AND user_id = ?')
      .get(id, userId);

    if (!appointment) {
      return res.status(404).json({ message: 'Запис не знайдено' });
    }

    // Перевіряємо чи можна скасувати (наприклад, не менше ніж за 24 години)
    const appointmentDate = new Date(appointment.scheduled_time);
    const now = new Date();
    const hoursUntilAppointment = (appointmentDate - now) / (1000 * 60 * 60);

    if (hoursUntilAppointment < 24) {
      return res.status(400).json({
        message: 'Скасування можливе не менше ніж за 24 години до запису',
      });
    }

    await db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run('cancelled', id);

    res.status(200).json({ message: 'Запис скасовано' });
  } catch (err) {
    console.error('Cancel appointment error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};
