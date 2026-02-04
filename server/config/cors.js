const defaultOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const parseOrigins = (value) => {
  if (!value) {
    return defaultOrigins;
  }
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const allowedOrigins = parseOrigins(process.env.CORS_ORIGIN);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    const isDev = String(process.env.NODE_ENV || '').toLowerCase() !== 'production';
    if (isDev) {
      const devAllowed = [
        /^https?:\/\/localhost(?::\d+)?$/,
        /^https?:\/\/127\.0\.0\.1(?::\d+)?$/,
        /^https?:\/\/10\.(?:\d{1,3}\.){2}\d{1,3}(?::\d+)?$/,
        /^https?:\/\/192\.168\.(?:\d{1,3}\.)\d{1,3}(?::\d+)?$/,
        /^https?:\/\/172\.(?:1[6-9]|2\d|3[0-1])\.(?:\d{1,3}\.)\d{1,3}(?::\d+)?$/,
      ];
      if (devAllowed.some((re) => re.test(origin))) {
        return callback(null, true);
      }
    }

    return callback(new Error('Not allowed by CORS'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
  exposedHeaders: ['x-auth-token'],
  credentials: true,
  maxAge: 86400,
};

module.exports = corsOptions;
