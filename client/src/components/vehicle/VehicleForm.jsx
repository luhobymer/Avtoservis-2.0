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
  FormHelperText
} from '@mui/material';
import { Link } from 'react-router-dom';
import { brandModelYears } from '../../data/vehicleData';

const VehicleForm = ({ 
  formData, 
  handleChange, 
  handleSubmit, 
  saving, 
  isNewVehicle,
  onDeleteClick 
}) => {
  const { t } = useTranslation();
  const [errors, setErrors] = useState({});
  
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
    }
  };

  return (
    <Box component="form" onSubmit={onSubmit} sx={{ mt: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth error={!!errors.brand}>
            <InputLabel>{t('vehicle.brand', 'Марка')} *</InputLabel>
            <Select
              name="brand"
              value={formData.brand}
              label={t('vehicle.brand', 'Марка') + ' *'}
              onChange={handleChange}
              required
            >
              {Object.keys(brandModelYears).map((brand) => (
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
              name="model"
              value={formData.model}
              label={t('vehicle.model', 'Модель') + ' *'}
              onChange={handleChange}
              disabled={!formData.brand}
              required
            >
              {formData.brand && 
                Object.keys(brandModelYears[formData.brand]).map((model) => (
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
              name="year"
              value={formData.year}
              label={t('vehicle.year', 'Рік випуску') + ' *'}
              onChange={handleChange}
              disabled={!formData.brand || !formData.model}
              required
            >
              {formData.brand && formData.model && 
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
            label={t('vehicle.vin', 'VIN-код')}
            name="vin"
            value={formData.vin}
            onChange={handleChange}
            error={!!errors.vin}
            helperText={errors.vin || t('validation.vin_format')}
            inputProps={{ maxLength: 17 }}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label={t('vehicle.licensePlate', 'Державний номер')}
            name="licensePlate"
            value={formData.licensePlate}
            onChange={handleChange}
            error={!!errors.licensePlate}
            helperText={errors.licensePlate || t('validation.license_plate_format')}
            inputProps={{ maxLength: 10 }}
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
            >
              <MenuItem value="Бензин">{t('vehicle.engineTypes.petrol', 'Бензин')}</MenuItem>
              <MenuItem value="Дизель">{t('vehicle.engineTypes.diesel', 'Дизель')}</MenuItem>
              <MenuItem value="Гібрид">{t('vehicle.engineTypes.hybrid', 'Гібрид')}</MenuItem>
              <MenuItem value="Електро">{t('vehicle.engineTypes.electric', 'Електро')}</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label={t('vehicle.engineVolume', 'Обʼєм двигуна')}
            name="engineVolume"
            value={formData.engineVolume}
            onChange={handleChange}
            error={!!errors.engineVolume}
            helperText={errors.engineVolume || t('validation.engine_volume_format')}
            type="number"
            inputProps={{ 
              step: "0.1", 
              min: "0.1", 
              max: "10.0" 
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
              {['Чорний', 'Білий', 'Сірий', 'Синій', 'Червоний', 'Зелений', 'Жовтий', 'Коричневий', 'Сріблястий'].map((color) => (
                <MenuItem key={color} value={color}>
                  {t(`vehicle.colors.${color.toLowerCase()}`, color)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            label={t('vehicle.mileage', 'Пробіг (у кілометрах)')}
            name="mileage"
            type="number"
            value={formData.mileage}
            onChange={handleChange}
            error={!!errors.mileage}
            helperText={errors.mileage || t('validation.mileage_format')}
            inputProps={{ 
              min: "0", 
              max: "1000000" 
            }}
          />
        </Grid>

        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Box>
            <Button
              component={Link}
              to="/vehicles"
              variant="outlined"
              sx={{ mr: 2 }}
            >
              {t('common.cancel')}
            </Button>
            
            {!isNewVehicle && (
              <Button
                variant="outlined"
                color="error"
                onClick={onDeleteClick}
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
          >
            {saving ? <CircularProgress size={24} /> : t('common.save')}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
};

export default VehicleForm;
