const logger = require('../middleware/logger');

const health = async (req, res) => {
  res.json({ ok: true, provider: 'viber', timestamp: new Date().toISOString() });
};

const webhook = async (req, res) => {
  try {
    logger.info('[Viber] webhook received', {
      ip: req.ip,
      hasBody: typeof req.body !== 'undefined',
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error('[Viber] webhook error:', err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
};

module.exports = {
  health,
  webhook,
};
