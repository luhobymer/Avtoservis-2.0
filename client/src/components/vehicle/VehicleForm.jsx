import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Grid,
  TextField,
  Autocomplete,
  Button,
  Box,
  CircularProgress,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { Link } from 'react-router-dom';
import { brandModelYears, getVehicleSpecs } from '../../data/vehicleData';

const VehicleForm = ({ 
  formData, 
  handleChange, 
  handleSubmit, 
  saving, 
  isNewVehicle,
  onDeleteClick,
  onLookupByPlate,
  lookupLoading,
  lookupError,
  handlePhotoChange,
  photoPreview
}) => {
  const { t } = useTranslation();
  const [errors, setErrors] = useState({});
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [availableSpecs, setAvailableSpecs] = useState({
    engines: ['petrol', 'diesel', 'gas', 'hybrid', 'electric'],
    transmissions: ['manual', 'automatic', 'robot', 'variator']
  });
  const brands = Object.keys(brandModelYears).sort();
  const models = formData.brand && brandModelYears[formData.brand]
    ? Object.keys(brandModelYears[formData.brand]).sort()
    : [];
  const yearsBase = (formData.brand && formData.model && brandModelYears[formData.brand] && brandModelYears[formData.brand][formData.model])
    ? brandModelYears[formData.brand][formData.model]
    : [];
  const years = formData.year && !yearsBase.includes(Number(formData.year))
    ? [Number(formData.year), ...yearsBase]
    : yearsBase;
  const colors = ['black', 'white', 'gray', 'silver', 'red', 'blue', 'green', 'yellow', 'brown'];

  const emitChange = (name, value) => {
    handleChange({ target: { name, value } });
  };

  // Оновлення доступних специфікацій при зміні авто/року
  useEffect(() => {
    if (formData.brand && formData.model && formData.year) {
      const specs = getVehicleSpecs(formData.brand, formData.model, formData.year);
      setAvailableSpecs(specs);
    }
  }, [formData.brand, formData.model, formData.year]);
  
  // Валідація VIN-коду (17 символів, літери та цифри)
  const validateVin = (vin) => {
    if (!vin) return false;
    const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/i;
    return vinRegex.test(vin);
  };
  
  // Валідація державного номера (українського формату)
  const validateLicensePlate = (plate) => {
    if (!plate) return false;
    const normalized = String(plate).trim().replace(/[\s-]+/g, '');
    // Базова перевірка (може бути розширена для конкретного формату)
    const plateRegex = /^[А-ЯІЇЄҐA-Z]{2}\d{4}[А-ЯІЇЄҐA-Z]{2}$/i;
    return plateRegex.test(normalized);
  };
  
  // Валідація об'єму двигуна
  const validateEngineVolume = (volume) => {
    if (!volume) return false;
    const volumeValue = parseFloat(volume);
    return !isNaN(volumeValue) && volumeValue > 0 && volumeValue <= 10;
  };
  
  // Валідація пробігу
  const validateMileage = (mileage) => {
    if (!mileage) return false;
    const mileageValue = parseInt(mileage);
    return !isNaN(mileageValue) && mileageValue >= 0 && mileageValue <= 1000000;
  };
  
  // Функція для валідації всієї форми
  const validateForm = useCallback(() => {
    const newErrors = {};
    
    // Обов'язкові поля
    if (!formData.brand) newErrors.brand = t('validation.required_field');
    if (!formData.model) newErrors.model = t('validation.required_field');
    if (!formData.year) newErrors.year = t('validation.required_field');
    
    // Валідація VIN-коду
    if (formData.vin && !validateVin(formData.vin)) {
      newErrors.vin = t('validation.invalid_vin');
    }
    
    // Валідація державного номера
    if (formData.licensePlate && !validateLicensePlate(formData.licensePlate)) {
      newErrors.licensePlate = t('validation.invalid_license_plate');
    }
    
    // Валідація об'єму двигуна
    if (formData.engineVolume && !validateEngineVolume(formData.engineVolume)) {
      newErrors.engineVolume = t('validation.invalid_engine_volume');
    }
    
    // Валідація пробігу
    if (formData.mileage && !validateMileage(formData.mileage)) {
      newErrors.mileage = t('validation.invalid_mileage');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, t]);
  
  // Оновлюємо валідацію при зміні даних форми
  useEffect(() => {
    validateForm();
  }, [validateForm]);
  
  // Модифікуємо обробник відправки форми для валідації
  const onSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      handleSubmit(e);
      return;
    }
    const firstErrorKey = Object.keys(errors)[0] || Object.keys((() => {
      const nextErrors = {};
      if (!formData.brand) nextErrors.brand = true;
      if (!formData.model) nextErrors.model = true;
      if (!formData.year) nextErrors.year = true;
      if (formData.vin && !validateVin(formData.vin)) nextErrors.vin = true;
      if (formData.licensePlate && !validateLicensePlate(formData.licensePlate)) nextErrors.licensePlate = true;
      if (formData.engineVolume && !validateEngineVolume(formData.engineVolume)) nextErrors.engineVolume = true;
      if (formData.mileage && !validateMileage(formData.mileage)) nextErrors.mileage = true;
      return nextErrors;
    })())[0] || '';
    if (firstErrorKey) {
      const el = document.getElementById(firstErrorKey);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      if (el && typeof el.focus === 'function') {
        el.focus();
      }
    }
  };

  return (
    <Box component="form" onSubmit={onSubmit} sx={{ mt: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
           <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
             {photoPreview ? (
                <Box 
                  component="img" 
                  src={photoPreview} 
                  alt="Vehicle preview" 
                  sx={{ width: '100%', maxWidth: 300, height: 200, objectFit: 'cover', borderRadius: 2, mb: 2 }}
                />
             ) : (
                <Box sx={{ width: '100%', maxWidth: 300, height: 200, bgcolor: 'grey.200', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                   <Typography color="text.secondary">No photo</Typography>
                </Box>
             )}
             <Box sx={{ display: 'flex', gap: 1, flexDirection: isMobile ? 'column' : 'row', width: '100%', maxWidth: 300 }}>
               <Button variant="contained" component="label" fullWidth={isMobile}>
                 {t('vehicle.uploadPhoto', 'Завантажити фото')}
                 <input type="file" hidden accept="image/*" onChange={handlePhotoChange} />
               </Button>
               <Button variant="outlined" component="label" fullWidth={isMobile}>
                 {t('vehicle.takePhoto', 'Зробити фото')}
                 <input type="file" hidden accept="image/*" capture="environment" onChange={handlePhotoChange} />
               </Button>
             </Box>
           </Box>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>
            <TextField
              fullWidth
              id="licensePlate"
              label={t('vehicle.licensePlate', 'Державний номер')}
              name="licensePlate"
              value={formData.licensePlate}
              onChange={handleChange}
              error={!!errors.licensePlate || !!lookupError}
              helperText={
                errors.licensePlate ||
                lookupError ||
                t('validation.license_plate_format')
              }
              inputProps={{ maxLength: 10, autoCapitalize: 'characters', inputMode: 'text' }}
            />
            {onLookupByPlate && (
              <Button
                variant="outlined"
                sx={{ mt: isMobile ? 0 : 1, height: isMobile ? 48 : undefined }}
                onClick={onLookupByPlate}
                disabled={lookupLoading || !formData.licensePlate}
                fullWidth={isMobile}
                size={isMobile ? 'large' : 'medium'}
              >
                {lookupLoading ? <CircularProgress size={20} /> : t('vehicle.lookup', 'Знайти')}
              </Button>
            )}
          </Box>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Autocomplete
            options={brands}
            value={formData.brand || null}
            noOptionsText={t('common.noResults', 'Нічого не знайдено')}
            onChange={(_, value) => {
              emitChange('brand', value || '');
              emitChange('model', '');
              emitChange('year', '');
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                id="brand"
                label={t('vehicle.brand', 'Марка') + ' *'}
                required
                error={!!errors.brand}
                helperText={errors.brand}
                placeholder={t('common.search', 'Пошук')}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Autocomplete
            options={models}
            value={formData.model || null}
            disabled={!formData.brand}
            noOptionsText={t('common.noResults', 'Нічого не знайдено')}
            onChange={(_, value) => {
              emitChange('model', value || '');
              emitChange('year', '');
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                id="model"
                label={t('vehicle.model', 'Модель') + ' *'}
                required
                error={!!errors.model}
                helperText={errors.model}
                placeholder={t('common.search', 'Пошук')}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Autocomplete
            options={years}
            value={formData.year ? Number(formData.year) : null}
            disabled={!formData.brand || !formData.model}
            noOptionsText={t('common.noResults', 'Нічого не знайдено')}
            onChange={(_, value) => emitChange('year', value ? Number(value) : '')}
            renderInput={(params) => (
              <TextField
                {...params}
                id="year"
                label={t('vehicle.year', 'Рік випуску') + ' *'}
                required
                error={!!errors.year}
                helperText={errors.year}
                placeholder={t('common.search', 'Пошук')}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            id="vin"
            label={t('vehicle.vin', 'VIN-код')}
            name="vin"
            value={formData.vin}
            onChange={handleChange}
            error={!!errors.vin}
            helperText={errors.vin || t('validation.vin_format')}
            inputProps={{ maxLength: 17, autoCapitalize: 'characters', inputMode: 'text' }}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Autocomplete
            options={availableSpecs.engines}
            value={formData.engineType || null}
            disabled={!formData.year}
            noOptionsText={t('common.noResults', 'Нічого не знайдено')}
            onChange={(_, value) => emitChange('engineType', value || '')}
            getOptionLabel={(option) => t(`vehicle.engineTypes.${option}`, option)}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('vehicle.engineType', 'Тип двигуна')}
                placeholder={t('common.search', 'Пошук')}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Autocomplete
            options={availableSpecs.transmissions}
            value={formData.transmission || null}
            disabled={!formData.year}
            noOptionsText={t('common.noResults', 'Нічого не знайдено')}
            onChange={(_, value) => emitChange('transmission', value || '')}
            getOptionLabel={(option) => t(`vehicle.transmissionTypes.${option}`, option)}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('vehicle.transmission', 'Коробка передач')}
                placeholder={t('common.search', 'Пошук')}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            id="engineVolume"
            label={t('vehicle.engineVolume', 'Обʼєм двигуна')}
            name="engineVolume"
            value={formData.engineVolume}
            onChange={handleChange}
            error={!!errors.engineVolume}
            helperText={errors.engineVolume || t('validation.engine_volume_format')}
            type="number"
            disabled={!formData.engineType || formData.engineType === 'electric'}
            inputProps={{ 
              step: "0.1", 
              min: "0.1", 
              max: "10.0",
              inputMode: 'decimal'
            }}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Autocomplete
            options={colors}
            value={formData.color || null}
            noOptionsText={t('common.noResults', 'Нічого не знайдено')}
            onChange={(_, value) => emitChange('color', value || '')}
            getOptionLabel={(option) => t(`vehicle.colors.${option}`, option)}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('vehicle.color', 'Забарвлення')}
                placeholder={t('common.search', 'Пошук')}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            id="mileage"
            label={t('vehicle.mileage', 'Пробіг (у кілометрах)')}
            name="mileage"
            type="number"
            value={formData.mileage}
            onChange={handleChange}
            error={!!errors.mileage}
            helperText={errors.mileage || t('validation.mileage_format')}
            inputProps={{ 
              min: "0", 
              max: "1000000",
              inputMode: 'numeric',
              pattern: '[0-9]*'
            }}
          />
        </Grid>

        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, flexDirection: isMobile ? 'column' : 'row' }}>
            <Button
              component={Link}
              to="/vehicles"
              variant="outlined"
              size="large"
              fullWidth={isMobile}
            >
              {t('common.cancel')}
            </Button>
            
            {!isNewVehicle && (
              <Button
                variant="outlined"
                color="error"
                onClick={onDeleteClick}
                size="large"
                fullWidth={isMobile}
              >
                {t('common.delete')}
              </Button>
            )}
          </Box>
          
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={saving || Object.keys(errors).length > 0}
            size="large"
            fullWidth={isMobile}
          >
            {saving ? <CircularProgress size={24} /> : t('common.save')}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default VehicleForm;
