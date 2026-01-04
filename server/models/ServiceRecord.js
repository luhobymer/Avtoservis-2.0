const Joi = require('joi');

const serviceRecordSchema = Joi.object({
  id: Joi.string().guid({ version: 'uuidv4' }),
  vehicle_id: Joi.string().guid({ version: 'uuidv4' }).required(),
  service_date: Joi.date().iso().required(),
  mileage: Joi.number().integer().min(0).required(),
  work_performed: Joi.string().required(),
  parts_replaced: Joi.string(),
  created_at: Joi.date().default(() => new Date().toISOString()),
  updated_at: Joi.date().default(() => new Date().toISOString()),
});

class ServiceRecord {
  constructor({
    id,
    vehicle_id,
    service_date,
    mileage,
    work_performed,
    parts_replaced,
    created_at,
    updated_at,
  }) {
    this.id = id;
    this.vehicle_id = vehicle_id;
    this.service_date = service_date;
    this.mileage = mileage;
    this.work_performed = work_performed;
    this.parts_replaced = parts_replaced;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  validate() {
    const { error } = serviceRecordSchema.validate(this);
    return error;
  }
}

module.exports = ServiceRecord;
