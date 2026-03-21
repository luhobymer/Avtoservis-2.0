/**
 * Notifications routes
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.js');
const { getDb, getExistingColumn } = require('../db/d1');
const logger = require('../middleware/logger.js');

// Get all notifications for the authenticated user
router.get('/', auth, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('Unauthorized access attempt to notifications');
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const hasPaginationParams =
      typeof req.query.limit !== 'undefined' || typeof req.query.offset !== 'undefined';
    const rawLimit = req.query.limit;
    const rawOffset = req.query.offset;
    const parsedLimit = Number.parseInt(String(rawLimit ?? ''), 10);
    const parsedOffset = Number.parseInt(String(rawOffset ?? ''), 10);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 20;
    const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

    const db = await getDb();

    if (hasPaginationParams) {
      const rows = await db
        .prepare(
          'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
        )
        .all(req.user.id, limit + 1, offset);

      const arr = Array.isArray(rows) ? rows : [];
      const hasMore = arr.length > limit;
      const data = hasMore ? arr.slice(0, limit) : arr;
      const nextOffset = offset + data.length;

      logger.info(
        `Successfully fetched ${data.length} notifications (paged) for user ${req.user.id}, offset=${offset}, limit=${limit}`
      );
      return res.json({ data, hasMore, nextOffset });
    }

    const notifications = await db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.user.id);

    logger.info(
      `Successfully fetched ${notifications?.length || 0} notifications for user ${req.user.id}`
    );
    res.json(notifications || []);
  } catch (err) {
    logger.error('Notification fetch error:', err);
    res.status(500).json({
      error: 'Server error',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

// Mark a notification as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('Unauthorized attempt to mark notification as read');
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const db = await getDb();
    const readColumn = await getExistingColumn('notifications', ['is_read', 'read']);
    const updateResult = await db
      .prepare(`UPDATE notifications SET ${readColumn} = 1 WHERE id = ? AND user_id = ?`)
      .run(req.params.id, req.user.id);

    if (updateResult.changes === 0) {
      logger.warn(`Notification with ID ${req.params.id} not found for user ${req.user.id}`);
      return res.status(404).json({ msg: 'Notification not found' });
    }

    logger.info(`Marked notification with ID: ${req.params.id} as read for user ${req.user.id}`);
    const updated = await db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    logger.error('Server error in markAsRead:', err);
    res.status(500).json({
      error: 'Failed to mark notification as read',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

// Mark all notifications as read
router.put('/read-all', auth, async (req, res) => {
  try {
    const db = await getDb();
    const readColumn = await getExistingColumn('notifications', ['is_read', 'read']);
    await db
      .prepare(`UPDATE notifications SET ${readColumn} = 1 WHERE user_id = ? AND ${readColumn} = 0`)
      .run(req.user.id);

    res.json({ msg: 'All notifications marked as read' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send({ msg: 'Server error' });
  }
});

// Delete a notification
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('Unauthorized attempt to delete notification');
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const db = await getDb();
    await db
      .prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);

    logger.info(`Deleted notification with ID: ${req.params.id} for user ${req.user.id}`);
    res.json({ msg: 'Notification removed' });
  } catch (err) {
    logger.error('Server error in deleteNotification:', err);
    res.status(500).json({
      error: 'Failed to delete notification',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

// Delete all notifications for the user
router.delete('/', auth, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('Unauthorized attempt to delete all notifications');
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const db = await getDb();
    await db.prepare('DELETE FROM notifications WHERE user_id = ?').run(req.user.id);

    logger.info(`Deleted all notifications for user ${req.user.id}`);
    res.json({ msg: 'All notifications removed' });
  } catch (err) {
    logger.error('Server error in deleteAllNotifications:', err);
    res.status(500).json({
      error: 'Failed to delete all notifications',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
});

module.exports = router;
