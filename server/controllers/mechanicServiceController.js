const crypto = require('crypto');
const { getDb, getExistingColumn } = require('../db/d1');
const { resolveCurrentMechanic } = require('../utils/resolveCurrentMechanic');

const normalizeBoolInt = (value, defaultValue = 0) => {
  if (value === true) return 1;
  if (value === false) return 0;
  if (value == null) return defaultValue;
  const text = String(value).trim().toLowerCase();
  if (text === '1' || text === 'true' || text === 'yes' || text === 'on') return 1;
  if (text === '0' || text === 'false' || text === 'no' || text === 'off') return 0;
  const num = Number(text);
  if (!Number.isNaN(num)) return num ? 1 : 0;
  return defaultValue;
};

exports.getMechanicServices = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    let mechanicId = String(req.params.id || '').trim();
    if (['mechanic', 'master'].includes(role)) {
      const currentMechanic = await resolveCurrentMechanic(req.user, {
        createIfMissing: true,
        enableAllServices: true,
      });
      mechanicId = currentMechanic?.id ? String(currentMechanic.id) : '';
    }
    if (!mechanicId) {
      return res.status(400).json({ message: 'Не вказано mechanic id' });
    }

    const enabledOnly = normalizeBoolInt(req.query.enabled, 0) === 1;
    const db = await getDb();
    const serviceColumns = await getServiceColumnConfig(db);
    const overrideConfig = await getMechanicServiceOverrideConfig(db);

    const categoriesTable = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='service_categories'")
      .get();
    const hasCategories = Boolean(categoriesTable && categoriesTable.name);

    const priceOverrideSelect = overrideConfig.hasPriceOverride
      ? 'ms.price_override'
      : 'NULL AS price_override';
    const durationOverrideSelect = overrideConfig.hasDurationOverride
      ? 'ms.duration_override'
      : 'NULL AS duration_override';

    const where = enabledOnly
      ? 'WHERE COALESCE(ms.is_enabled, 0) = 1 AND COALESCE(s.is_active, 1) = 1'
      : '';

    const rows = await db
      .prepare(
        hasCategories
          ? `SELECT
              s.*,
              COALESCE(ms.is_enabled, 0) AS is_enabled,
              ${priceOverrideSelect},
              ${durationOverrideSelect},
              sc.id AS category_id_ref,
              sc.name AS category_name
            FROM services s
            LEFT JOIN mechanic_services ms
              ON ms.service_id = s.id AND ms.mechanic_id = ?
            LEFT JOIN service_categories sc
              ON sc.id = s.category_id
            ${where}
            ORDER BY COALESCE(sc.name, ''), COALESCE(s.name, '')`
          : `SELECT
              s.*,
              COALESCE(ms.is_enabled, 0) AS is_enabled,
              ${priceOverrideSelect},
              ${durationOverrideSelect},
              NULL AS category_id_ref,
              NULL AS category_name
            FROM services s
            LEFT JOIN mechanic_services ms
              ON ms.service_id = s.id AND ms.mechanic_id = ?
            ${where}
            ORDER BY COALESCE(s.name, '')`
      )
      .all(mechanicId);

    const list = Array.isArray(rows) ? rows : [];
    const mapped = list.map((row) => {
      const { category_id_ref, category_name, ...service } = row;

      const basePriceRaw = row?.[serviceColumns.price];
      const baseDurationRaw = row?.[serviceColumns.duration];
      const basePrice = basePriceRaw != null ? Number(basePriceRaw) : null;
      const baseDuration = baseDurationRaw != null ? Number(baseDurationRaw) : null;

      const effectivePrice = row.price_override != null ? Number(row.price_override) : basePrice;
      const effectiveDuration = row.duration_override != null ? Number(row.duration_override) : baseDuration;
      return {
        ...service,
        base_price: Number.isFinite(basePrice) ? basePrice : null,
        base_duration: Number.isFinite(baseDuration) ? baseDuration : null,
        price: Number.isFinite(effectivePrice) ? effectivePrice : null,
        duration: Number.isFinite(effectiveDuration) ? effectiveDuration : null,
        is_enabled: Number(row.is_enabled || 0) === 1,
        category: category_id_ref
          ? {
              id: category_id_ref,
              name: category_name || '',
            }
          : null,
      };
    });

    return res.json(mapped);
  } catch (err) {
    const includeDetails = String(process.env.NODE_ENV || '').toLowerCase() !== 'production';
    return res
      .status(500)
      .json({ message: 'Помилка сервера', ...(includeDetails ? { details: err?.message } : {}) });
  }
};

