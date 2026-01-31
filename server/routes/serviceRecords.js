/**
 * Service Records routes
 */

const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth.js');
const { checkAdmin } = require('../middleware/checkRole');

// @route   POST api/service-records
// @desc    Add a new service record
// @access  Private
const serviceRecordController = require('../controllers/serviceRecordController.js');

// @route   POST api/service-records
// @desc    Add a new service record
// @access  Private
router.post(
  '/',
  [
    auth,
    check('vehicleId')
      .custom((value, { req }) => {
        const vehicleId = value || req.body.vehicle_id || req.body.vehicleId;
        if (!vehicleId) {
          throw new Error('Vehicle ID is required');
        }
        return true;
      })
      .optional({ nullable: true }),
    check('serviceType')
      .custom((value, { req }) => {
        const serviceType = value || req.body.service_type || req.body.serviceType;
        if (!serviceType) {
          throw new Error('Service type is required');
        }
        return true;
      })
      .optional({ nullable: true }),
    check('mileage').optional({ nullable: true }).isNumeric(),
    check('serviceDate').optional({ nullable: true }).isISO8601(),
    check('cost').optional({ nullable: true }).isNumeric(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    return serviceRecordController.addServiceRecord(req, res);
  }
);

// @route   GET api/service-records
// @desc    Get all service records for user's vehicles
// @access  Private
router.get('/', auth, serviceRecordController.getAllServiceRecords);

// @route   GET api/service-records/:id
// @desc    Get service record by ID
// @access  Private
router.get('/:id', auth, serviceRecordController.getServiceRecordById);

// @route   PUT api/service-records/:id
// @desc    Update service record
// @access  Private
router.put(
  '/:id',
  [
    auth,
    check('serviceType', 'Service type is required').optional(),
    check('description', 'Description is required').optional(),
    check('mileage', 'Mileage is required').optional().isNumeric(),
    check('serviceDate', 'Service date is required').optional().isISO8601(),
    check('performedBy', 'Performed by is required').optional(),
    check('cost', 'Cost is required').optional().isNumeric(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    return serviceRecordController.updateServiceRecord(req, res);
  }
);

// @route   DELETE api/service-records/:id
// @desc    Delete a service record
// @access  Private
router.delete('/:id', auth, serviceRecordController.deleteServiceRecord);

// @route   PUT api/service-records/:id/admin
// @desc    Update service record by admin
// @access  Admin
router.put(
  '/:id/admin',
  [
    auth,
    checkAdmin,
    check('vehicleId', 'Vehicle ID is required').optional(),
    check('serviceType', 'Service type is required').optional(),
    check('description', 'Description is required').optional(),
    check('mileage', 'Mileage is required').optional().isNumeric(),
    check('serviceDate', 'Service date is required').optional().isISO8601(),
    check('performedBy', 'Performed by is required').optional(),
    check('cost', 'Cost is required').optional().isNumeric(),
  ],
  serviceRecordController.updateServiceRecord
);

module.exports = router;
