/**
 * Service Records routes
 */

const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth.js');
const ServiceRecord = require('../models/ServiceRecord.js');
const Vehicle = require('../models/Vehicle.js');
const logger = require('../middleware/logger.js');

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
    check('vehicleId', 'Vehicle ID is required').not().isEmpty(),
    check('serviceType', 'Service type is required').not().isEmpty(),
    check('description', 'Description is required').not().isEmpty(),
    check('mileage', 'Mileage is required').isNumeric(),
    check('serviceDate', 'Service date is required').isISO8601(),
    check('performedBy', 'Performed by is required').not().isEmpty(),
    check('cost', 'Cost is required').isNumeric(),
  ],
  serviceRecordController.addServiceRecord
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
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // Get all user's vehicles
      const vehicles = await Vehicle.findAll({
        where: { UserId: req.user.id },
        attributes: ['id'],
      });

      const vehicleIds = vehicles.map((vehicle) => vehicle.id);

      // Get service record if it belongs to one of user's vehicles
      let serviceRecord = await ServiceRecord.findOne({
        where: {
          id: req.params.id,
          VehicleId: vehicleIds,
        },
      });

      if (!serviceRecord) {
        return res.status(404).json({ msg: 'Service record not found' });
      }

      // Update fields
      const { serviceType, description, mileage, serviceDate, performedBy, cost, parts } = req.body;
      if (serviceType) serviceRecord.serviceType = serviceType;
      if (description) serviceRecord.description = description;
      if (mileage) serviceRecord.mileage = mileage;
      if (serviceDate) serviceRecord.serviceDate = serviceDate;
      if (performedBy) serviceRecord.performedBy = performedBy;
      if (cost) serviceRecord.cost = cost;
      if (parts) serviceRecord.parts = parts;
      // Не оновлюємо поле createdBy, оскільки воно може бути відсутнє в базі даних

      await serviceRecord.save();

      // Update vehicle's mileage if needed
      if (mileage) {
        const vehicle = await Vehicle.findByPk(serviceRecord.VehicleId);
        if (mileage > vehicle.mileage) {
          vehicle.mileage = mileage;
          await vehicle.save();
        }
      }

      res.json(serviceRecord);
    } catch (err) {
      logger.error(err.message);
      res.status(500).send('Server error');
    }
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