exports.setMechanicServiceEnabled = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    let mechanicId = String(req.params.id || '').trim();
    if (['mechanic', 'master'].includes(role)) {
      const currentMechanic = await resolveCurrentMechanic(req.user, {
        createIfMissing: true,
        enableAllServices: true,
      });
      mechanicId = currentMechanic?.id ? String(currentMechanic.id) : '';
    }
    const serviceId = String(req.params.serviceId || '').trim();
    if (!mechanicId || !serviceId) {
      return res.status(400).json({ message: 'Не вказано mechanicId або serviceId' });
    }

    const isEnabled = normalizeBoolInt(req.body?.is_enabled, 1);
    const db = await getDb();
    const now = new Date().toISOString();

    try {
      await db
        .prepare(
          `INSERT INTO mechanic_services (id, mechanic_id, service_id, is_enabled, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(mechanic_id, service_id) DO UPDATE SET
             is_enabled = excluded.is_enabled,
             updated_at = excluded.updated_at`
        )
        .run(crypto.randomUUID(), mechanicId, serviceId, isEnabled, now, now);
    } catch (err) {
      const existing = await db
        .prepare('SELECT id FROM mechanic_services WHERE mechanic_id = ? AND service_id = ?')
        .get(mechanicId, serviceId);
      if (existing?.id) {
        await db
          .prepare('UPDATE mechanic_services SET is_enabled = ?, updated_at = ? WHERE id = ?')
          .run(isEnabled, now, existing.id);
      } else {
        await db
          .prepare(
            'INSERT INTO mechanic_services (id, mechanic_id, service_id, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .run(crypto.randomUUID(), mechanicId, serviceId, isEnabled, now, now);
      }
    }

    const row = await db
      .prepare('SELECT * FROM mechanic_services WHERE mechanic_id = ? AND service_id = ?')
      .get(mechanicId, serviceId);

    return res.json(row);
  } catch (err) {
    return res.status(500).json({ message: 'Помилка сервера', details: err.message });
  }
};

const getServiceColumnConfig = async (db) => {
  const columns = await db.prepare('PRAGMA table_info(services)').all();
  const columnNames = new Set((columns || []).map((column) => column.name));
  return {
    price: columnNames.has('base_price') ? 'base_price' : 'price',
    duration: columnNames.has('duration_minutes') ? 'duration_minutes' : 'duration',
    hasCreatedBy: columnNames.has('created_by_mechanic_id'),
    hasPriceText: columnNames.has('price_text'),
    hasDurationText: columnNames.has('duration_text'),
  };
};

const getMechanicServiceOverrideConfig = async (db) => {
  const columns = await db.prepare('PRAGMA table_info(mechanic_services)').all();
  const names = new Set((columns || []).map((column) => column.name));
  return {
    hasPriceOverride: names.has('price_override'),
    hasDurationOverride: names.has('duration_override'),
  };
};

