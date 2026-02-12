const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const { getDb } = require('../db/d1');
const logger = require('../middleware/logger.js');

const normalizeParts = (parts) => {
  if (parts === undefined) return undefined;
  if (parts === null) return null;
  return typeof parts === 'string' ? parts : JSON.stringify(parts);
};

const getVehicleColumnMap = async (db) => {
  const columns = await db.prepare('PRAGMA table_info(vehicles)').all();
  const names = new Set(columns.map((column) => column.name));
  return {
    vinColumn: names.has('vin') ? 'vin' : null,
    brandColumn: names.has('brand') ? 'brand' : names.has('make') ? 'make' : null,
    makeColumn: names.has('make') ? 'make' : names.has('brand') ? 'brand' : null,
    modelColumn: names.has('model') ? 'model' : null,
    yearColumn: names.has('year') ? 'year' : null,
    licenseColumn: names.has('license_plate')
      ? 'license_plate'
      : names.has('licensePlate')
        ? 'licensePlate'
        : null,
  };
};

const getVehicleSelectParts = (columns) => {
  const vinSelect = columns.vinColumn ? `v.${columns.vinColumn}` : 'NULL';
  const brandSelect = columns.brandColumn ? `v.${columns.brandColumn}` : 'NULL';
  const makeSelect = columns.makeColumn ? `v.${columns.makeColumn}` : 'NULL';
  const modelSelect = columns.modelColumn ? `v.${columns.modelColumn}` : 'NULL';
  const yearSelect = columns.yearColumn ? `v.${columns.yearColumn}` : 'NULL';
  const licenseSelect = columns.licenseColumn ? `v.${columns.licenseColumn}` : 'NULL';

  return {
    vin: `${vinSelect} AS vehicle_vin`,
    brand: `${brandSelect} AS vehicle_brand`,
    make: `${makeSelect} AS vehicle_make`,
    model: `${modelSelect} AS vehicle_model`,
    year: `${yearSelect} AS vehicle_year`,
    license: `${licenseSelect} AS vehicle_license_plate`,
  };
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}.${month}.${year}`;
};

const normalizeText = (value) =>
  value === null || value === undefined || value === '' ? '-' : String(value);

const buildFilename = (vin, licensePlate) => {
  const base = ['service-book', vin || licensePlate || 'vehicle'].filter(Boolean).join('-');
  const sanitized = base
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return sanitized || 'service-book';
};

// Отримати всі записи про обслуговування для автомобілів користувача
exports.getAllServiceRecords = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('Спроба неавторизованого доступу до сервісних записів');
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const db = await getDb();
    const where = [];
    const params = [];
    const vehicleColumns = await getVehicleColumnMap(db);

    if (req.query.vehicle_id) {
      where.push('sr.vehicle_id = ?');
      params.push(req.query.vehicle_id);
    }

    if (req.query.vehicle_vin && vehicleColumns.vinColumn) {
      where.push(`v.${vehicleColumns.vinColumn} = ?`);
      params.push(req.query.vehicle_vin);
    }

    if (req.query.part_number) {
      where.push('sr.parts LIKE ?');
      params.push(`%${req.query.part_number}%`);
    }

    const requestedUserId = req.query.user_id ? String(req.query.user_id) : null;
    const isMaster = String(req.user.role || '').toLowerCase() === 'master';
    if (requestedUserId) {
      if (!isMaster && String(requestedUserId) !== String(req.user.id)) {
        return res.status(403).json({ msg: 'Forbidden' });
      }
      where.push('sr.user_id = ?');
      params.push(requestedUserId);
    } else {
      where.push('sr.user_id = ?');
      params.push(req.user.id);
    }

    logger.info(
      `Отримуємо сервісні записи для користувача ${req.user.id} з фільтрами: ${JSON.stringify(
        req.query
      )}`
    );

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const vehicleSelect = getVehicleSelectParts(vehicleColumns);

    const serviceRecords = (
      await db
        .prepare(
          `SELECT sr.*,
          ${vehicleSelect.vin},
          ${vehicleSelect.brand},
          ${vehicleSelect.make},
          ${vehicleSelect.model},
          ${vehicleSelect.year},
          ${vehicleSelect.license}
        FROM service_records sr
        LEFT JOIN vehicles v ON v.id = sr.vehicle_id
        ${whereSql}
        ORDER BY sr.service_date DESC`
        )
        .all(...params)
    ).map((record) => ({
      ...record,
      service_name: record.service_type,
      vehicle:
        record.vehicle_vin ||
        record.vehicle_brand ||
        record.vehicle_model ||
        record.vehicle_year ||
        record.vehicle_license_plate
          ? {
              vin: record.vehicle_vin,
              brand: record.vehicle_brand,
              make: record.vehicle_make,
              model: record.vehicle_model,
              year: record.vehicle_year,
              licensePlate: record.vehicle_license_plate,
            }
          : null,
    }));

    logger.info(`Знайдено ${serviceRecords.length} сервісних записів`);
    return res.json(serviceRecords);
  } catch (err) {
    logger.error('Server error in getAllServiceRecords:', err);
    res.status(500).json({
      error: 'Failed to fetch service records',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
};

// Отримати запис про обслуговування за ID
exports.getServiceRecordById = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('Unauthorized access attempt to service record');
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const db = await getDb();
    const vehicleColumns = await getVehicleColumnMap(db);
    const vehicleSelect = getVehicleSelectParts(vehicleColumns);
    const serviceRecord = await db
      .prepare(
        `SELECT sr.*,
          ${vehicleSelect.brand},
          ${vehicleSelect.model},
          ${vehicleSelect.year},
          ${vehicleSelect.license}
        FROM service_records sr
        LEFT JOIN vehicles v ON v.id = sr.vehicle_id
        WHERE sr.id = ? AND sr.user_id = ?
        LIMIT 1`
      )
      .get(req.params.id, req.user.id);

    if (!serviceRecord) {
      logger.warn(`Service record with ID ${req.params.id} not found for user ${req.user.id}`);
      return res.status(404).json({ msg: 'Service record not found' });
    }

    logger.info(`Successfully fetched service record ${req.params.id} for user ${req.user.id}`);
    const { vehicle_brand, vehicle_model, vehicle_year, vehicle_license_plate, ...record } =
      serviceRecord;
    res.json({
      ...record,
      vehicles:
        vehicle_brand || vehicle_model || vehicle_year || vehicle_license_plate
          ? {
              brand: vehicle_brand,
              model: vehicle_model,
              year: vehicle_year,
              license_plate: vehicle_license_plate,
            }
          : null,
    });
  } catch (err) {
    logger.error('Server error in getServiceRecordById:', err);
    res.status(500).json({
      error: 'Failed to fetch service record',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
};

// Додати новий запис про обслуговування
exports.addServiceRecord = async (req, res) => {
  const body = req.body || {};
  const vehicleId = body.vehicleId || body.vehicle_id;
  const serviceType = body.serviceType || body.service_type || null;
  const description = body.description ?? '';
  const mileage = body.mileage !== undefined && body.mileage !== null ? Number(body.mileage) : null;
  const serviceDate =
    body.serviceDate || body.service_date || body.performed_at || new Date().toISOString();
  const performedBy = body.performedBy || body.performed_by || null;
  const cost = body.cost !== undefined && body.cost !== null ? Number(body.cost) : 0;
  const parts = body.parts;
  const requestedUserId = body.user_id || body.userId || null;

  try {
    // Check if vehicle belongs to user
    const db = await getDb();
    const isMaster = String(req.user?.role || '').toLowerCase() === 'master';
    const targetUserId = isMaster && requestedUserId ? String(requestedUserId) : req.user.id;
    const vehicle = await db
      .prepare('SELECT id, mileage FROM vehicles WHERE id = ? AND user_id = ?')
      .get(vehicleId, targetUserId);

    if (!vehicle) {
      logger.error('Vehicle not found or does not belong to user');
      return res.status(404).json({ msg: 'Vehicle not found or unauthorized' });
    }

    const recordId = crypto.randomUUID();
    const normalizedParts = normalizeParts(parts);
    await db
      .prepare(
        `INSERT INTO service_records
        (id, vehicle_id, user_id, appointment_id, service_type, description, mileage, service_date, performed_by, cost, parts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        recordId,
        vehicleId,
        targetUserId,
        body.appointment_id || body.appointmentId || null,
        serviceType,
        description,
        mileage,
        serviceDate,
        performedBy,
        cost,
        normalizedParts
      );

    const newServiceRecord = await db
      .prepare('SELECT * FROM service_records WHERE id = ?')
      .get(recordId);

    // Update vehicle's mileage if new mileage is higher
    const nextMileage = mileage !== undefined ? Number(mileage) : undefined;
    if (
      Number.isFinite(nextMileage) &&
      (vehicle.mileage === null || nextMileage > vehicle.mileage)
    ) {
      const updateResult = await db
        .prepare('UPDATE vehicles SET mileage = ? WHERE id = ?')
        .run(nextMileage, vehicleId);

      if (updateResult.changes === 0) {
        logger.error('Error updating vehicle mileage');
      }
    }

    res.status(201).json(newServiceRecord);
  } catch (err) {
    logger.error('Add service record error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Оновити запис про обслуговування
exports.updateServiceRecord = async (req, res) => {
  const { id } = req.params;
  const { serviceType, description, mileage, serviceDate, performedBy, cost, parts } = req.body;

  try {
    // First, check if the service record exists and belongs to the user
    const db = await getDb();
    const existingRecord = await db
      .prepare('SELECT id, vehicle_id, user_id FROM service_records WHERE id = ?')
      .get(id);

    const isMaster = req.user && req.user.role === 'master';
    if (!existingRecord || (!isMaster && existingRecord.user_id !== req.user.id)) {
      logger.error('Service record not found or unauthorized');
      return res.status(404).json({ msg: 'Service record not found or unauthorized' });
    }

    const updates = [];
    const values = [];

    if (serviceType !== undefined || req.body.service_type !== undefined) {
      updates.push('service_type = ?');
      values.push(serviceType || req.body.service_type);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (mileage !== undefined) {
      updates.push('mileage = ?');
      values.push(mileage);
    }
    if (serviceDate !== undefined || req.body.service_date !== undefined) {
      updates.push('service_date = ?');
      values.push(serviceDate || req.body.service_date);
    }
    if (performedBy !== undefined || req.body.performed_by !== undefined) {
      updates.push('performed_by = ?');
      values.push(performedBy || req.body.performed_by);
    }
    if (cost !== undefined) {
      updates.push('cost = ?');
      values.push(cost);
    }
    if (parts !== undefined) {
      updates.push('parts = ?');
      values.push(normalizeParts(parts));
    }

    if (updates.length > 0) {
      await db
        .prepare(`UPDATE service_records SET ${updates.join(', ')} WHERE id = ?`)
        .run(...values, id);
    }

    const updatedRecord = await db.prepare('SELECT * FROM service_records WHERE id = ?').get(id);

    res.json(updatedRecord);
  } catch (err) {
    logger.error('Update service record error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Видалити запис про обслуговування
exports.deleteServiceRecord = async (req, res) => {
  const { id } = req.params;

  try {
    // First, check if the service record exists and belongs to the user
    const db = await getDb();
    const existingRecord = await db
      .prepare('SELECT id FROM service_records WHERE id = ? AND user_id = ?')
      .get(id, req.user.id);

    if (!existingRecord) {
      logger.error('Service record not found or unauthorized');
      return res.status(404).json({ msg: 'Service record not found or unauthorized' });
    }

    await db.prepare('DELETE FROM service_records WHERE id = ?').run(id);

    res.json({ msg: 'Service record removed' });
  } catch (err) {
    logger.error('Delete service record error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

exports.exportServiceHistoryPdf = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const vin = req.params && req.params.vin ? String(req.params.vin).trim() : '';
    if (!vin) {
      return res.status(400).json({ message: 'VIN is required' });
    }

    const db = await getDb();
    const vehicleColumns = await getVehicleColumnMap(db);
    if (!vehicleColumns.vinColumn) {
      return res.status(400).json({ message: 'VIN is not available' });
    }

    const vehicleSelect = getVehicleSelectParts(vehicleColumns);
    const vehicle = await db
      .prepare(
        `SELECT v.id,
        ${vehicleSelect.vin},
        ${vehicleSelect.brand},
        ${vehicleSelect.make},
        ${vehicleSelect.model},
        ${vehicleSelect.year},
        ${vehicleSelect.license}
      FROM vehicles v
      WHERE v.${vehicleColumns.vinColumn} = ?
        AND v.user_id = ?
      LIMIT 1`
      )
      .get(vin, req.user.id);

    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    const records = await db
      .prepare(
        `SELECT sr.*
      FROM service_records sr
      WHERE sr.vehicle_id = ?
        AND sr.user_id = ?
      ORDER BY sr.service_date DESC`
      )
      .all(vehicle.id, req.user.id);

    const filename = buildFilename(vehicle.vehicle_vin || vin, vehicle.vehicle_license_plate);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    const vehicleTitle = [vehicle.vehicle_make || vehicle.vehicle_brand, vehicle.vehicle_model]
      .filter(Boolean)
      .join(' ');

    doc.fontSize(18).text('Сервісна книга');
    doc.moveDown(0.5);
    doc.fontSize(12);
    if (vehicleTitle) doc.text(`Авто: ${vehicleTitle}`);
    if (vehicle.vehicle_year) doc.text(`Рік: ${vehicle.vehicle_year}`);
    if (vehicle.vehicle_license_plate) doc.text(`Номер: ${vehicle.vehicle_license_plate}`);
    doc.text(`VIN: ${vehicle.vehicle_vin || vin}`);
    doc.moveDown();

    if (!records.length) {
      doc.text('Записів не знайдено');
      doc.end();
      return;
    }

    const columns = [
      { key: 'date', label: 'Дата', width: 0.16 },
      { key: 'type', label: 'Послуга', width: 0.3 },
      { key: 'mileage', label: 'Пробіг', width: 0.16 },
      { key: 'performedBy', label: 'Виконавець', width: 0.2 },
      { key: 'cost', label: 'Вартість', width: 0.18 },
    ];

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const drawHeader = () => {
      let x = doc.page.margins.left;
      const y = doc.y;
      doc.font('Helvetica-Bold').fontSize(10);
      columns.forEach((column) => {
        const colWidth = pageWidth * column.width;
        doc.text(column.label, x, y, { width: colWidth });
        x += colWidth;
      });
      doc.moveDown(0.4);
      doc.font('Helvetica');
    };

    drawHeader();
    let y = doc.y;

    records.forEach((record) => {
      const row = {
        date: formatDate(record.service_date || record.serviceDate),
        type: normalizeText(
          record.service_type || record.serviceType || record.service_name || record.serviceName
        ),
        mileage: record.mileage ? `${record.mileage} км` : '-',
        performedBy: normalizeText(record.performed_by || record.performedBy),
        cost: normalizeText(record.cost),
      };

      const values = columns.map((column) => row[column.key]);
      const heights = values.map((value, index) =>
        doc.heightOfString(value, { width: pageWidth * columns[index].width })
      );
      const rowHeight = Math.max(...heights) + 6;

      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        drawHeader();
        y = doc.y;
      }

      let x = doc.page.margins.left;
      values.forEach((value, index) => {
        const colWidth = pageWidth * columns[index].width;
        doc.text(value, x, y, { width: colWidth });
        x += colWidth;
      });
      y += rowHeight;
      doc.y = y;
    });

    doc.end();
  } catch (err) {
    logger.error('Export service history PDF error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};
