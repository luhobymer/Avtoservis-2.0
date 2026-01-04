import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as vehiclesDao from '../api/dao/vehiclesDao';
import * as serviceRecordsDao from '../api/dao/serviceRecordsDao';
import {
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Box,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

const ServiceRecordDetails = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNewRecord = id === 'new';
  
  const [loading, setLoading] = useState(!isNewRecord);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  
  const [formData, setFormData] = useState({
    vehicle_vin: '',
    serviceType: '',
    description: '',
    mileage: '',
    serviceDate: new Date(),
    performedBy: '',
    cost: '',
    parts: []
  });
  
  // Додаємо стан для відстеження, чи завантажено автомобілі
  const [vehiclesLoaded, setVehiclesLoaded] = useState(false);

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const list = await vehiclesDao.list();
        setVehicles(list.map(v => ({
          id: v.id,
          vin: v.vin,
          make: v.make,
          model: v.model,
          licensePlate: v.licensePlate
        })));
        setVehiclesLoaded(true);
        if (isNewRecord) {
          const urlParams = new URLSearchParams(window.location.search);
          const vehicle_vin = urlParams.get('vehicle_vin');
          if (vehicle_vin) {
            const vehicleExists = list.some(v => v.vin === vehicle_vin);
            setFormData(prev => ({ ...prev, vehicle_vin }));
            if (!vehicleExists) {
              console.warn('[WARNING] Автомобіль з VIN не знайдено в списку');
            }
          }
        }
      } catch (err) {
        setError(err.message || t('errors.failedToLoadVehicles', 'Не вдалося завантажити автомобілі'));
      }
    };

    const fetchServiceRecord = async () => {
      if (isNewRecord) return;
      try {
        const record = await serviceRecordsDao.getById(id);
        const vehiclesList = await vehiclesDao.list();
        setVehicles(vehiclesList);
        const targetVehicle = vehiclesList.find(v => v.id === (record.vehicleId || record.VehicleId));
        setFormData({
          vehicle_vin: targetVehicle?.vin || '',
          serviceType: record.serviceName || record.serviceType || '',
          description: record.description || '',
          mileage: record.mileage || '',
          serviceDate: record.serviceDate ? new Date(record.serviceDate) : new Date(),
          performedBy: record.performedBy || '',
          cost: record.cost || '',
          parts: record.parts || []
        });
      } catch (err) {
        setError(err.message || t('errors.failedToLoadServiceRecord', 'Не вдалося завантажити запис про обслуговування'));
      } finally {
        setLoading(false);
      }
    };

    fetchVehicles();
    fetchServiceRecord();
  }, [id, isNewRecord, t]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleDateChange = (date) => {
    setFormData({
      ...formData,
      serviceDate: date
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Перевіряємо, чи вибрано автомобіль
      if (!formData.vehicle_vin) {
        setError(t('errors.vehicleRequired', 'Необхідно вибрати автомобіль'));
        setSaving(false);
        return;
      }

      // Перевіряємо, чи існує автомобіль у списку
      const vehicleExists = vehicles.some(v => v.vin === formData.vehicle_vin);
      if (!vehicleExists) {
        console.warn('[WARNING] Спроба зберегти запис з неіснуючим VIN:', formData.vehicle_vin);
      }

      const payload = {
        ...formData,
        vehicle_vin: formData.vehicle_vin,
        serviceDate: formData.serviceDate.toISOString(),
        mileage: parseInt(formData.mileage, 10) || 0,
        cost: parseFloat(formData.cost) || 0
      };

      console.log('[DEBUG] Відправка даних на сервер:', payload);

      const vehicle = vehicles.find(v => v.vin === formData.vehicle_vin);
      const servicePayload = {
        vehicle_id: vehicle?.id || null,
        service_type: formData.serviceType,
        description: formData.description,
        mileage: parseInt(formData.mileage, 10) || 0,
        service_date: formData.serviceDate.toISOString(),
        cost: parseFloat(formData.cost) || 0
      };
      if (isNewRecord) {
        await serviceRecordsDao.create(servicePayload);
      } else {
        await serviceRecordsDao.update(id, servicePayload);
      }

      navigate('/service-records');
    } catch (err) {
      console.error('[ERROR] Помилка збереження запису:', err.response?.data || err);
      setError(err.response?.data?.msg || t('errors.failedToSaveServiceRecord', 'Не вдалося зберегти запис про обслуговування'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          {isNewRecord ? t('serviceRecord.add') : t('common.edit')}
        </Typography>
        <Divider sx={{ mb: 3 }} />
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {vehiclesLoaded && vehicles.length === 0 && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            {t('vehicle.noVehicles', 'У вас немає доданих автомобілів. Спочатку додайте автомобіль.')}
          </Alert>
        )}
        
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel id="vehicle-label">{t('vehicle.title')}</InputLabel>
                <Select
                  labelId="vehicle-label"
                  name="vehicle_vin"
                  value={formData.vehicle_vin}
                  onChange={handleChange}
                  label={t('vehicle.title')}
                  disabled={!isNewRecord}
                  error={formData.vehicle_vin && !vehicles.some(v => v.vin === formData.vehicle_vin)}
                >
                  {formData.vehicle_vin && !vehicles.some(v => v.vin === formData.vehicle_vin) && (
                    <MenuItem disabled value={formData.vehicle_vin} style={{color: 'red'}}>
                      {t('vehicle.notFound', 'Автомобіль не знайдено')}
                    </MenuItem>
                  )}
                  {vehicles.map((vehicle) => (
                    <MenuItem key={vehicle.vin} value={vehicle.vin}>
                      {vehicle.make || vehicle.brand} {vehicle.model} ({vehicle.licensePlate || vehicle.license_plate})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label={t('serviceRecord.serviceType')}
                name="serviceType"
                value={formData.serviceType}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label={t('serviceRecord.serviceDate')}
                  value={formData.serviceDate}
                  onChange={handleDateChange}
                  renderInput={(params) => <TextField {...params} fullWidth required />}
                />
              </LocalizationProvider>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label={t('serviceRecord.mileage')}
                name="mileage"
                type="number"
                value={formData.mileage}
                onChange={handleChange}
                InputProps={{
                  endAdornment: <InputAdornment position="end">km</InputAdornment>,
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label={t('serviceRecord.cost')}
                name="cost"
                type="number"
                value={formData.cost}
                onChange={handleChange}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label={t('serviceRecord.performedBy')}
                name="performedBy"
                value={formData.performedBy}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                multiline
                rows={4}
                label={t('serviceRecord.description')}
                name="description"
                value={formData.description}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button
                component={Link}
                to="/service-records"
                variant="outlined"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={saving}
              >
                {saving ? <CircularProgress size={24} /> : t('common.save')}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Container>
  );
};

export default ServiceRecordDetails;