exports.createMechanicService = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    let mechanicId = String(req.params.id || '').trim();
    if (['mechanic', 'master'].includes(role)) {
      const currentMechanic = await resolveCurrentMechanic(req.user, {
        createIfMissing: true,
        enableAllServices: true,
      });
      mechanicId = currentMechanic?.id ? String(currentMechanic.id) : '';
    }
    if (!mechanicId) {
      return res.status(400).json({ message: 'Не вказано mechanic id' });
    }

    const name = req.body?.name ? String(req.body.name).trim() : '';
    const description = req.body?.description ? String(req.body.description).trim() : null;
    const categoryId = req.body?.category_id ? String(req.body.category_id).trim() : null;
    const priceValue = req.body?.price;
    const durationValue = req.body?.duration;
    const priceText = req.body?.price_text != null ? String(req.body.price_text) : null;
    const durationText = req.body?.duration_text != null ? String(req.body.duration_text) : null;

    if (!name) {
      return res.status(400).json({ message: "Поле 'name' обов'язкове" });
    }

    const db = await getDb();
    const stationColumn = await getExistingColumn('mechanics', ['service_station_id', 'station_id']);
    const mechanic = await db
      .prepare(`SELECT id, ${stationColumn} AS station_id FROM mechanics WHERE id = ?`)
      .get(mechanicId);
    if (!mechanic) {
      return res.status(404).json({ message: 'Механіка не знайдено' });
    }

    const serviceColumns = await getServiceColumnConfig(db);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const price = priceValue == null ? null : Number(priceValue);
    const duration = durationValue == null ? null : Number(durationValue);

    const columns = [
      'id',
      'name',
      'description',
      serviceColumns.price,
      ...(serviceColumns.hasPriceText ? ['price_text'] : []),
      serviceColumns.duration,
      ...(serviceColumns.hasDurationText ? ['duration_text'] : []),
      'is_active',
      'service_station_id',
      'category_id',
      'created_at',
      'updated_at',
    ];
    const values = [
      id,
      name,
      description,
      Number.isFinite(price) ? price : null,
      ...(serviceColumns.hasPriceText ? [priceText] : []),
      Number.isFinite(duration) ? duration : null,
      ...(serviceColumns.hasDurationText ? [durationText] : []),
      1,
      mechanic.station_id || null,
      categoryId,
      now,
      now,
    ];

    if (serviceColumns.hasCreatedBy) {
      columns.splice(columns.indexOf('created_at'), 0, 'created_by_mechanic_id');
      values.splice(values.indexOf(now), 0, mechanicId);
    }

    const placeholders = columns.map(() => '?').join(', ');
    await db
      .prepare(`INSERT INTO services (${columns.join(', ')}) VALUES (${placeholders})`)
      .run(...values);

    try {
      await db
        .prepare(
          `INSERT INTO mechanic_services (id, mechanic_id, service_id, is_enabled, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(mechanic_id, service_id) DO UPDATE SET
             is_enabled = excluded.is_enabled,
             updated_at = excluded.updated_at`
        )
        .run(crypto.randomUUID(), mechanicId, id, 1, now, now);
    } catch (_) {
      await db
        .prepare(
          'INSERT INTO mechanic_services (id, mechanic_id, service_id, is_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(crypto.randomUUID(), mechanicId, id, 1, now, now);
    }

    const created = await db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ message: 'Помилка сервера', details: err.message });
  }
};

