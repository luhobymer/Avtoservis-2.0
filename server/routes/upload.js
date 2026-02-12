const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const getEnv = (name) => {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : null;
};

const getR2Config = () => {
  const accessKeyId = getEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = getEnv('R2_SECRET_ACCESS_KEY');
  const bucket = getEnv('R2_BUCKET');
  const endpoint = getEnv('R2_ENDPOINT');
  const publicBaseUrl = getEnv('R2_PUBLIC_BASE_URL');
  if (!accessKeyId || !secretAccessKey || !bucket || !endpoint || !publicBaseUrl) {
    return null;
  }
  return { accessKeyId, secretAccessKey, bucket, endpoint, publicBaseUrl };
};

const r2Config = getR2Config();
const r2Client = r2Config
  ? new S3Client({
      region: 'auto',
      endpoint: r2Config.endpoint,
      credentials: {
        accessKeyId: r2Config.accessKeyId,
        secretAccessKey: r2Config.secretAccessKey,
      },
    })
  : null;

// Configure storage
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  },
});

// Upload endpoint
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    if (!r2Client || !r2Config) {
      return res.status(500).json({ message: 'R2 is required for uploads' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    let fileUrl = null;
    let filename = null;
    const extension = path.extname(req.file.originalname);
    const key = `${Date.now()}-${crypto.randomUUID()}${extension}`;
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
    res.json({
      message: 'File uploaded successfully',
      url: fileUrl,
      filename: filename,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Server error during upload' });
  }
});

module.exports = router;
