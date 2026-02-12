const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const auth = require('../middleware/auth.js');
const { getDb } = require('../db/d1');
const logger = require('../middleware/logger.js');

const isPrivileged = (user) => {
  const role = String(user?.role || '').toLowerCase();
  return role === 'master' || role === 'mechanic';
};

router.get('/conversations', auth, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const relatedEntity = req.query.related_entity
      ? String(req.query.related_entity)
      : 'appointment';
    const limit = Math.min(1000, Math.max(50, Number(req.query.limit || 400)));
    const db = await getDb();
    const uid = String(req.user.id);

    const rows = await db
      .prepare(
        `SELECT * FROM interactions
         WHERE (sender_id = ? OR recipient_id = ?) AND related_entity = ?
         ORDER BY datetime(created_at) DESC, created_at DESC
         LIMIT ${limit}`
      )
      .all(uid, uid, relatedEntity);

    const list = Array.isArray(rows) ? rows : [];
    const map = new Map();

    for (const row of list) {
      const entityId = row.related_entity_id ? String(row.related_entity_id) : '';
      if (!entityId) continue;

      if (!map.has(entityId)) {
        const peerId =
          String(row.sender_id) === uid ? String(row.recipient_id) : String(row.sender_id);
        map.set(entityId, {
          related_entity: relatedEntity,
          related_entity_id: entityId,
          last_message: row.message || '',
          last_at: row.created_at || null,
          unread_count: 0,
          peer_id: peerId,
        });
      }

      if (String(row.recipient_id) === uid && String(row.status || '') === 'unread') {
        map.get(entityId).unread_count += 1;
      }
    }

    const result = Array.from(map.values()).sort((a, b) => {
      const atA = a.last_at ? new Date(a.last_at).getTime() : 0;
      const atB = b.last_at ? new Date(b.last_at).getTime() : 0;
      return atB - atA;
    });

    return res.json(result);
  } catch (err) {
    logger.error('Interactions conversations error:', err);
    return res.status(500).json({ msg: 'Server error', details: err.message });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const db = await getDb();
    const params = [];
    const where = [];

    const userId = req.query.user_id ? String(req.query.user_id) : null;
    const recipientId = req.query.recipient_id ? String(req.query.recipient_id) : null;
    const status = req.query.status ? String(req.query.status) : null;
    const relatedEntity = req.query.related_entity ? String(req.query.related_entity) : null;
    const relatedEntityId = req.query.related_entity_id
      ? String(req.query.related_entity_id)
      : null;

    const privileged = isPrivileged(req.user);

    if (userId) {
      if (!privileged && userId !== req.user.id) {
        return res.status(403).json({ msg: 'Forbidden' });
      }
      where.push('(sender_id = ? OR recipient_id = ?)');
      params.push(userId, userId);
    } else if (recipientId) {
      if (!privileged && recipientId !== req.user.id) {
        return res.status(403).json({ msg: 'Forbidden' });
      }
      where.push('recipient_id = ?');
      params.push(recipientId);
    } else if (!privileged) {
      where.push('(sender_id = ? OR recipient_id = ?)');
      params.push(req.user.id, req.user.id);
    }

    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (relatedEntity) {
      where.push('related_entity = ?');
      params.push(relatedEntity);
    }
    if (relatedEntityId) {
      where.push('related_entity_id = ?');
      params.push(relatedEntityId);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await db
      .prepare(
        `SELECT * FROM interactions ${whereSql} ORDER BY datetime(created_at) ASC, created_at ASC`
      )
      .all(...params);

    return res.json(Array.isArray(rows) ? rows : []);
  } catch (err) {
    logger.error('Interactions fetch error:', err);
    return res.status(500).json({ msg: 'Server error', details: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const db = await getDb();
    const privileged = isPrivileged(req.user);

    const senderId = req.body.sender_id ? String(req.body.sender_id) : req.user.id;
    if (!privileged && senderId !== req.user.id) {
      return res.status(403).json({ msg: 'Forbidden' });
    }

    const recipientId = req.body.recipient_id ? String(req.body.recipient_id) : null;
    const message = req.body.message ? String(req.body.message).trim() : '';
    if (!recipientId || !message) {
      return res.status(400).json({ msg: 'Missing recipient_id or message' });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const payload = {
      sender_role: req.body.sender_role
        ? String(req.body.sender_role)
        : String(req.user.role || ''),
      sender_name: req.body.sender_name
        ? String(req.body.sender_name)
        : String(req.user.name || ''),
      recipient_role: req.body.recipient_role ? String(req.body.recipient_role) : null,
      recipient_name: req.body.recipient_name ? String(req.body.recipient_name) : null,
      type: req.body.type ? String(req.body.type) : 'message',
      status: req.body.status ? String(req.body.status) : 'unread',
      related_entity: req.body.related_entity ? String(req.body.related_entity) : null,
      related_entity_id: req.body.related_entity_id ? String(req.body.related_entity_id) : null,
    };

    await db
      .prepare(
        `INSERT INTO interactions
        (id, sender_id, sender_role, sender_name, recipient_id, recipient_role, recipient_name,
         message, type, status, related_entity, related_entity_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        senderId,
        payload.sender_role,
        payload.sender_name,
        recipientId,
        payload.recipient_role,
        payload.recipient_name,
        message,
        payload.type,
        payload.status,
        payload.related_entity,
        payload.related_entity_id,
        now
      );

    const created = await db.prepare('SELECT * FROM interactions WHERE id = ?').get(id);

    // --- Create Notification for Recipient ---
    if (recipientId && recipientId !== senderId) {
      try {
        const notifId = crypto.randomUUID();
        const senderName = payload.sender_name || 'Користувач';
        const notifMessage = `Нове повідомлення від ${senderName}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`;

        await db
          .prepare(
            `
          INSERT INTO notifications (id, user_id, type, message, is_read, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `
          )
          .run(notifId, recipientId, 'chat_message', notifMessage, 0, now);
      } catch (notifErr) {
        logger.error('Failed to create chat notification:', notifErr);
        // Don't fail the request if notification fails
      }
    }
    // -----------------------------------------

    return res.status(201).json(created);
  } catch (err) {
    logger.error('Interaction create error:', err);
    return res.status(500).json({ msg: 'Server error', details: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const status = req.body.status ? String(req.body.status) : null;
    if (!status) {
      return res.status(400).json({ msg: 'Missing status' });
    }

    const db = await getDb();
    const row = await db.prepare('SELECT * FROM interactions WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ msg: 'Not found' });
    }

    const privileged = isPrivileged(req.user);
    if (!privileged && String(row.recipient_id) !== String(req.user.id)) {
      return res.status(403).json({ msg: 'Forbidden' });
    }

    await db.prepare('UPDATE interactions SET status = ? WHERE id = ?').run(status, req.params.id);
    const updated = await db.prepare('SELECT * FROM interactions WHERE id = ?').get(req.params.id);
    return res.json(updated);
  } catch (err) {
    logger.error('Interaction update error:', err);
    return res.status(500).json({ msg: 'Server error', details: err.message });
  }
});

module.exports = router;
