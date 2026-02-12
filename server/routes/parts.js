const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const { checkAdmin } = require('../middleware/checkRole');
const partsController = require('../controllers/partsController');

router.get('/', auth, checkAdmin, partsController.listParts);
router.get('/:id', auth, checkAdmin, partsController.getPartById);
router.post('/', auth, checkAdmin, partsController.createPart);
router.put('/:id', auth, checkAdmin, partsController.updatePart);
router.delete('/:id', auth, checkAdmin, partsController.deletePart);

module.exports = router;
