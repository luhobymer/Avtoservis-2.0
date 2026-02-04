const crypto = require('crypto');
const { getDb } = require('../db/d1');
const { resolveCurrentMechanic } = require('../utils/resolveCurrentMechanic');

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

const getServiceColumnConfig = async (db) => {
  const columns = await db.prepare('PRAGMA table_info(services)').all();
  const columnNames = new Set((columns || []).map((column) => column.name));
  return {
    price: columnNames.has('base_price') ? 'base_price' : 'price',
    duration: columnNames.has('duration_minutes') ? 'duration_minutes' : 'duration',
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

const hasMechanicServicesTable = async (db) => {
  const row = await db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='mechanic_services'")
    .get();
  return Boolean(row && row.name);
};

const assertServicesEnabledForMechanic = async (db, mechanicId, serviceIds) => {
  if (!mechanicId) return;
  const ids = Array.isArray(serviceIds)
    ? serviceIds.map((id) => (id == null ? '' : String(id).trim())).filter(Boolean)
    : [];
  if (ids.length === 0) return;

  const enabled = await hasMechanicServicesTable(db);
  if (!enabled) return;

  for (const sid of ids) {
    const row = await db
      .prepare(
        'SELECT ms.is_enabled, s.is_active FROM mechanic_services ms LEFT JOIN services s ON s.id = ms.service_id WHERE ms.mechanic_id = ? AND ms.service_id = ?'
      )
      .get(mechanicId, sid);
    const isEnabled = row && Number(row.is_enabled || 0) === 1;
    const isActive = row ? Number(row.is_active ?? 1) === 1 : false;
    if (!isEnabled || !isActive) {
      const error = new Error('Послуга недоступна для вибраного механіка');
      error.code = 'SERVICE_NOT_ENABLED';
      throw error;
    }
  }
};

const buildServiceMap = async (db, serviceIds) => {
  const ids = Array.from(new Set((serviceIds || []).filter(Boolean)));
  if (ids.length === 0) return new Map();
  const serviceColumns = await getServiceColumnConfig(db);
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await db
    .prepare(
      `SELECT id, name, ${serviceColumns.price} AS price, ${serviceColumns.duration} AS duration, description FROM services WHERE id IN (${placeholders})`
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

const getAppointmentColumnInfo = async (db) => {
  const columns = await db.prepare('PRAGMA table_info(appointments)').all();
  const columnNames = new Set(columns.map((column) => column.name));
  return {
    hasServiceId: columnNames.has('service_id'),
    hasMechanicId: columnNames.has('mechanic_id'),
    hasVehicleId: columnNames.has('vehicle_id'),
    hasNotes: columnNames.has('notes'),
    hasCarInfo: columnNames.has('car_info'),
    hasServiceIds: columnNames.has('service_ids'),
    hasAppointmentPrice: columnNames.has('appointment_price'),
    hasAppointmentDuration: columnNames.has('appointment_duration'),
  };
};

// Отримати всі записи
exports.getAllAppointments = async (req, res) => {
  try {
    const db = await getDb();
    const { hasServiceId, hasMechanicId } = await getAppointmentColumnInfo(db);
    const mechanicSpec = await getMechanicSpecializationConfig(db);
    const serviceColumns = await getServiceColumnConfig(db);

    let selectClause = 'a.*, u.id AS user_id_ref, u.email AS user_email';
    let joinClause = 'LEFT JOIN users u ON u.id = a.user_id';
    
    // Якщо користувач - майстер або адмін, він має бачити і свої записи, 
    // і записи, де він виступає як механік (якщо він механік).
    // Але цей метод getUserAppointments призначений саме для "Моїх записів" як КЛІЄНТА (власника авто).
    // Тому ми фільтруємо по user_id = userId.
    // Якщо майстер хоче бачити записи КЛІЄНТІВ, він використовує getAllAppointments (з admin=1).
    // Тобто логіка тут правильна: показуємо ті записи, де поточний юзер є ЗАМОВНИКОМ.

    if (hasServiceId) {
        selectClause += `, s.id AS service_id_ref, s.name AS service_name, s.${serviceColumns.price} AS service_price, s.${serviceColumns.duration} AS service_duration`;
        joinClause += ' LEFT JOIN services s ON s.id = a.service_id';
    } else {
        selectClause += ', NULL AS service_id_ref, NULL AS service_name, NULL AS service_price, NULL AS service_duration';
    }

    if (hasMechanicId) {
        selectClause += `, m.id AS mechanic_id_ref, m.first_name AS mechanic_first_name, m.last_name AS mechanic_last_name, ${mechanicSpec.select}`;
        joinClause += ` LEFT JOIN mechanics m ON m.id = a.mechanic_id ${mechanicSpec.join}`;
    } else {
        selectClause += ', NULL AS mechanic_id_ref, NULL AS mechanic_first_name, NULL AS mechanic_last_name, NULL AS mechanic_specialization';
    }

    const rows = await db
      .prepare(
        `SELECT ${selectClause}
        FROM appointments a
        ${joinClause}`
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
    const { hasServiceId, hasMechanicId } = await getAppointmentColumnInfo(db);
    const mechanicSpec = await getMechanicSpecializationConfig(db);
    const serviceColumns = await getServiceColumnConfig(db);

    let selectClause = 'a.*, u.id AS user_id_ref, u.email AS user_email';
    let joinClause = 'LEFT JOIN users u ON u.id = a.user_id';
    
    if (hasServiceId) {
        selectClause += `, s.id AS service_id_ref, s.name AS service_name, s.${serviceColumns.price} AS service_price, s.${serviceColumns.duration} AS service_duration`;
        joinClause += ' LEFT JOIN services s ON s.id = a.service_id';
    } else {
        selectClause += ', NULL AS service_id_ref, NULL AS service_name, NULL AS service_price, NULL AS service_duration';
    }

    if (hasMechanicId) {
        selectClause += `, m.id AS mechanic_id_ref, m.first_name AS mechanic_first_name, m.last_name AS mechanic_last_name, ${mechanicSpec.select}`;
        joinClause += ` LEFT JOIN mechanics m ON m.id = a.mechanic_id ${mechanicSpec.join}`;
    } else {
        selectClause += ', NULL AS mechanic_id_ref, NULL AS mechanic_first_name, NULL AS mechanic_last_name, NULL AS mechanic_specialization';
    }

    const row = await db
      .prepare(
        `SELECT ${selectClause}
        FROM appointments a
        ${joinClause}
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
    const { hasServiceId, hasMechanicId } = await getAppointmentColumnInfo(db);
    const mechanicSpec = await getMechanicSpecializationConfig(db);
    const serviceColumns = await getServiceColumnConfig(db);

    let selectClause = 'a.*, u.id AS user_id_ref, u.email AS user_email';
    let joinClause = 'LEFT JOIN users u ON u.id = a.user_id';
    
    if (hasServiceId) {
        selectClause += `, s.id AS service_id_ref, s.name AS service_name, s.${serviceColumns.price} AS service_price, s.${serviceColumns.duration} AS service_duration`;
        joinClause += ' LEFT JOIN services s ON s.id = a.service_id';
    } else {
        selectClause += ', NULL AS service_id_ref, NULL AS service_name, NULL AS service_price, NULL AS service_duration';
    }

    if (hasMechanicId) {
        selectClause += `, m.id AS mechanic_id_ref, m.first_name AS mechanic_first_name, m.last_name AS mechanic_last_name, ${mechanicSpec.select}`;
        joinClause += ` LEFT JOIN mechanics m ON m.id = a.mechanic_id ${mechanicSpec.join}`;
    } else {
        selectClause += ', NULL AS mechanic_id_ref, NULL AS mechanic_first_name, NULL AS mechanic_last_name, NULL AS mechanic_specialization';
    }

    const rows = await db
      .prepare(
        `SELECT ${selectClause}
        FROM appointments a
        ${joinClause}
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
      appointment_price,
      appointment_duration,
    } = req.body;

    let effectiveUserId = req.user.id;
    if (req.user && ['master', 'admin', 'mechanic'].includes(req.user.role || '')) {
      effectiveUserId = user_id ? String(user_id) : null;
    }

    const normalizedServiceIds = normalizeServiceIds(service_ids || serviceIds);
    const hasServiceIds = normalizedServiceIds.length > 0;
    const effectiveServiceId = hasServiceIds ? normalizedServiceIds[0] : service_id;
    const serviceIdsJson = hasServiceIds
      ? JSON.stringify(normalizedServiceIds)
      : effectiveServiceId
        ? JSON.stringify([String(effectiveServiceId)])
        : null;

    let effectiveMechanicId = mechanic_id;
    const role = String(req.user?.role || '').toLowerCase();
    if (['mechanic', 'master', 'admin'].includes(role)) {
      const currentMechanic = await resolveCurrentMechanic(req.user, {
        createIfMissing: true,
        enableAllServices: true,
      });
      if (!currentMechanic?.id) {
        return res.status(404).json({ message: 'Профіль механіка не знайдено' });
      }
      effectiveMechanicId = String(currentMechanic.id);
    }

    // Перевірка доступності часу
    const db = await getDb();
    
    const {
      hasServiceId,
      hasMechanicId,
      hasVehicleId,
      hasNotes,
      hasCarInfo,
      hasAppointmentPrice,
      hasAppointmentDuration,
    } = await getAppointmentColumnInfo(db);

    if (hasMechanicId) {
        const idsToCheck = normalizeServiceIds(serviceIdsJson);
        if (idsToCheck.length > 0) {
          await assertServicesEnabledForMechanic(db, effectiveMechanicId, idsToCheck);
        }
        const existingAppointment = await db
          .prepare('SELECT id FROM appointments WHERE mechanic_id = ? AND scheduled_time = ? LIMIT 1')
          .get(effectiveMechanicId, scheduled_time);

        if (existingAppointment) {
          return res.status(400).json({ message: 'Цей час вже зайнято' });
        }
    }

    // Створення запису
    const appointmentId = crypto.randomUUID();

    let effectiveServiceType = service_type ?? null;
    if (!effectiveServiceType && effectiveServiceId) {
      try {
        const svc = await db
          .prepare('SELECT name FROM services WHERE id = ? LIMIT 1')
          .get(String(effectiveServiceId));
        effectiveServiceType = svc?.name ? String(svc.name) : null;
      } catch (_) {
        effectiveServiceType = null;
      }
    }
    if (effectiveServiceType == null) {
      effectiveServiceType = '';
    }

    const effectiveAppointmentDate = appointment_date ?? scheduled_time;
    
    const insertColumns = ['id', 'user_id', 'vehicle_vin', 'service_type', 'service_ids', 'scheduled_time', 'appointment_date', 'status'];
    const insertValues = [
        appointmentId,
        effectiveUserId,
        vehicle_vin ?? null,
        effectiveServiceType,
        serviceIdsJson,
        scheduled_time,
        effectiveAppointmentDate,
        'pending'
    ];

    if (hasVehicleId) {
        insertColumns.push('vehicle_id');
        insertValues.push(vehicle_id ?? null);
    }
    if (hasServiceId) {
        insertColumns.push('service_id');
        insertValues.push(effectiveServiceId ?? null);
    }
    if (hasMechanicId) {
        insertColumns.push('mechanic_id');
        insertValues.push(effectiveMechanicId);
    }
    if (hasNotes) {
        insertColumns.push('notes');
        insertValues.push(notes ?? null);
    }
    if (hasCarInfo) {
        insertColumns.push('car_info');
        insertValues.push(car_info ?? null);
    }

    if (hasAppointmentPrice) {
        insertColumns.push('appointment_price');
        const raw =
          appointment_price === undefined || appointment_price === null ? '' : String(appointment_price);
        const n = raw.trim() === '' ? null : Number(raw.replace(',', '.'));
        insertValues.push(Number.isFinite(n) ? n : null);
    }
    if (hasAppointmentDuration) {
        insertColumns.push('appointment_duration');
        const raw =
          appointment_duration === undefined || appointment_duration === null
            ? ''
            : String(appointment_duration);
        const n = raw.trim() === '' ? null : Number(raw.replace(',', '.'));
        insertValues.push(Number.isFinite(n) ? n : null);
    }

    const placeholders = insertColumns.map(() => '?').join(', ');
    
    await db
      .prepare(
        `INSERT INTO appointments
        (${insertColumns.join(', ')})
       VALUES (${placeholders})`
      )
      .run(...insertValues);

    const created = await db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId);
    res.status(201).json(created);
  } catch (err) {
    console.error('Create appointment error:', err);
    if (err && err.code === 'SERVICE_NOT_ENABLED') {
      return res.status(400).json({ message: err.message });
    }
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
    const { status, completion_notes, completion_mileage, parts } = req.body;

    const db = await getDb();

    const before = await db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
    if (!before) {
      return res.status(404).json({ message: 'Запис не знайдено' });
    }

    // Check for completion_mileage column
    const { hasCompletionMileage } = await (async () => {
      const columns = await db.prepare('PRAGMA table_info(appointments)').all();
      const names = new Set(columns.map(c => c.name));
      return { hasCompletionMileage: names.has('completion_mileage') };
    })();

    let updateQuery = 'UPDATE appointments SET status = ?, completion_notes = ?';
    let updateParams = [status, completion_notes];
    
    if (hasCompletionMileage && completion_mileage !== undefined) {
      updateQuery += ', completion_mileage = ?';
      updateParams.push(completion_mileage);
    }
    
    updateQuery += ' WHERE id = ?';
    updateParams.push(id);

    const updateResult = await db
      .prepare(updateQuery)
      .run(...updateParams);

    if (updateResult.changes === 0) {
      return res.status(404).json({ message: 'Запис не знайдено' });
    }

    const updated = await db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);

    const nextStatus = status != null ? String(status) : String(updated?.status || '');
    const prevStatus = String(before?.status || '');

    if (prevStatus !== 'completed' && nextStatus === 'completed') {
      
      // 1. Handle Parts
      if (Array.isArray(parts) && parts.length > 0) {
        const partsStmt = db.prepare(`
          INSERT INTO vehicle_parts (
            id, vehicle_vin, appointment_id, name, part_number, price, quantity, purchased_by, installed_at_mileage, installed_date, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const part of parts) {
          const partId = crypto.randomUUID();
          await partsStmt.run(
            partId,
            updated.vehicle_vin,
            id,
            part.name,
            part.part_number || null,
            part.price || 0,
            part.quantity || 1,
            part.purchased_by || 'owner',
            completion_mileage || null,
            new Date().toISOString(),
            part.notes || null
          );
        }
      }

      // 2. Update Vehicle Mileage
      if (completion_mileage && updated.vehicle_vin) {
         // Only update if new mileage is greater than current
         const vehicle = await db.prepare('SELECT mileage FROM vehicles WHERE vin = ?').get(updated.vehicle_vin);
         if (vehicle && (vehicle.mileage || 0) < completion_mileage) {
            await db.prepare('UPDATE vehicles SET mileage = ?, updated_at = ? WHERE vin = ?')
              .run(completion_mileage, new Date().toISOString(), updated.vehicle_vin);
         }
      }

      // 3. Create Service Record
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

          let cost = serviceIds
            .map((sid) => Number(serviceMap.get(sid)?.price || 0))
            .reduce((a, b) => a + b, 0);
          
          // Add parts cost if purchased by owner? Or mechanic? 
          // Usually service record cost includes parts if mechanic bought them.
          // Let's assume cost is labor + parts sold by mechanic.
          if (Array.isArray(parts)) {
             const partsCost = parts
                .filter(p => p.purchased_by !== 'owner') // Only include if shop provided it
                .reduce((sum, p) => sum + (Number(p.price || 0) * Number(p.quantity || 1)), 0);
             cost += partsCost;
          }

          const description =
            (completion_notes && String(completion_notes).trim()) ||
            (updated.completion_notes && String(updated.completion_notes).trim()) ||
            (serviceNames.length > 0 ? serviceNames.join(', ') : '') ||
            updated.notes ||
            '' ||
            '';

          const recordId = crypto.randomUUID();
          const now = new Date().toISOString();
          
          // Serialize parts for legacy support in service_records table if needed
          const partsJson = Array.isArray(parts) ? JSON.stringify(parts) : null;

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
              completion_mileage || null,
              description,
              performedBy,
              cost || 0,
              partsJson,
              now,
              now
            );
        }
      }
    }

    res.json(updated);
  } catch (err) {
    console.error('Update appointment status error:', err);
    res.status(500).json({ message: 'Помилка сервера', error: err.message });
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
