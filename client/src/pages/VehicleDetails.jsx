import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getById as getVehicleById, create as createVehicle, update as updateVehicle, remove as removeVehicle, lookupRegistryByLicensePlate } from '../api/dao/vehiclesDao';
import useAuth from '../context/useAuth';
import { brandModelYears } from '../data/vehicleData';
import {
  Container,
  Typography,
  Paper,
  Alert,
} from '@mui/material';
import VehicleForm from '../components/vehicle/VehicleForm';
import DeleteVehicleDialog from '../components/vehicle/DeleteVehicleDialog';

const VehicleDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isNewVehicle = !id;

  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    year: '',
    vin: '',
    licensePlate: '',
    engineType: '',
    engineVolume: '',
    color: '',
    mileage: ''
  });

  const [loading, setLoading] = useState(!isNewVehicle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState(null);

  const loadVehicleData = useCallback(async () => {
    try {
      const v = await getVehicleById(id);
      setFormData({
        brand: v.brand || v.make || '',
        model: v.model || '',
        year: v.year || '',
        vin: v.vin || '',
        licensePlate: v.licensePlate || '',
        engineType: '',
        engineVolume: '',
        color: v.color || '',
        mileage: v.mileage || ''
      });
      setLoading(false);
    } catch (err) {
      setError(t('errors.loadFailed', 'Помилка завантаження даних'));
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    if (!isNewVehicle) {
      loadVehicleData();
    }
  }, [id, isNewVehicle, loadVehicleData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (isNewVehicle) {
        const payload = {
          make: formData.brand,
          model: formData.model,
          year: formData.year,
          vin: formData.vin,
          licensePlate: formData.licensePlate,
          mileage: formData.mileage,
          color: formData.color
        };
        await createVehicle(payload, user?.id || null);
      } else {
        const payload = {
          make: formData.brand,
          model: formData.model,
          year: formData.year,
          vin: formData.vin,
          license_plate: formData.licensePlate,
          mileage: formData.mileage,
          color: formData.color
        };
        await updateVehicle(id, payload);
      }
      navigate('/vehicles');
    } catch (err) {
      setError(t('errors.saveFailed', 'Помилка збереження даних'));
      setSaving(false);
    }
  };

  const handleLookupByPlate = async () => {
    if (!formData.licensePlate) return;
    setLookupLoading(true);
    setLookupError(null);

    try {
      const registry = await lookupRegistryByLicensePlate(formData.licensePlate);
      const rawBrand = registry?.brand || registry?.make || '';
      const rawModel = registry?.model || '';
      const brandKey = rawBrand
        ? Object.keys(brandModelYears).find(
            (key) => key.toLowerCase() === String(rawBrand).toLowerCase()
          )
        : null;
      const modelKey =
        brandKey && rawModel
          ? Object.keys(brandModelYears[brandKey]).find(
              (key) => key.toLowerCase() === String(rawModel).toLowerCase()
            )
          : null;
      const registryYear = registry?.make_year || registry?.year || null;
      const licenseValue =
        registry?.n_reg_new ||
        registry?.license_plate_normalized ||
        formData.licensePlate;

      setFormData((prev) => {
        const next = { ...prev };
        if (brandKey) next.brand = brandKey;
        if (modelKey) next.model = modelKey;
        if (
          brandKey &&
          modelKey &&
          registryYear &&
          brandModelYears[brandKey][modelKey].includes(Number(registryYear))
        ) {
          next.year = Number(registryYear);
        }
        if (registry?.vin) next.vin = registry.vin;
        if (registry?.color) next.color = registry.color;
        if (licenseValue) next.licensePlate = licenseValue;
        return next;
      });
    } catch (err) {
      setLookupError(t('vehicle.lookupFailed', 'Не вдалося знайти дані за номером'));
    } finally {
      setLookupLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await removeVehicle(id);
      navigate('/vehicles');
    } catch (err) {
      setError(t('errors.deleteFailed', 'Помилка видалення'));
      setDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            {t('common.loading')}
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          {isNewVehicle ? t('vehicle.new', 'Новий автомобіль') : t('vehicle.edit', 'Редагування автомобіля')}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <VehicleForm
          formData={formData}
          handleChange={handleChange}
          handleSubmit={handleSubmit}
          saving={saving}
          isNewVehicle={isNewVehicle}
          onDeleteClick={() => setDeleteDialogOpen(true)}
          onLookupByPlate={handleLookupByPlate}
          lookupLoading={lookupLoading}
          lookupError={lookupError}
        />
      </Paper>

      <DeleteVehicleDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
      />
    </Container>
  );
};

export default VehicleDetails;
