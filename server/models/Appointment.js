const Joi = require('joi');

const appointmentSchema = Joi.object({
  id: Joi.string().guid({ version: 'uuidv4' }),
  vehicle_vin: Joi.string()
    .pattern(/^[A-HJ-NPR-Z0-9]{17}$/)
    .required(),
  service_date: Joi.date().iso().required(),
  time_slot: Joi.string().required(),
  status: Joi.string().valid('pending', 'confirmed', 'completed', 'cancelled').default('pending'),
  notes: Joi.string(),
  created_at: Joi.date().default(() => new Date().toISOString()),
  updated_at: Joi.date().default(() => new Date().toISOString()),
});

class Appointment {
  constructor({ id, vehicle_vin, service_date, time_slot, status, notes, created_at, updated_at }) {
    this.id = id;
    this.vehicle_vin = vehicle_vin;
    this.service_date = service_date;
    this.time_slot = time_slot;
    this.status = status;
    this.notes = notes;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  validate() {
    const { error } = appointmentSchema.validate(this);
    return error;
  }
}

module.exports = Appointment;
