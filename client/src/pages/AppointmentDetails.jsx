import React, { useState, useEffect, useMemo } from 'react';
import { Alert } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import { getById as getAppointmentById, create as createAppointment, update as updateAppointment } from '../api/dao/appointmentsDao';
import { list as listVehicles, listForUser as listVehiclesForUser } from '../api/dao/vehiclesDao';
import { getCurrent as getCurrentMechanic, list as listMechanics } from '../api/dao/mechanicsDao';
import { listMechanicServices } from '../api/dao/mechanicServicesDao';
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
  DialogTitle,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import { DateTimePicker, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

import Snackbar from '@mui/material/Snackbar';
import AppointmentChat from '../components/chat/AppointmentChat';

const AppointmentDetails = ({ isNew }) => {
  
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNewAppointment = isNew || id === 'new';
  const { user } = useAuth();
  const [hideMechanicSelection, setHideMechanicSelection] = useState(false);

  const formatServicePrice = (service) => {
    if (service?.price_text) return String(service.price_text);
    if (service?.price != null) return `${service.price} грн`;
    return '';
  };

  const formatServiceDuration = (service) => {
    if (service?.duration_text) return String(service.duration_text);
    if (service?.duration != null) return `${service.duration} хв`;
    return '';
  };
  
  const [loading, setLoading] = useState(!isNewAppointment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [services, setServices] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [success, setSuccess] = useState(false);
  const [appointmentUserId, setAppointmentUserId] = useState('');

  const [mechanicCity, setMechanicCity] = useState('');
  const [clientId, setClientId] = useState('');
  const [clients, setClients] = useState([]);
  
  const [formData, setFormData] = useState({
    vehicle_vin: '',
    service_id: null,
    mechanic_id: null,
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
        const isClientUser = String(user?.role || '').toLowerCase() === 'client';
        const rows =
          isNewAppointment && !isClientUser
            ? clientId
              ? await listVehiclesForUser(clientId)
              : []
            : await listVehicles();
        setVehicles(rows);
        if (isNewAppointment) {
          const urlParams = new URLSearchParams(window.location.search);
          const vehicleVin = urlParams.get('vehicle_vin') || urlParams.get('vehicleId');
          if (vehicleVin) {
            const found = rows.find(
              (v) =>
                v.vin === vehicleVin ||
                v.licensePlate === vehicleVin ||
                v.license_plate === vehicleVin
            );
            if (found) {
                setFormData((prev) => ({
                  ...prev,
                  vehicle_vin: found.vin
                }));
            }
          } else if (rows.length > 0) {
             setFormData((prev) => ({
                  ...prev,
                  vehicle_vin: rows[0].vin
             }));
          }
        }
      } catch (err) {
        setError(err.message || t('errors.failedToLoadVehicles', 'Не вдалося завантажити авто'));
      }
    };

    const fetchClients = async () => {
      try {
        const isClientUser = String(user?.role || '').toLowerCase() === 'client';
        if (!isNewAppointment || isClientUser) return;
        const token = localStorage.getItem('auth_token');
        if (!token) return;
        const res = await fetch('/api/relationships/clients', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        const mapped = (data || [])
          .filter((c) => String(c?.status || '') !== 'rejected')
          .map((c) => ({
            id: c.client_id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            status: c.status
          }))
          .filter((c) => c.id);
        setClients(mapped);
        if (!clientId && mapped.length > 0) {
          setClientId(String(mapped[0].id));
        }
      } catch (err) {
        void err;
        setClients([]);
      }
    };

    const fetchMechanics = async () => {
      try {
        // If client, fetch "My Mechanics" instead of all mechanics
        // But if user wants to search by city, we might want to support that?
        // The requirement says: "dropdown menu showing confirmed mechanics"
        const role = String(user?.role || '').toLowerCase();
        if (role === 'client') {
             setHideMechanicSelection(false);
             const token = localStorage.getItem('auth_token');
             const res = await fetch('/api/relationships/mechanics', {
               headers: { Authorization: `Bearer ${token}` }
             });
             const data = await res.json();
             // Filter only accepted mechanics
             const accepted = data.filter(m => m.status === 'accepted').map(m => ({
                 id: m.mechanic_id, // Map from relationship structure
                 fullName: m.name,
                 ...m
             }));
             setMechanics(accepted);
        } else if (role === 'master' || role === 'mechanic' || role === 'admin') {
          try {
            const current = await getCurrentMechanic();
            if (current?.id) {
              setMechanics([current]);
              setHideMechanicSelection(true);
              setFormData((prev) => ({
                ...prev,
                mechanic_id: String(current.id),
                service_id: null
              }));
              return;
            }
          } catch (_) {
            void _;
          }
          const rows = await listMechanics();
          setMechanics(rows);
          setHideMechanicSelection(false);
        } else {
          const city = mechanicCity || (isNewAppointment ? user?.city : '') || '';
          const rows = await listMechanics(city ? { city } : undefined);
          setMechanics(rows);
          setHideMechanicSelection(false);
        }
      } catch (err) {
        console.error(err);
        // Fallback to empty or listMechanics if relationship api fails?
        // For now just empty
        setMechanics([]);
        setHideMechanicSelection(false);
      }
    };

    const fetchAppointment = async () => {
  if (isNewAppointment) {
    setLoading(false);
    return;
  }
  try {
    const appointment = await getAppointmentById(id);
    setAppointmentUserId(appointment?.UserId || appointment?.user_id || '');
    setFormData({
      vehicle_vin: appointment.vehicle_vin || '',
      service_id: appointment.service_id || appointment.serviceId || null,
      mechanic_id: appointment.mechanic_id || null,
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

    fetchClients();
    fetchVehicles();
    fetchMechanics();
    fetchAppointment();
  }, [id, isNewAppointment, t, mechanicCity, user?.city, user?.role, clientId]);

  useEffect(() => {
    const run = async () => {
      const mechanicId = formData.mechanic_id;
      if (!mechanicId) {
        setServices([]);
        return;
      }

      try {
        const rows = await listMechanicServices(mechanicId, { enabled: true });
        setServices(rows);
      } catch (err) {
        setServices([]);
        setError(err?.message || t('errors.failedToLoadServices', 'Не вдалося завантажити послуги'));
      }
    };
    run();
  }, [formData.mechanic_id, t]);

  useEffect(() => {
    if (!mechanics || mechanics.length === 0) return;
    const list = mechanics || [];
    const current = String(formData.mechanic_id || '');
    const hasCurrent = current && list.some((m) => String(m?.id || '') === current);
    if (hasCurrent) return;
    const firstId = list[0]?.id ? String(list[0].id) : '';
    if (!firstId) return;
    setFormData((prev) => ({
      ...prev,
      mechanic_id: firstId,
      service_id: null
    }));
  }, [mechanics, formData.mechanic_id]);

  useEffect(() => {
    if (!isNewAppointment) return;
    if (mechanicCity) return;
    const nextCity = (user?.city || '').trim();
    if (nextCity) {
      setMechanicCity(nextCity);
    }
  }, [isNewAppointment, mechanicCity, user?.city]);

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

  const handleServiceChange = (e) => {
    const { value } = e.target;
    const selected = services.find((s) => s.id === value);
    setFormData((prev) => ({
      ...prev,
      service_id: value || null,
      serviceType: selected ? selected.name || '' : prev.serviceType
    }));
  };

  const handleMechanicChange = (e) => {
    const { value } = e.target;
    setFormData((prev) => ({
      ...prev,
      mechanic_id: value || null,
      service_id: null
    }));
  };

  const handleMechanicCityChange = (e) => {
    setMechanicCity(e.target.value);
    setFormData((prev) => ({
      ...prev,
      mechanic_id: null
    }));
  };

  const handleClientChange = (e) => {
    const next = e.target.value;
    setClientId(next);
    setFormData((prev) => ({
      ...prev,
      vehicle_vin: ''
    }));
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
      if (!formData.service_id) {
        throw new Error(t('errors.serviceRequired', 'Оберіть послугу'));
      }
      if (!formData.mechanic_id) {
        throw new Error(t('errors.mechanicRequired', 'Оберіть механіка'));
      }
      const selectedService = services.find((s) => s.id === formData.service_id);
      const serviceTypeText = formData.serviceType || (selectedService ? selectedService.name || '' : '');
      const isClientUser = String(user?.role || '').toLowerCase() === 'client';
      const payload = {
        user_id: isClientUser ? (user?.id || null) : (clientId || null),
        service_id: formData.service_id || null,
        mechanic_id: formData.mechanic_id || null,
        service_type: serviceTypeText,
        scheduled_time: formData.scheduledDate.toISOString(),
        vehicle_vin: formData.vehicle_vin,
        status: formData.status,
        description: formData.description || '',
        notes: formData.notes || '',
        estimated_completion_date: formData.estimatedCompletionDate ? new Date(formData.estimatedCompletionDate).toISOString() : null,
        actual_completion_date: formData.actualCompletionDate ? new Date(formData.actualCompletionDate).toISOString() : null
      };
      if (isNewAppointment) {
        if (!payload.user_id) {
          throw new Error(
            isClientUser
              ? t('errors.unauthorized', 'Будь ласка, увійдіть в систему для перегляду даних')
              : t('errors.clientRequired', 'Оберіть клієнта')
          );
        }
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


  const getStatusStep = (status) => {
    switch (status) {
      case 'scheduled': return 0;
      case 'in-progress': return 1;
      case 'completed': return 2;
      case 'cancelled': return 3;
      default: return 0;
    }
  };

  const steps = [
    t('appointment.statuses.scheduled'),
    t('appointment.statuses.in-progress'),
    t('appointment.statuses.completed')
  ];

  const filteredServices = useMemo(() => services || [], [services]);

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
          
          {!isNewAppointment && formData.status !== 'cancelled' && (
            <Box sx={{ width: '100%', mb: 4 }}>
              <Stepper activeStep={getStatusStep(formData.status)} alternativeLabel>
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Box>
          )}

          <Divider sx={{ mb: 3 }} />
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {isNewAppointment && String(user?.role || '').toLowerCase() !== 'client' ? (
                <Grid item xs={12}>
                  <FormControl fullWidth required>
                    <InputLabel id="client-label">{t('clients.title', 'Клієнт')}</InputLabel>
                    {clients.length === 0 ? (
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        {t('errors.noClients', 'Клієнти не знайдені')}
                      </Alert>
                    ) : (
                      <Select
                        labelId="client-label"
                        value={clientId}
                        onChange={handleClientChange}
                        label={t('clients.title', 'Клієнт')}
                        required
                      >
                        {clients.map((c) => (
                          <MenuItem key={c.id} value={c.id}>
                            {c.name || c.email || c.id}
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  </FormControl>
                </Grid>
              ) : null}
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
              {!hideMechanicSelection ? (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label={t('auth.city', 'Місто')}
                    value={mechanicCity}
                    onChange={handleMechanicCityChange}
                    placeholder={t('auth.city', 'Місто')}
                  />
                </Grid>
              ) : null}

              {hideMechanicSelection ? (
                mechanics.length === 0 ? (
                  <Grid item xs={12}>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      {t('errors.noMechanics', 'Механіки не знайдені')}
                    </Alert>
                  </Grid>
                ) : null
              ) : (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required>
                    <InputLabel id="mechanic-label">{t('appointment.mechanic', 'Механік')}</InputLabel>
                    <Select
                      labelId="mechanic-label"
                      name="mechanic_id"
                      value={formData.mechanic_id || ''}
                      onChange={handleMechanicChange}
                      label={t('appointment.mechanic', 'Механік')}
                    >
                      {mechanics.map((mechanic) => (
                        <MenuItem key={mechanic.id} value={mechanic.id}>
                          {mechanic.fullName ||
                            [mechanic.first_name, mechanic.last_name].filter(Boolean).join(' ') ||
                            mechanic.email ||
                            mechanic.id}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth required disabled={!formData.mechanic_id || services.length === 0}>
                  <InputLabel id="service-type-label">{t('appointment.serviceType')}</InputLabel>
                  {formData.mechanic_id && services.length === 0 ? (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      {t('errors.noServicesForMechanic', 'Для цього механіка немає увімкнених послуг')}
                    </Alert>
                  ) : (
                    <Select
                      labelId="service-type-label"
                      name="service_id"
                      value={formData.service_id || ''}
                      onChange={handleServiceChange}
                      label={t('appointment.serviceType')}
                    >
                      {filteredServices.map((service) => (
                        <MenuItem key={service.id} value={service.id}>
                          {service.name}
                          {formatServicePrice(service) ? ` — ${formatServicePrice(service)}` : ''}
                          {formatServiceDuration(service) ? ` • ${formatServiceDuration(service)}` : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
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
                    shouldDisableDate={() => false}
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

            {!isNewAppointment && formData.status !== 'cancelled' ? (
              <Grid item xs={12}>
                <AppointmentChat
                  appointmentId={id}
                  recipientId={
                    user?.role === 'client' ? formData.mechanic_id : appointmentUserId
                  }
                />
              </Grid>
            ) : null}

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
