const Joi = require('joi');

const vehicleSchema = Joi.object({
  id: Joi.string().guid({ version: 'uuidv4' }),
  vin: Joi.string()
    .pattern(/^[A-HJ-NPR-Z0-9]{17}$/)
    .required(),
  user_id: Joi.string().guid({ version: 'uuidv4' }).required(),
  brand: Joi.string().max(50).required(),
  make: Joi.string().max(50).optional(), // Псевдонім для brand
  model: Joi.string().max(50).required(),
  year: Joi.number()
    .integer()
    .min(1900)
    .max(new Date().getFullYear() + 1),
  license_plate: Joi.string()
    .pattern(/^[A-ZА-ЯЄІЇҐ]{2}\d{4}[A-ZА-ЯЄІЇҐ]{2}$/)
    .optional(),
  licensePlate: Joi.string().optional(), // Псевдонім для license_plate
  color: Joi.string().max(30).optional(),
  mileage: Joi.number().integer().min(0).optional(),
  created_at: Joi.date().default(() => new Date().toISOString()),
  updated_at: Joi.date().default(() => new Date().toISOString()),
}).options({ allowUnknown: true });

class Vehicle {
  constructor({
    id,
    vin,
    user_id,
    brand,
    model,
    year,
    license_plate,
    mileage,
    created_at,
    updated_at,
  }) {
    this.id = id;
    this.vin = vin;
    this.user_id = user_id;
    this.brand = brand;
    this.model = model;
    this.year = year;
    this.license_plate = license_plate;
    this.mileage = mileage;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  validate() {
    const { error } = vehicleSchema.validate(this);
    return error;
  }
}

module.exports = Vehicle;
