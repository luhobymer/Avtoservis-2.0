const webPush = require('web-push');
const crypto = require('crypto');
const { getDb } = require('../db/d1');
const logger = require('../middleware/logger.js');

const getEnv = (name) => {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : null;
};

const base64UrlToBuffer = (base64UrlString) => {
  if (!base64UrlString) return null;
  const padding = '='.repeat((4 - (base64UrlString.length % 4)) % 4);
  const base64 = (base64UrlString + padding).replace(/-/g, '+').replace(/_/g, '/');
  try {
    return Buffer.from(base64, 'base64');
  } catch (_) {
    return null;
  }
};

const ensureVapidConfigured = () => {
  const publicKey = getEnv('VAPID_PUBLIC_KEY');
  const privateKey = getEnv('VAPID_PRIVATE_KEY');
  const subject = getEnv('VAPID_SUBJECT') || 'mailto:admin@example.com';

  if (!publicKey || !privateKey) {
    return { ok: false, reason: 'Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY' };
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  return { ok: true, publicKey };
};

const normalizeSubscription = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const endpoint = typeof raw.endpoint === 'string' ? raw.endpoint : '';
  if (!endpoint) return null;

  const keys = raw.keys && typeof raw.keys === 'object' ? raw.keys : {};
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh : null;
  const auth = typeof keys.auth === 'string' ? keys.auth : null;

  return {
    endpoint,
    keys: { p256dh, auth },
  };
};

const upsertSubscription = async ({ userId, subscription, userAgent }) => {
  const normalized = normalizeSubscription(subscription);
  if (!normalized) {
    throw new Error('Invalid subscription');
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const db = await getDb();

  await db
    .prepare(
      `INSERT INTO web_push_subscriptions
       (id, user_id, endpoint, p256dh, auth, user_agent, created_at, last_used_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(endpoint) DO UPDATE SET
         user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         user_agent = excluded.user_agent,
         last_used_at = excluded.last_used_at,
         is_active = 1`
    )
    .run(
      id,
      userId,
      normalized.endpoint,
      normalized.keys.p256dh,
      normalized.keys.auth,
      userAgent || null,
      now,
      now
    );

  const stored = await db
    .prepare('SELECT * FROM web_push_subscriptions WHERE endpoint = ?')
    .get(normalized.endpoint);

  return stored;
};

const deactivateSubscription = async ({ userId, endpoint }) => {
  if (!endpoint) throw new Error('Missing endpoint');

  const db = await getDb();
  const now = new Date().toISOString();

  await db
    .prepare(
      `UPDATE web_push_subscriptions
       SET is_active = 0, last_used_at = ?
       WHERE endpoint = ? AND user_id = ?`
    )
    .run(now, endpoint, userId);

  return true;
};

const listActiveSubscriptionsForUser = async (userId) => {
  const db = await getDb();
  const rows = await db
    .prepare(
      'SELECT * FROM web_push_subscriptions WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC'
    )
    .all(userId);
  return Array.isArray(rows) ? rows : [];
};

const toWebPushSubscriptionObject = (row) => {
  const endpoint = row?.endpoint;
  if (!endpoint) return null;
  return {
    endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
};

const sendWebPushToUser = async (userId, payload) => {
  const vapid = ensureVapidConfigured();
  if (!vapid.ok) {
    throw new Error(vapid.reason);
  }

  const subscriptions = await listActiveSubscriptionsForUser(userId);
  if (!subscriptions.length) {
    return { sent: 0, failed: 0, total: 0 };
  }

  const db = await getDb();
  const now = new Date().toISOString();

  let sent = 0;
  let failed = 0;

  for (const row of subscriptions) {
    const subscription = toWebPushSubscriptionObject(row);
    if (!subscription) continue;

    try {
      await webPush.sendNotification(subscription, JSON.stringify(payload || {}));
      sent += 1;
      await db
        .prepare('UPDATE web_push_subscriptions SET last_used_at = ? WHERE endpoint = ?')
        .run(now, row.endpoint);
    } catch (err) {
      failed += 1;
      const statusCode = err?.statusCode;
      const gone = statusCode === 404 || statusCode === 410;
      if (gone) {
        try {
          await db
            .prepare(
              'UPDATE web_push_subscriptions SET is_active = 0, last_used_at = ? WHERE endpoint = ?'
            )
            .run(now, row.endpoint);
        } catch (_) {
          void _;
        }
      }
      logger.warn('Web push send failed:', {
        endpoint: row.endpoint,
        statusCode,
        message: err?.message,
      });
    }
  }

  return { sent, failed, total: subscriptions.length };
};

const getVapidPublicKey = () => {
  const vapid = ensureVapidConfigured();
  if (!vapid.ok) {
    return null;
  }
  return vapid.publicKey;
};

const urlBase64ToUint8Array = (base64UrlString) => {
  const buf = base64UrlToBuffer(base64UrlString);
  if (!buf) return null;
  return new Uint8Array(buf);
};

module.exports = {
  ensureVapidConfigured,
  getVapidPublicKey,
  urlBase64ToUint8Array,
  upsertSubscription,
  deactivateSubscription,
  sendWebPushToUser,
};
