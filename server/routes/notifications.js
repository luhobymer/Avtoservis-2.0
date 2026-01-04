/**
 * Notifications routes
 */

const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification.js');
const auth = require('../middleware/auth.js');
const { supabase } = require('../config/supabase.js');
const logger = require('../middleware/logger.js');

// Get all notifications for the authenticated user
router.get('/', auth, async (req, res) => {
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
      logger.error('Supabase notification fetch error:', error);
      throw error;
    }

    logger.info(`Successfully fetched ${data?.length || 0} notifications for user ${req.user.id}`);
    res.json(data || []);
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

    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true, updated_at: new Date().toISOString() })
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
});

// Mark all notifications as read
router.put('/read-all', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq('user_id', req.user.id)
      .eq('is_read', false)
      .select();

    if (error) throw error;

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

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) {
      logger.error('Failed to delete notification:', error);
      throw error;
    }

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

    const { error } = await supabase.from('notifications').delete().eq('user_id', req.user.id);

    if (error) {
      logger.error('Failed to delete all notifications:', error);
      throw error;
    }

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
