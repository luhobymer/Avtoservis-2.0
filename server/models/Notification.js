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

const { supabase } = require('../config/supabase.js');

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
    const { data, error } = await supabase
      .from('notifications')
      .insert([notificationData])
      .select();

    if (error) throw error;
    return data[0];
  }

  static async findByUserId(userId) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async markAsRead(notificationId) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select();

    if (error) throw error;
    return data[0];
  }
}

module.exports = Notification;
