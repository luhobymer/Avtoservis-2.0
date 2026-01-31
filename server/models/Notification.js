const Joi = require('joi');

const notificationSchema = Joi.object({
  id: Joi.string().guid({ version: 'uuidv4' }),
  user_id: Joi.string().guid({ version: 'uuidv4' }).required(),
  title: Joi.string().required(),
  message: Joi.string().required(),
  is_read: Joi.boolean().default(false),
  created_at: Joi.date().default(() => new Date().toISOString()),
  updated_at: Joi.date().default(() => new Date().toISOString()),
});

const crypto = require('crypto');
const { getDb, getExistingColumn } = require('../db/d1');

class Notification {
  constructor({ id, user_id, title, message, is_read, created_at, updated_at }) {
    this.id = id;
    this.user_id = user_id;
    this.title = title;
    this.message = message;
    this.is_read = is_read;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  validate() {
    const { error } = notificationSchema.validate(this);
    return error;
  }

  static async create(notificationData) {
    const db = await getDb();
    const readColumn = await getExistingColumn('notifications', ['is_read', 'read']);
    const notificationId = notificationData.id || crypto.randomUUID();
    const payload = {
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type || 'general',
      status: notificationData.status || 'pending',
      scheduled_for: notificationData.scheduled_for || null,
      data:
        typeof notificationData.data === 'string'
          ? notificationData.data
          : JSON.stringify(notificationData.data ?? null),
    };

    await db
      .prepare(
        `INSERT INTO notifications
        (id, user_id, title, message, type, status, scheduled_for, data, ${readColumn}, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        notificationId,
        notificationData.user_id,
        payload.title,
        payload.message,
        payload.type,
        payload.status,
        payload.scheduled_for,
        payload.data,
        notificationData.is_read ? 1 : 0,
        notificationData.created_at || new Date().toISOString()
      );

    return await db.prepare('SELECT * FROM notifications WHERE id = ?').get(notificationId);
  }

  static async findByUserId(userId) {
    const db = await getDb();
    return await db
      .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId);
  }

  static async markAsRead(notificationId) {
    const db = await getDb();
    const readColumn = await getExistingColumn('notifications', ['is_read', 'read']);
    await db.prepare(`UPDATE notifications SET ${readColumn} = 1 WHERE id = ?`).run(notificationId);
    return await db.prepare('SELECT * FROM notifications WHERE id = ?').get(notificationId);
  }
}

module.exports = Notification;
