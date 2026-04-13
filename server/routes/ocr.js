const express = require('express');
const router = express.Router();
const multer = require('multer');
const ocrController = require('../controllers/ocrController');
const auth = require('../middleware/auth');

// Configure multer for temp storage
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post('/parse', auth, upload.single('image'), ocrController.parsePartsFromImage);

router.post('/plate', auth, upload.single('image'), ocrController.parseLicensePlateFromImage);

// Temporary debug endpoint without auth for testing
router.post('/plate-debug', auth, upload.single('image'), ocrController.parseLicensePlateFromImage);

module.exports = router;
