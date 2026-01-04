const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.js');
const { supabase } = require('../config/supabase.js');
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

    const payload = {
      user_id: userId,
      token,
      platform,
      device_name: device_name || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('push_tokens')
      .upsert(payload, { onConflict: 'token' })
      .select()
      .single();

    if (error) {
      logger.error('Push token upsert error:', error);
      return res.status(500).json({ msg: 'Server error', details: error.message });
    }

    logger.info(`Registered push token for user ${userId}`);
    return res.json({ success: true, token: data });
  } catch (err) {
    logger.error('Push token register error:', err);
    return res.status(500).json({ msg: 'Server error', details: err.message });
  }
});

module.exports = router;