exports.updateMechanicServiceDetails = async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    let mechanicId = String(req.params.id || '').trim();
    if (['mechanic', 'master'].includes(role)) {
      const currentMechanic = await resolveCurrentMechanic(req.user, {
        createIfMissing: true,
        enableAllServices: true,
      });
      mechanicId = currentMechanic?.id ? String(currentMechanic.id) : '';
    }
    const serviceId = String(req.params.serviceId || '').trim();
    if (!mechanicId || !serviceId) {
      return res.status(400).json({ message: 'Не вказано mechanicId або serviceId' });
    }

    const db = await getDb();
    const serviceColumns = await getServiceColumnConfig(db);
    const row = await db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
    if (!row) {
      return res.status(404).json({ message: 'Послугу не знайдено' });
    }

    const isOwned =
      !serviceColumns.hasCreatedBy ||
      (row.created_by_mechanic_id ? String(row.created_by_mechanic_id) : '') === mechanicId;

    const name = req.body?.name != null ? String(req.body.name).trim() : null;
    const description = req.body?.description != null ? String(req.body.description).trim() : null;
    const categoryId = req.body?.category_id != null ? String(req.body.category_id).trim() : null;
    const priceValue = req.body?.price;
    const durationValue = req.body?.duration;
    const priceText = req.body?.price_text != null ? String(req.body.price_text) : null;
    const durationText = req.body?.duration_text != null ? String(req.body.duration_text) : null;

    const nextPrice = priceValue != null ? Number(priceValue) : null;
    const nextDuration = durationValue != null ? Number(durationValue) : null;

    const now = new Date().toISOString();

    if (isOwned) {
      const updates = [];
      const params = [];

      if (name !== null) {
        updates.push('name = ?');
        params.push(name);
      }
      if (description !== null) {
        updates.push('description = ?');
        params.push(description);
      }
      if (categoryId !== null) {
        updates.push('category_id = ?');
        params.push(categoryId || null);
      }
      if (priceValue != null) {
        updates.push(`${serviceColumns.price} = ?`);
        params.push(Number.isFinite(nextPrice) ? nextPrice : null);
      }
      if (serviceColumns.hasPriceText && priceText !== null) {
        updates.push('price_text = ?');
        params.push(priceText || null);
      }
      if (durationValue != null) {
        updates.push(`${serviceColumns.duration} = ?`);
        params.push(Number.isFinite(nextDuration) ? nextDuration : null);
      }
      if (serviceColumns.hasDurationText && durationText !== null) {
        updates.push('duration_text = ?');
        params.push(durationText || null);
      }

      updates.push('updated_at = ?');
      params.push(now);

      if (updates.length === 0) {
        return res.status(400).json({ message: 'Немає полів для оновлення' });
      }

      params.push(serviceId);

      if (serviceColumns.hasCreatedBy) {
        await db
          .prepare(`UPDATE services SET ${updates.join(', ')} WHERE id = ? AND created_by_mechanic_id = ?`)
          .run(...params, mechanicId);
      } else {
        await db.prepare(`UPDATE services SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      }

      const updated = await db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
      return res.json(updated);
    }

    if (priceValue == null && durationValue == null) {
      return res.status(403).json({ message: 'Можна змінювати тільки ціну/час для не власних послуг' });
    }

    const overrideConfig = await getMechanicServiceOverrideConfig(db);
    if (priceValue != null && !overrideConfig.hasPriceOverride) {
      return res
        .status(500)
        .json({ message: 'Потрібне оновлення бази: відсутнє поле price_override у mechanic_services' });
    }
    if (durationValue != null && !overrideConfig.hasDurationOverride) {
      return res
        .status(500)
        .json({ message: 'Потрібне оновлення бази: відсутнє поле duration_override у mechanic_services' });
    }

    const overrideUpdates = [];
    const overrideParams = [];
    if (priceValue != null) {
      overrideUpdates.push('price_override = ?');
      overrideParams.push(Number.isFinite(nextPrice) ? nextPrice : null);
    }
    if (durationValue != null) {
      overrideUpdates.push('duration_override = ?');
      overrideParams.push(Number.isFinite(nextDuration) ? nextDuration : null);
    }
    overrideUpdates.push('updated_at = ?');
    overrideParams.push(now);

    try {
      await db
        .prepare(
          `INSERT INTO mechanic_services (id, mechanic_id, service_id, is_enabled, price_override, duration_override, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(mechanic_id, service_id) DO UPDATE SET
             price_override = CASE
               WHEN excluded.price_override IS NULL THEN mechanic_services.price_override
               ELSE excluded.price_override
             END,
             duration_override = CASE
               WHEN excluded.duration_override IS NULL THEN mechanic_services.duration_override
               ELSE excluded.duration_override
             END,
             updated_at = excluded.updated_at`
        )
        .run(
          crypto.randomUUID(),
          mechanicId,
          serviceId,
          1,
          priceValue != null && Number.isFinite(nextPrice) ? nextPrice : null,
          durationValue != null && Number.isFinite(nextDuration) ? nextDuration : null,
          now,
          now
        );
    } catch (_) {
      const existing = await db
        .prepare('SELECT id FROM mechanic_services WHERE mechanic_id = ? AND service_id = ?')
        .get(mechanicId, serviceId);
      if (existing?.id) {
        await db
          .prepare(`UPDATE mechanic_services SET ${overrideUpdates.join(', ')} WHERE id = ?`)
          .run(...overrideParams, existing.id);
      } else {
        await db
          .prepare(
            'INSERT INTO mechanic_services (id, mechanic_id, service_id, is_enabled, price_override, duration_override, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          )
          .run(
            crypto.randomUUID(),
            mechanicId,
            serviceId,
            1,
            priceValue != null && Number.isFinite(nextPrice) ? nextPrice : null,
            durationValue != null && Number.isFinite(nextDuration) ? nextDuration : null,
            now,
            now
          );
      }
    }

    const updated = await db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ message: 'Помилка сервера', details: err.message });
  }
};
