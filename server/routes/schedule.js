const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getDb } = require('../db/d1');
const { resolveCurrentMechanic } = require('../utils/resolveCurrentMechanic');

function defaultWorkingHours() {
  return {
    1: { start_time: '09:00', end_time: '18:00', is_working_day: true },
    2: { start_time: '09:00', end_time: '18:00', is_working_day: true },
    3: { start_time: '09:00', end_time: '18:00', is_working_day: true },
    4: { start_time: '09:00', end_time: '18:00', is_working_day: true },
    5: { start_time: '09:00', end_time: '18:00', is_working_day: true },
    6: { start_time: '10:00', end_time: '15:00', is_working_day: false },
    0: { start_time: '00:00', end_time: '00:00', is_working_day: false },
  };
}

function normalizeWorkingHours(items) {
  const result = {};
  for (const item of items || []) {
    const day = Number(item.day_of_week);
    if (!Number.isFinite(day) || day < 0 || day > 6) continue;
    result[String(day)] = {
      start_time: item.start_time || '00:00',
      end_time: item.end_time || '00:00',
      is_working_day: Boolean(item.is_working_day),
    };
  }
  return result;
}

async function seedDefaultWorkingHours(db, masterId) {
  const defaults = defaultWorkingHours();
  const now = new Date().toISOString();
  const entries = Object.entries(defaults);
  for (const [day, value] of entries) {
    await db
      .prepare(
        `INSERT INTO mechanic_working_hours
          (master_id, day_of_week, start_time, end_time, is_working_day, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(master_id, day_of_week) DO UPDATE SET
           start_time = excluded.start_time,
           end_time = excluded.end_time,
           is_working_day = excluded.is_working_day,
           updated_at = excluded.updated_at`
      )
      .run(
        masterId,
        Number(day),
        value.start_time,
        value.end_time,
        value.is_working_day ? 1 : 0,
        now,
        now
      );
  }
  return defaults;
}

async function getMechanicsBusyColumns(db) {
  try {
    const columns = await db.prepare('PRAGMA table_info(mechanics)').all();
    const names = new Set((columns || []).map((c) => c.name));
    return {
      hasBusyUntil: names.has('busy_until'),
      hasBusyReason: names.has('busy_reason'),
    };
  } catch (_) {
    return {
      hasBusyUntil: false,
      hasBusyReason: false,
    };
  }
}

