const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const getEnv = (name) => {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : null;
};

const getR2Config = () => {
  const accessKeyId = getEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = getEnv('R2_SECRET_ACCESS_KEY');
  const bucket = getEnv('R2_BUCKET');
  let endpoint = getEnv('R2_ENDPOINT');
  let publicBaseUrl = getEnv('R2_PUBLIC_BASE_URL');
  if (!accessKeyId || !secretAccessKey || !bucket || !endpoint || !publicBaseUrl) {
    return null;
  }

  endpoint = String(endpoint).trim().replace(/\/+$/, '');
  const bucketSuffix = `/${bucket}`;
  if (endpoint.toLowerCase().endsWith(bucketSuffix.toLowerCase())) {
    endpoint = endpoint.slice(0, -bucketSuffix.length);
  }

  publicBaseUrl = String(publicBaseUrl).trim().replace(/\/+$/, '');
  return { accessKeyId, secretAccessKey, bucket, endpoint, publicBaseUrl };
};

const r2Config = getR2Config();
const r2Client = r2Config
  ? new S3Client({
      region: 'auto',
      endpoint: r2Config.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: r2Config.accessKeyId,
        secretAccessKey: r2Config.secretAccessKey,
      },
    })
  : null;

const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

router.get('/status', (req, res) => {
  res.json({
    r2Configured: !!(r2Client && r2Config),
    bucket: r2Config?.bucket || null,
    endpoint: r2Config?.endpoint || null,
    publicBaseUrl: r2Config?.publicBaseUrl || null,
  });
});

// Configure storage
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp|heic|heif/;
    const mimetype = filetypes.test(file.mimetype);
    const isImageMime = typeof file.mimetype === 'string' && file.mimetype.toLowerCase().startsWith('image/');
    const isOctetStream = typeof file.mimetype === 'string' && file.mimetype.toLowerCase() === 'application/octet-stream';
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (isImageMime || mimetype || extname || isOctetStream) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  },
});

// Upload endpoint
router.post(
  '/',
  (req, res, next) => {
    upload.single('photo')(req, res, (err) => {
      if (!err) return next();
      if (err && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'File is too large (max 15MB)' });
      }
      return res.status(400).json({ message: err?.message || 'Upload failed' });
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      if (isProduction && !(r2Client && r2Config)) {
        return res.status(503).json({
          message:
            'Завантаження фото не налаштовано для production (потрібно підключити Cloudflare R2: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT, R2_PUBLIC_BASE_URL)',
        });
      }

      let fileUrl = null;
      let filename = null;
      let storageType = null;
      const originalExt = path.extname(req.file.originalname);
      const safeExt = (() => {
        const ext = (originalExt || '').trim();
        if (ext) return ext;
        const mime = String(req.file.mimetype || '').toLowerCase();
        if (mime.includes('png')) return '.png';
        if (mime.includes('webp')) return '.webp';
        if (mime.includes('heic')) return '.heic';
        if (mime.includes('heif')) return '.heif';
        return '.jpg';
      })();
      const key = `${Date.now()}-${crypto.randomUUID()}${safeExt}`;

      const writeLocal = () => {
        const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const destPath = path.join(uploadsDir, key);
        fs.writeFileSync(destPath, req.file.buffer);
        filename = key;
        fileUrl = `/api/uploads/${key}`;
        storageType = 'local';
      };

      if (r2Client && r2Config) {
        try {
          await r2Client.send(
            new PutObjectCommand({
              Bucket: r2Config.bucket,
              Key: key,
              Body: req.file.buffer,
              ContentType: req.file.mimetype,
            })
          );
          filename = key;
          fileUrl = `${r2Config.publicBaseUrl.replace(/\/$/, '')}/${key}`;
          storageType = 'r2';
        } catch (err) {
          console.error('R2 upload error:', err);
          if (isProduction) {
            return res.status(502).json({
              message: 'Помилка завантаження фото в Cloudflare R2',
              details: err?.message || null,
            });
          }
          writeLocal();
        }
      } else {
        writeLocal();
      }
      res.json({
        message: 'File uploaded successfully',
        url: fileUrl,
        filename: filename,
        storage: storageType,
      });
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).json({ message: err?.message || 'Server error during upload' });
    }
  }
);

module.exports = router;
