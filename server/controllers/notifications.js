const crypto = require('crypto');
const { getDb, getExistingColumn } = require('../db/d1');
const logger = require('../middleware/logger.js');

const getNotifications = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('Unauthorized access attempt to notifications');
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const db = await getDb();
    const notifications = await db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.user.id);

    logger.info(
      `Successfully fetched ${notifications?.length || 0} notifications for user ${req.user.id}`
    );
    res.json(notifications || []);
  } catch (err) {
    logger.error('Server error in getNotifications:', err);
    res.status(500).json({
      error: 'Failed to fetch notifications',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
};

const createNotification = async (req, res) => {
  try {
    const db = await getDb();
    const readColumn = await getExistingColumn('notifications', ['is_read', 'read']);
    const notificationId = crypto.randomUUID();
    const payload = {
      title: req.body.title,
      message: req.body.message,
      type: req.body.type || 'general',
      status: req.body.status || 'pending',
      scheduled_for: req.body.scheduled_for || null,
      data:
        typeof req.body.data === 'string' ? req.body.data : JSON.stringify(req.body.data ?? null),
    };

    await db
      .prepare(
        `INSERT INTO notifications
        (id, user_id, title, message, type, status, scheduled_for, data, ${readColumn}, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        notificationId,
        req.user.id,
        payload.title,
        payload.message,
        payload.type,
        payload.status,
        payload.scheduled_for,
        payload.data,
        0,
        new Date().toISOString()
      );

    const created = await db
      .prepare('SELECT * FROM notifications WHERE id = ?')
      .get(notificationId);
    logger.info(`Created notification with ID: ${created?.id}`);
    res.status(201).json(created);
  } catch (err) {
    logger.error('Server error in createNotification:', err);
    res.status(500).json({
      error: 'Failed to create notification',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
};

const markAsRead = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('Unauthorized attempt to mark notification as read');
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const db = await getDb();
    const readColumn = await getExistingColumn('notifications', ['is_read', 'read']);
    const updateResult = await db
      .prepare(
        `UPDATE notifications
         SET ${readColumn} = 1
         WHERE id = ? AND user_id = ?`
      )
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
};

module.exports = {
  getNotifications,
  createNotification,
  markAsRead,
};
