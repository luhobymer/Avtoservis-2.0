const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.js');
const crypto = require('crypto');
const { getDb } = require('../db/d1');
const logger = require('../middleware/logger.js');

router.post('/tokens', auth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { token, platform, device_name } = req.body;

    if (!userId) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    if (!token || !platform) {
      return res.status(400).json({ msg: 'Missing token or platform' });
    }

    const db = await getDb();
    const columns = await db.prepare('PRAGMA table_info(push_tokens)').all();
    if (!columns || columns.length === 0) {
      logger.error('Push tokens table not found');
      return res.status(500).json({ msg: 'Server error', details: 'push_tokens table missing' });
    }

    const columnMap = new Map(columns.map((column) => [column.name, column.type || '']));
    const activeColumn = columnMap.has('is_active')
      ? 'is_active'
      : columnMap.has('isActive')
        ? 'isActive'
        : columnMap.has('active')
          ? 'active'
          : null;
    const deviceColumn = columnMap.has('device_name')
      ? 'device_name'
      : columnMap.has('device_id')
        ? 'device_id'
        : null;
    const updatedAtColumn = columnMap.has('updated_at')
      ? 'updated_at'
      : columnMap.has('updatedAt')
        ? 'updatedAt'
        : null;
    const createdAtColumn = columnMap.has('created_at')
      ? 'created_at'
      : columnMap.has('createdAt')
        ? 'createdAt'
        : null;
    const idColumn = columnMap.has('id') ? 'id' : null;
    const idType = idColumn ? columnMap.get(idColumn) : '';
    const includeId = idColumn && !/int/i.test(idType);

    const now = new Date().toISOString();
    const insertColumns = ['user_id', 'token', 'platform'];
    const insertValues = [userId, token, platform];

    if (includeId) {
      insertColumns.unshift('id');
      insertValues.unshift(crypto.randomUUID());
    }
    if (deviceColumn) {
      insertColumns.push(deviceColumn);
      insertValues.push(device_name || null);
    }
    if (activeColumn) {
      insertColumns.push(activeColumn);
      insertValues.push(1);
    }
    if (updatedAtColumn) {
      insertColumns.push(updatedAtColumn);
      insertValues.push(now);
    }
    if (createdAtColumn) {
      insertColumns.push(createdAtColumn);
      insertValues.push(now);
    }

    const placeholders = insertColumns.map(() => '?').join(', ');
    const updates = ['user_id = excluded.user_id', 'platform = excluded.platform'];

    if (deviceColumn) {
      updates.push(`${deviceColumn} = excluded.${deviceColumn}`);
    }
    if (activeColumn) {
      updates.push(`${activeColumn} = 1`);
    }
    if (updatedAtColumn) {
      updates.push(`${updatedAtColumn} = excluded.${updatedAtColumn}`);
    }

    await db
      .prepare(
        `INSERT INTO push_tokens (${insertColumns.join(', ')})
       VALUES (${placeholders})
       ON CONFLICT(token) DO UPDATE SET ${updates.join(', ')}`
      )
      .run(...insertValues);

    const data = await db.prepare('SELECT * FROM push_tokens WHERE token = ?').get(token);

    logger.info(`Registered push token for user ${userId}`);
    return res.json({ success: true, token: data });
  } catch (err) {
    logger.error('Push token register error:', err);
    return res.status(500).json({ msg: 'Server error', details: err.message });
  }
});

module.exports = router;
