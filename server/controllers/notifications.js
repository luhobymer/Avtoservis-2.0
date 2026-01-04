const { supabase } = require('../config/supabase.js');
const Notification = require('../models/Notification.js');
const logger = require('../middleware/logger.js');

const getNotifications = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('Unauthorized access attempt to notifications');
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch notifications:', error);
      throw error;
    }

    logger.info(`Successfully fetched ${data?.length || 0} notifications for user ${req.user.id}`);
    res.json(data || []);
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
    const newNotification = {
      ...req.body,
      user_id: req.user.id,
      read: false,
    };

    const { data, error } = await supabase.from('notifications').insert([newNotification]).select();

    if (error) {
      logger.error('Failed to create notification:', error);
      throw error;
    }

    logger.info(`Created notification with ID: ${data[0]?.id}`);
    res.status(201).json(data[0]);
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

    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select();

    if (error) {
      logger.error('Failed to mark notification as read:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      logger.warn(`Notification with ID ${req.params.id} not found for user ${req.user.id}`);
      return res.status(404).json({ msg: 'Notification not found' });
    }

    logger.info(`Marked notification with ID: ${req.params.id} as read for user ${req.user.id}`);
    res.json(data[0]);
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
