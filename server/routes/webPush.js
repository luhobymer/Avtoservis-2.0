const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.js');
const logger = require('../middleware/logger.js');
const {
  ensureVapidConfigured,
  getVapidPublicKey,
  upsertSubscription,
  deactivateSubscription,
  sendWebPushToUser,
} = require('../services/webPushService.js');

router.get('/vapid-public-key', auth, async (req, res) => {
  try {
    const key = getVapidPublicKey();
    if (!key) {
      return res
        .status(500)
        .json({ msg: 'Web push not configured', details: 'Missing VAPID keys' });
    }
    return res.json({ publicKey: key });
  } catch (err) {
    logger.error('Failed to get VAPID public key:', err);
    return res.status(500).json({ msg: 'Server error', details: err.message });
  }
});

router.post('/subscribe', auth, async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ msg: 'Unauthorized' });

    const vapid = ensureVapidConfigured();
    if (!vapid.ok) {
      return res.status(500).json({ msg: 'Web push not configured', details: vapid.reason });
    }

    const stored = await upsertSubscription({
      userId: req.user.id,
      subscription: req.body?.subscription,
      userAgent: req.headers['user-agent'] || null,
    });

    return res.json({ success: true, subscription: stored });
  } catch (err) {
    logger.error('Web push subscribe error:', err);
    return res.status(500).json({ msg: 'Server error', details: err.message });
  }
});

router.post('/unsubscribe', auth, async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ msg: 'Unauthorized' });

    const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : '';
    if (!endpoint) {
      return res.status(400).json({ msg: 'Missing endpoint' });
    }

    await deactivateSubscription({ userId: req.user.id, endpoint });
    return res.json({ success: true });
  } catch (err) {
    logger.error('Web push unsubscribe error:', err);
    return res.status(500).json({ msg: 'Server error', details: err.message });
  }
});

router.post('/test', auth, async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ msg: 'Unauthorized' });

    const vapid = ensureVapidConfigured();
    if (!vapid.ok) {
      return res.status(500).json({ msg: 'Web push not configured', details: vapid.reason });
    }

    const payload = {
      title: 'Автосервіс',
      body: 'Тестове push-сповіщення',
      data: {
        url: '/notifications',
      },
    };

    const result = await sendWebPushToUser(req.user.id, payload);
    return res.json({ success: true, result });
  } catch (err) {
    logger.error('Web push test error:', err);
    return res.status(500).json({ msg: 'Server error', details: err.message });
  }
});

module.exports = router;
