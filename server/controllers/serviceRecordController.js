const { supabase } = require('../config/supabase.js');
const logger = require('../middleware/logger.js');

// Отримати всі записи про обслуговування для автомобілів користувача
exports.getAllServiceRecords = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('Спроба неавторизованого доступу до сервісних записів');
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    logger.info(`Отримуємо сервісні записи для користувача ${req.user.id}`);

    const { data: serviceRecords, error: recordsError } = await supabase
      .from('service_records')
      .select('*, vehicles (vin, brand, make, model, year)')
      .eq('user_id', req.user.id)
      .order('service_date', { ascending: false });

    if (recordsError) {
      logger.error('Помилка отримання записів:', recordsError);
      return res.status(500).json({ error: 'Помилка сервера' });
    }

    logger.info(`Знайдено ${serviceRecords.length} сервісних записів`);
    return res.json(
      serviceRecords.map((record) => ({
        id: record.id,
        serviceType: record.service_type,
        description: record.description,
        mileage: record.mileage,
        serviceDate: record.service_date,
        performedBy: record.performed_by,
        cost: record.cost,
        vehicle: record.vehicles,
        createdAt: record.created_at,
      }))
    );
  } catch (err) {
    logger.error('Server error in getAllServiceRecords:', err);
    res.status(500).json({
      error: 'Failed to fetch service records',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
};

// Отримати запис про обслуговування за ID
exports.getServiceRecordById = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      logger.warn('Unauthorized access attempt to service record');
      return res.status(401).json({ msg: 'Unauthorized' });
    }

    const { data: serviceRecord, error: recordError } = await supabase
      .from('service_records')
      .select('*, vehicles(brand, model, year, license_plate)')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id) // Ensure the record belongs to the user
      .single();

    if (recordError) {
      logger.error('Failed to fetch service record:', recordError);
      return res.status(404).json({
        msg: 'Service record not found',
        details: recordError.message,
      });
    }

    if (!serviceRecord) {
      logger.warn(`Service record with ID ${req.params.id} not found for user ${req.user.id}`);
      return res.status(404).json({ msg: 'Service record not found' });
    }

    logger.info(`Successfully fetched service record ${req.params.id} for user ${req.user.id}`);
    res.json(serviceRecord);
  } catch (err) {
    logger.error('Server error in getServiceRecordById:', err);
    res.status(500).json({
      error: 'Failed to fetch service record',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
};

// Додати новий запис про обслуговування
exports.addServiceRecord = async (req, res) => {
  const { vehicleId, serviceType, description, mileage, serviceDate, performedBy, cost, parts } =
    req.body;

  try {
    // Check if vehicle belongs to user
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id, mileage')
      .eq('id', vehicleId)
      .eq('user_id', req.user.id)
      .single();

    if (vehicleError || !vehicle) {
      logger.error('Vehicle not found or does not belong to user:', vehicleError);
      return res.status(404).json({ msg: 'Vehicle not found or unauthorized' });
    }

    const { data: newServiceRecord, error: insertError } = await supabase
      .from('service_records')
      .insert({
        vehicle_id: vehicleId,
        user_id: req.user.id,
        service_type: serviceType,
        description,
        mileage,
        service_date: serviceDate,
        performed_by: performedBy,
        cost,
        parts,
      })
      .select()
      .single();

    if (insertError) {
      logger.error('Error inserting service record:', insertError);
      throw insertError;
    }

    // Update vehicle's mileage if new mileage is higher
    if (mileage > vehicle.mileage) {
      const { error: updateError } = await supabase
        .from('vehicles')
        .update({ mileage: mileage })
        .eq('id', vehicleId);

      if (updateError) {
        logger.error('Error updating vehicle mileage:', updateError);
        // Do not throw, as service record was already created
      }
    }

    res.status(201).json(newServiceRecord);
  } catch (err) {
    logger.error('Add service record error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Оновити запис про обслуговування
exports.updateServiceRecord = async (req, res) => {
  const { id } = req.params;
  const { serviceType, description, mileage, serviceDate, performedBy, cost, parts } = req.body;

  try {
    // First, check if the service record exists and belongs to the user
    const { data: existingRecord, error: fetchError } = await supabase
      .from('service_records')
      .select('id, vehicle_id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !existingRecord) {
      logger.error('Service record not found or unauthorized:', fetchError);
      return res.status(404).json({ msg: 'Service record not found or unauthorized' });
    }

    const { data: updatedRecord, error: updateError } = await supabase
      .from('service_records')
      .update({
        service_type: serviceType,
        description,
        mileage,
        service_date: serviceDate,
        performed_by: performedBy,
        cost,
        parts,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating service record:', updateError);
      throw updateError;
    }

    res.json(updatedRecord);
  } catch (err) {
    logger.error('Update service record error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};

// Видалити запис про обслуговування
exports.deleteServiceRecord = async (req, res) => {
  const { id } = req.params;

  try {
    // First, check if the service record exists and belongs to the user
    const { data: existingRecord, error: fetchError } = await supabase
      .from('service_records')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (fetchError || !existingRecord) {
      logger.error('Service record not found or unauthorized:', fetchError);
      return res.status(404).json({ msg: 'Service record not found or unauthorized' });
    }

    const { error: deleteError } = await supabase.from('service_records').delete().eq('id', id);

    if (deleteError) {
      logger.error('Error deleting service record:', deleteError);
      throw deleteError;
    }

    res.json({ msg: 'Service record removed' });
  } catch (err) {
    logger.error('Delete service record error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
};
