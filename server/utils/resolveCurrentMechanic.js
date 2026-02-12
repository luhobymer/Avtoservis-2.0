const crypto = require('crypto');
const { getDb, getExistingColumn } = require('../db/d1');

const splitName = (name) => {
  const raw = name != null ? String(name).trim() : '';
  if (!raw) return null;
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

async function resolveCurrentMechanic(user, options = {}) {
  const role = String(user?.role || '').toLowerCase();
  if (!['master', 'mechanic', 'admin'].includes(role)) return null;

  const db = await getDb();

  const userId = user?.id ? String(user.id).trim() : '';
  let email = user?.email ? String(user.email).trim() : '';
  let phone = user?.phone ? String(user.phone).trim() : '';
  let displayName = user?.name ? String(user.name).trim() : '';

  if (!email && !phone && userId) {
    const row = await db
      .prepare('SELECT email, phone, name FROM users WHERE id = ? LIMIT 1')
      .get(userId);
    email = row?.email ? String(row.email).trim() : '';
    phone = row?.phone ? String(row.phone).trim() : '';
    displayName = row?.name ? String(row.name).trim() : displayName;
  }

  let mechanic = null;

  if (userId) {
    mechanic = await db.prepare('SELECT * FROM mechanics WHERE id = ? LIMIT 1').get(userId);
  }
  if (!mechanic && email) {
    mechanic = await db
      .prepare('SELECT * FROM mechanics WHERE lower(email) = lower(?) LIMIT 1')
      .get(email);
  }
  if (!mechanic && phone) {
    mechanic = await db.prepare('SELECT * FROM mechanics WHERE phone = ? LIMIT 1').get(phone);
  }

  if (mechanic) return mechanic;

  if (!options.createIfMissing) return null;
  if (!userId) return null;

  const nameParts = splitName(displayName);
  const firstName = nameParts?.firstName || 'Майстер';
  const lastName = nameParts?.lastName || 'Механік';

  let stationId = null;
  try {
    const station = await db
      .prepare('SELECT id FROM service_stations ORDER BY created_at ASC LIMIT 1')
      .get();
    stationId = station?.id ? String(station.id) : null;
  } catch (_) {
    stationId = null;
  }

  const stationColumn = await getExistingColumn('mechanics', ['service_station_id', 'station_id']);
  const now = new Date().toISOString();
  const insertColumns = ['id', 'first_name', 'last_name', 'phone', 'email'];
  const insertValues = [userId, firstName, lastName, phone || null, email || null];
  if (stationColumn) {
    insertColumns.push(stationColumn);
    insertValues.push(stationId);
  }
  insertColumns.push('created_at', 'updated_at');
  insertValues.push(now, now);

  const placeholders = insertColumns.map(() => '?').join(', ');
  await db
    .prepare(`INSERT INTO mechanics (${insertColumns.join(', ')}) VALUES (${placeholders})`)
    .run(...insertValues);

  if (options.enableAllServices) {
    const rows = await db.prepare('SELECT id FROM services WHERE COALESCE(is_active, 1) = 1').all();
    const serviceIds = (rows || []).map((r) => r.id).filter(Boolean);
    for (const sid of serviceIds) {
      await db
        .prepare(
          `INSERT INTO mechanic_services (id, mechanic_id, service_id, is_enabled, created_at, updated_at)
           VALUES (?, ?, ?, 1, ?, ?)
           ON CONFLICT(mechanic_id, service_id) DO UPDATE SET
             is_enabled = excluded.is_enabled,
             updated_at = excluded.updated_at`
        )
        .run(crypto.randomUUID(), userId, String(sid), now, now);
    }
  }

  mechanic = await db.prepare('SELECT * FROM mechanics WHERE id = ? LIMIT 1').get(userId);
  return mechanic;
}

module.exports = { resolveCurrentMechanic };
