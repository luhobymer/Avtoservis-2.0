const nodemailer = require('nodemailer');

let cachedTransport = null;

const getEnv = (name) => {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : null;
};

const isConfigured = () => {
  const host = getEnv('SMTP_HOST');
  const port = getEnv('SMTP_PORT');
  const from = getEnv('SMTP_FROM');
  return Boolean(host && port && from);
};

const getTransport = () => {
  if (cachedTransport) return cachedTransport;

  const host = getEnv('SMTP_HOST');
  const port = Number(getEnv('SMTP_PORT') || 0);
  const secure = String(getEnv('SMTP_SECURE') || '').toLowerCase() === 'true';
  const user = getEnv('SMTP_USER');
  const pass = getEnv('SMTP_PASS');

  if (!host || !port) {
    throw new Error('SMTP is not configured');
  }

  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });

  return cachedTransport;
};

const sendMail = async ({ to, subject, text, html }) => {
  const from = getEnv('SMTP_FROM');
  if (!from) {
    throw new Error('SMTP_FROM is required');
  }

  const transport = getTransport();
  await transport.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
};

module.exports = {
  isConfigured,
  sendMail,
};
