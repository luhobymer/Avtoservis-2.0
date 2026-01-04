import React, { useState, useEffect } from 'react';
import { Alert } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import { getById as getAppointmentById, create as createAppointment, update as updateAppointment } from '../api/dao/appointmentsDao';
import { list as listVehicles } from '../api/dao/vehiclesDao';
import {
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  CircularProgress,
  Box,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';
import { DateTimePicker, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

import Snackbar from '@mui/material/Snackbar';

const AppointmentDetails = ({ isNew }) => {
  
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNewAppointment = isNew || id === 'new';
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(!isNewAppointment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    vehicle_vin: '',
    serviceType: '',
    description: '',
    status: 'scheduled',
    scheduledDate: new Date(new Date().setHours(new Date().getHours() + 1)),
    estimatedCompletionDate: new Date(new Date().setDate(new Date().getDate() + 1)),
    actualCompletionDate: null,
    notes: ''
  });

  useEffect(() => {
    const fetchVehicles = async () => {
  try {
    const rows = await listVehicles();
    setVehicles(rows);
    // If it's a new appointment and vehicle_vin is in query params, set it
    if (isNewAppointment) {
      const urlParams = new URLSearchParams(window.location.search);
      const vehicleVin = urlParams.get('vehicle_vin') || urlParams.get('vehicleId');
      if (vehicleVin) {
        const found = rows.find(v => v.vin === vehicleVin || v.licensePlate === vehicleVin || v.license_plate === vehicleVin);
        setFormData(prev => ({
          ...prev,
          vehicle_vin: found ? found.vin : ''
        }));
      }
    }
  } catch (err) {
    setError(err.message || t('errors.failedToLoadVehicles', 'Не вдалося завантажити авто'));
  }
};

    const fetchAppointment = async () => {
  if (isNewAppointment) {
    setLoading(false);
    return;
  }
  try {
    const appointment = await getAppointmentById(id);
    setFormData({
      vehicle_vin: appointment.vehicle_vin || '',
      serviceType: appointment.serviceType || '',
      description: appointment.description || '',
      status: appointment.status || 'scheduled',
      scheduledDate: appointment.scheduledDate ? new Date(appointment.scheduledDate) : new Date(),
      estimatedCompletionDate: appointment.estimatedCompletionDate ? new Date(appointment.estimatedCompletionDate) : new Date(new Date().setDate(new Date().getDate() + 1)),
      actualCompletionDate: appointment.actualCompletionDate ? new Date(appointment.actualCompletionDate) : null,
      notes: appointment.notes || ''
    });
  } catch (err) {
    setError(err.message || t('errors.failedToLoadAppointment', 'Не вдалося завантажити запис'));
  } finally {
    setLoading(false);
  }
};

    fetchVehicles();
    fetchAppointment();
  }, [id, isNewAppointment, t]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleDateChange = (name, date) => {
    setFormData({
      ...formData,
      [name]: date
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (!formData.scheduledDate) {
        throw new Error(t('errors.invalidScheduledDate', 'Некоректна запланована дата'));
      }
      if (!formData.estimatedCompletionDate) {
        throw new Error(t('errors.invalidEstimatedDate', 'Некоректна орієнтовна дата завершення'));
      }
      const scheduled = new Date(formData.scheduledDate);
      const estimated = new Date(formData.estimatedCompletionDate);
      const actual = formData.actualCompletionDate ? new Date(formData.actualCompletionDate) : null;
      if (estimated < scheduled) {
        throw new Error(t('errors.estimatedBeforeScheduled', 'Орієнтовна дата не може бути раніше запланованої'));
      }
      if (formData.status === 'completed' && !actual) {
        throw new Error(t('errors.actualRequiredForCompleted', 'Для статусу "Завершено" вкажіть фактичну дату'));
      }
      if (actual && actual < scheduled) {
        throw new Error(t('errors.actualBeforeScheduled', 'Фактична дата не може бути раніше запланованої'));
      }
      const payload = {
        user_id: user?.id || null,
        service_type: formData.serviceType,
        scheduled_time: formData.scheduledDate.toISOString(),
        vehicle_vin: formData.vehicle_vin,
        status: formData.status,
        description: formData.description || '',
        notes: formData.notes || '',
        estimated_completion_date: formData.estimatedCompletionDate ? new Date(formData.estimatedCompletionDate).toISOString() : null,
        actual_completion_date: formData.actualCompletionDate ? new Date(formData.actualCompletionDate).toISOString() : null
      };
      if (isNewAppointment) {
        if (!payload.user_id) throw new Error('User not authenticated');
        await createAppointment(payload);
      } else {
        await updateAppointment(id, payload);
      }
      setSuccess(true);
      setTimeout(() => navigate('/appointments'), 1500);
    } catch (err) {
      setError(err.message || t('errors.failedToSaveAppointment', 'Не вдалося зберегти запис'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await updateAppointment(id, { status: 'cancelled' });
      navigate('/appointments');
    } catch (err) {
      setError(err.message || t('errors.failedToDeleteAppointment', 'Не вдалося видалити запис'));
      setDeleteDialogOpen(false);
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
    <>
      <Snackbar
        open={success}
        autoHideDuration={1500}
        onClose={() => setSuccess(false)}
        message={t('appointment.success', 'Запис успішно збережено')}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
      <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom>
            {isNewAppointment ? t('appointment.schedule') : t('common.edit')}
          </Typography>
          <Divider sx={{ mb: 3 }} />
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel id="vehicle-label">{t('vehicle.title')}</InputLabel>
                  {vehicles.length === 0 ? (
                    <Alert severity="warning" sx={{ mb: 2 }}>{t('errors.noVehicles', 'Автомобілі не знайдено. Додайте авто у профілі.')}</Alert>
                  ) : (
                    <Select
                      labelId="vehicle-label"
                      name="vehicle_vin"
                      value={formData.vehicle_vin}
                      onChange={handleChange}
                      label={t('vehicle.title')}
                      disabled={!isNewAppointment}
                      required
                    >
                      {vehicles.map((vehicle) => (
                        <MenuItem key={vehicle.vin} value={vehicle.vin}>
                          {vehicle.brand || vehicle.make} {vehicle.model} ({vehicle.licensePlate || vehicle.license_plate || vehicle.vin})
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel id="service-type-label">{t('appointment.serviceType')}</InputLabel>
                  <Select
                    labelId="service-type-label"
                    name="serviceType"
                    value={formData.serviceType || ''}
                    onChange={handleChange}
                    label={t('appointment.serviceType')}
                  >
                    {[
                      'air_conditioning',
                      'alignment',
                      'battery_check',
                      'brake_service',
                      'cooling_system',
                      'electrical',
                      'engine_diagnostics',
                      'exhaust',
                      'filter_replacement',
                      'fluid_change',
                      'inspection',
                      'lights',
                      'oil_change',
                      'suspension',
                      'tire_rotation',
                      'transmission_service',
                      'wipers',
                      'other'
                    ].sort((a, b) => t(`serviceTypes.${a}`).localeCompare(t(`serviceTypes.${b}`))).map(type => (
                      <MenuItem key={type} value={type}>
                        {t(`serviceTypes.${type}`)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required>
                  <InputLabel id="status-label">{t('appointment.status')}</InputLabel>
                  <Select
                    labelId="status-label"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    label={t('appointment.status')}
                  >
                    <MenuItem value="scheduled">{t('appointment.statuses.scheduled')}</MenuItem>
                    <MenuItem value="in-progress">{t('appointment.statuses.in-progress')}</MenuItem>
                    <MenuItem value="completed">{t('appointment.statuses.completed')}</MenuItem>
                    <MenuItem value="cancelled">{t('appointment.statuses.cancelled')}</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DateTimePicker
                    label={t('appointment.scheduledDate')}
                    value={formData.scheduledDate}
                    onChange={(date) => handleDateChange('scheduledDate', date)}
                    disablePast
                    renderInput={(params) => <TextField {...params} fullWidth required />}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={12} sm={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label={t('appointment.estimatedCompletionDate')}
                    value={formData.estimatedCompletionDate}
                    onChange={(date) => handleDateChange('estimatedCompletionDate', date)}
                    disablePast
                    minDate={formData.scheduledDate}
                    renderInput={(params) => <TextField {...params} fullWidth required />}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={12} sm={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DateTimePicker
                    label={t('appointment.actualCompletionDate')}
                    value={formData.actualCompletionDate}
                    onChange={(date) => handleDateChange('actualCompletionDate', date)}
                    minDateTime={formData.scheduledDate}
                    renderInput={(params) => <TextField {...params} fullWidth />}
                  />
                </LocalizationProvider>
              </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('appointment.description')}
                name="description"
                value={formData.description}
                onChange={handleChange}
                multiline
                rows={3}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('appointment.notes')}
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                multiline
                rows={4}
                margin="normal"
              />
            </Grid>

            {/* ...інші поля Grid... */}

            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  sx={{ flexGrow: 1 }}
                  disabled={saving}
                >
                  {saving ? <CircularProgress size={24} /> : t('common.save', 'Записатись')}
                </Button>
                {!isNewAppointment && (
                  <Button
                    type="button"
                    variant="outlined"
                    color="error"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    {t('appointment.cancelAppointment', 'Скасувати запис')}
                  </Button>
                )}
              </Box>
            </Grid>
          </Box>
        </Paper>
        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>{t('common.confirm')}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {t('appointment.confirmDelete', 'Ви впевнені, що хочете скасувати цей запис?')}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleDelete} color="error" autoFocus>
              {t('common.delete')}
            </Button>
          </DialogActions>
        </Dialog>
    </>
  );
}

export default AppointmentDetails;
