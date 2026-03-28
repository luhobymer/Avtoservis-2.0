import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Box,
  CircularProgress,
  FormHelperText,
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
  plateOcrLoading,
  plateOcrDebugEnabled,
  plateOcrDebug,
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
    // Базова перевірка (може бути розширена для конкретного формату)
    const plateRegex = /^[А-ЯІЇЄҐA-Z]{2}\d{4}[А-ЯІЇЄҐA-Z]{2}$/i;
    return plateRegex.test(plate);
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
                (plateOcrLoading
                  ? t('vehicle.plateRecognizing', 'Розпізнавання номера…')
                  : t('validation.license_plate_format'))
              }
              inputProps={{ maxLength: 10, autoCapitalize: 'characters', inputMode: 'text' }}
            />
            {onLookupByPlate && (
              <Button
                variant="outlined"
                sx={{ mt: isMobile ? 0 : 1, height: isMobile ? 48 : undefined }}
                onClick={onLookupByPlate}
                disabled={lookupLoading || plateOcrLoading || !formData.licensePlate}
                fullWidth={isMobile}
                size={isMobile ? 'large' : 'medium'}
              >
                {lookupLoading ? <CircularProgress size={20} /> : t('vehicle.lookup', 'Знайти')}
              </Button>
            )}
          </Box>
          {plateOcrDebugEnabled && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                OCR Debug
              </Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: 'rgba(255,255,255,0.06)',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: 11,
                  lineHeight: 1.25,
                }}
              >
                {plateOcrDebug ? JSON.stringify(plateOcrDebug, null, 2) : 'no debug payload'}
              </Box>
            </Box>
          )}
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth error={!!errors.brand}>
            <InputLabel>{t('vehicle.brand', 'Марка')} *</InputLabel>
            <Select
              id="brand"
              name="brand"
              value={formData.brand}
              label={t('vehicle.brand', 'Марка') + ' *'}
              onChange={handleChange}
              required
            >
              {Object.keys(brandModelYears).sort().map((brand) => (
                <MenuItem key={brand} value={brand}>{brand}</MenuItem>
              ))}
            </Select>
            {errors.brand && <FormHelperText>{errors.brand}</FormHelperText>}
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth error={!!errors.model}>
            <InputLabel>{t('vehicle.model', 'Модель')} *</InputLabel>
            <Select
              id="model"
              name="model"
              value={formData.model}
              label={t('vehicle.model', 'Модель') + ' *'}
              onChange={handleChange}
              disabled={!formData.brand}
              required
            >
              {formData.brand && brandModelYears[formData.brand] && 
                Object.keys(brandModelYears[formData.brand]).sort().map((model) => (
                  <MenuItem key={model} value={model}>{model}</MenuItem>
                ))
              }
            </Select>
            {errors.model && <FormHelperText>{errors.model}</FormHelperText>}
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth error={!!errors.year}>
            <InputLabel>{t('vehicle.year', 'Рік випуску')} *</InputLabel>
            <Select
              id="year"
              name="year"
              value={formData.year}
              label={t('vehicle.year', 'Рік випуску') + ' *'}
              onChange={handleChange}
              disabled={!formData.brand || !formData.model}
              required
            >
              {formData.brand && formData.model && brandModelYears[formData.brand] && brandModelYears[formData.brand][formData.model] &&
                brandModelYears[formData.brand][formData.model].map((year) => (
                  <MenuItem key={year} value={year}>{year}</MenuItem>
                ))
              }
            </Select>
            {errors.year && <FormHelperText>{errors.year}</FormHelperText>}
          </FormControl>
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
          <FormControl fullWidth>
            <InputLabel>{t('vehicle.engineType', 'Тип двигуна')}</InputLabel>
            <Select
              name="engineType"
              value={formData.engineType}
              label={t('vehicle.engineType', 'Тип двигуна')}
              onChange={handleChange}
              disabled={!formData.year}
            >
              {availableSpecs.engines.map((type) => (
                <MenuItem key={type} value={type}>
                  {t(`vehicle.engineTypes.${type}`, type)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel>{t('vehicle.transmission', 'Коробка передач')}</InputLabel>
            <Select
              name="transmission"
              value={formData.transmission || ''}
              label={t('vehicle.transmission', 'Коробка передач')}
              onChange={handleChange}
              disabled={!formData.year}
            >
              {availableSpecs.transmissions.map((type) => (
                <MenuItem key={type} value={type}>
                  {t(`vehicle.transmissionTypes.${type}`, type)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
          <FormControl fullWidth>
            <InputLabel>{t('vehicle.color', 'Забарвлення')}</InputLabel>
            <Select
              name="color"
              value={formData.color}
              label={t('vehicle.color', 'Забарвлення')}
              onChange={handleChange}
            >
              {['black', 'white', 'gray', 'silver', 'red', 'blue', 'green', 'yellow', 'brown'].map((color) => (
                <MenuItem key={color} value={color}>
                  {t(`vehicle.colors.${color}`, color)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