// Отримати статус зайнятості механіка
router.get('/busy-status', auth, async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    const canViewOtherMechanic = ['admin', 'master'].includes(role);
    const requestedMechanicId = req.query.mechanic_id ? String(req.query.mechanic_id) : '';

    const db = await getDb();

    const mechanic = await resolveCurrentMechanic(req.user, {
      createIfMissing: true,
      enableAllServices: true,
    });
    const currentMechanicId = mechanic?.id ? String(mechanic.id) : '';
    const effectiveMechanicId =
      requestedMechanicId && canViewOtherMechanic ? requestedMechanicId : currentMechanicId;

    if (!effectiveMechanicId) {
      return res.json({ busy_until: null, busy_reason: null });
    }

    const busyColumns = await getMechanicsBusyColumns(db);
    if (!busyColumns.hasBusyUntil && !busyColumns.hasBusyReason) {
      return res.json({ busy_until: null, busy_reason: null });
    }

    const selectParts = [];
    if (busyColumns.hasBusyUntil) selectParts.push('busy_until');
    if (busyColumns.hasBusyReason) selectParts.push('busy_reason');
    const selectClause = selectParts.join(', ');

    const row = await db
      .prepare(
        `SELECT ${selectClause} FROM mechanics WHERE id = ?`
      )
      .get(effectiveMechanicId);

    if (!row) {
      return res.json({ busy_until: null, busy_reason: null });
    }

    res.json({
      busy_until: busyColumns.hasBusyUntil ? row.busy_until ?? null : null,
      busy_reason: busyColumns.hasBusyReason ? row.busy_reason ?? null : null
    });
  } catch (err) {
    console.error('[schedule][busy-status] Error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

// Встановити статус зайнятості механіка
router.post('/busy-status', auth, async (req, res) => {
  try {
    const { mechanic_id, busy_until, busy_reason } = req.body;
    const role = String(req.user?.role || '').toLowerCase();
    const canSetOtherMechanic = ['admin', 'master'].includes(role);

    const db = await getDb();

    const mechanic = await resolveCurrentMechanic(req.user, {
      createIfMissing: true,
      enableAllServices: true,
    });
    const currentMechanicId = mechanic?.id ? String(mechanic.id) : '';
    const requestedMechanicId = mechanic_id ? String(mechanic_id) : '';
    const effectiveMechanicId =
      requestedMechanicId && canSetOtherMechanic ? requestedMechanicId : currentMechanicId;

    if (!effectiveMechanicId) {
      return res.status(400).json({ message: 'mechanic_id is required' });
    }

    const busyColumns = await getMechanicsBusyColumns(db);
    const setParts = [];
    const values = [];
    if (busyColumns.hasBusyUntil) {
      setParts.push('busy_until = ?');
      values.push(busy_until || null);
    }
    if (busyColumns.hasBusyReason) {
      setParts.push('busy_reason = ?');
      values.push(busy_reason || null);
    }

    if (setParts.length === 0) {
      return res.json({ success: true });
    }

    await db
      .prepare(
        `UPDATE mechanics SET ${setParts.join(', ')} WHERE id = ?`
      )
      .run(...values, effectiveMechanicId);

    res.json({ success: true });
  } catch (err) {
    console.error('[schedule][busy-status] POST Error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

// Отримати робочі години майстра
router.get('/working-hours', auth, async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    const canViewOtherMaster = ['admin', 'master', 'mechanic'].includes(role);
    const requestedMasterId = req.query.master_id ? String(req.query.master_id) : '';

    const db = await getDb();

    let effectiveMasterId = requestedMasterId;
    if (!effectiveMasterId || !canViewOtherMaster) {
      const mechanic = await resolveCurrentMechanic(req.user, {
        createIfMissing: true,
        enableAllServices: true,
      });
      effectiveMasterId = mechanic?.id ? String(mechanic.id) : '';
    }

    if (!effectiveMasterId) {
      return res.status(400).json({ message: 'master_id is required' });
    }

    const rows = await db
      .prepare(
        `SELECT day_of_week, start_time, end_time, is_working_day
         FROM mechanic_working_hours
         WHERE master_id = ?`
      )
      .all(effectiveMasterId);

    if (!rows || rows.length === 0) {
      if (['admin', 'master', 'mechanic'].includes(role) && effectiveMasterId === String(req.user?.id || '')) {
        const seeded = await seedDefaultWorkingHours(db, effectiveMasterId);
        return res.json(seeded);
      }
      return res.json(defaultWorkingHours());
    }

    const mapped = normalizeWorkingHours(
      rows.map((r) => ({
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        is_working_day: Number(r.is_working_day) === 1,
      }))
    );

    const fallback = defaultWorkingHours();
    return res.json({ ...fallback, ...mapped });
  } catch (err) {
    console.error('[schedule][working-hours] Error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

// Оновити робочі години майстра
router.post('/working-hours', auth, async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    const canSetOtherMaster = ['admin', 'master', 'mechanic'].includes(role);

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const requestedMasterId = body.master_id ? String(body.master_id) : '';
    const items = Array.isArray(body.items) ? body.items : [];

    const db = await getDb();

    const mechanic = await resolveCurrentMechanic(req.user, {
      createIfMissing: true,
      enableAllServices: true,
    });
    const currentMasterId = mechanic?.id ? String(mechanic.id) : '';

    const effectiveMasterId =
      requestedMasterId && canSetOtherMaster ? requestedMasterId : currentMasterId;

    if (!effectiveMasterId) {
      return res.status(400).json({ message: 'master_id is required' });
    }

    if (items.length === 0) {
      return res.status(400).json({ message: 'items are required' });
    }

    const now = new Date().toISOString();
    let upserts = 0;
    for (const item of items) {
      const day = Number(item?.day_of_week);
      if (!Number.isFinite(day) || day < 0 || day > 6) continue;
      const startTime = item?.start_time ? String(item.start_time) : '00:00';
      const endTime = item?.end_time ? String(item.end_time) : '00:00';
      const isWorkingDay = item?.is_working_day ? 1 : 0;

      await db
        .prepare(
          `INSERT INTO mechanic_working_hours
            (master_id, day_of_week, start_time, end_time, is_working_day, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(master_id, day_of_week) DO UPDATE SET
             start_time = excluded.start_time,
             end_time = excluded.end_time,
             is_working_day = excluded.is_working_day,
             updated_at = excluded.updated_at`
        )
        .run(effectiveMasterId, day, startTime, endTime, isWorkingDay, now, now);
      upserts += 1;
    }

    if (upserts === 0) {
      return res.status(400).json({ message: 'No valid items provided' });
    }

    const rows = await db
      .prepare(
        `SELECT day_of_week, start_time, end_time, is_working_day
         FROM mechanic_working_hours
         WHERE master_id = ?`
      )
      .all(effectiveMasterId);

    const mapped = normalizeWorkingHours(
      rows.map((r) => ({
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        is_working_day: Number(r.is_working_day) === 1,
      }))
    );

    const fallback = defaultWorkingHours();
    return res.json({ ...fallback, ...mapped });
  } catch (err) {
    console.error('[schedule][working-hours] POST Error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

module.exports = router;
