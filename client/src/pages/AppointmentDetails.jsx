import React, { useState, useEffect, useMemo } from 'react';
import { Alert } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import { getById as getAppointmentById, create as createAppointment, update as updateAppointment, updateStatus } from '../api/dao/appointmentsDao';
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
  StepLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip
} from '@mui/material';
import { DateTimePicker, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

import Snackbar from '@mui/material/Snackbar';
import AppointmentChat from '../components/chat/AppointmentChat';

const AppointmentDetails = ({ isNew }) => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNewAppointment = isNew || id === 'new';
  const { user, isMaster } = useAuth();
  const isMasterUser = typeof isMaster === 'function' ? isMaster() : false;
  
  const [hideMechanicSelection, setHideMechanicSelection] = useState(false);
  const [loading, setLoading] = useState(!isNewAppointment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Completion Dialog States
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [completionData, setCompletionData] = useState({
    completion_mileage: '',
    completion_notes: '',
    parts: []
  });
  const [newPart, setNewPart] = useState({
    name: '',
    part_number: '',
    price: '',
    quantity: 1,
    purchased_by: 'owner', // or 'service'
    notes: ''
  });

  const [vehicles, setVehicles] = useState([]);
  const [services, setServices] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [success, setSuccess] = useState(false);
  const [appointmentUserId, setAppointmentUserId] = useState('');

  const [mechanicCity, setMechanicCity] = useState('');
  const [serviceCategoryId, setServiceCategoryId] = useState('');
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
    notes: '',
    appointment_price: '',
    appointment_duration: ''
  });

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
        const role = String(user?.role || '').toLowerCase();
        if (role === 'client') {
             setHideMechanicSelection(false);
             const token = localStorage.getItem('auth_token');
             const res = await fetch('/api/relationships/mechanics', {
               headers: { Authorization: `Bearer ${token}` }
             });
             const data = await res.json();
             const accepted = data.filter(m => m.status === 'accepted').map(m => ({
                 id: m.mechanic_id,
                 fullName: m.name,
                 ...m
             }));
             setMechanics(accepted);
        } else if (role === 'master' || role === 'mechanic' || role === 'admin') {
          setHideMechanicSelection(true);
          try {
            setError('');
            const current = await getCurrentMechanic();
            if (current?.id) {
              setMechanics([current]);
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
          setMechanics([]);
          setError(t('errors.mechanicProfileNotFound', 'Профіль механіка не знайдено'));
        } else {
          const city = mechanicCity || (isNewAppointment ? user?.city : '') || '';
          const rows = await listMechanics(city ? { city } : undefined);
          setMechanics(rows);
          setHideMechanicSelection(false);
        }
      } catch (err) {
        console.error(err);
        setMechanics([]);
        const role = String(user?.role || '').toLowerCase();
        setHideMechanicSelection(role === 'master' || role === 'mechanic' || role === 'admin');
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
          notes: appointment.notes || '',
          appointment_price:
            appointment.appointmentPrice != null ? String(appointment.appointmentPrice) : '',
          appointment_duration:
            appointment.appointmentDuration != null ? String(appointment.appointmentDuration) : '',
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

  const serviceCategories = useMemo(() => {
    const map = new Map();
    for (const s of services || []) {
      const id = (s?.category && s.category.id) || s?.category_id || s?.categoryId || '';
      const name =
        (s?.category && s.category.name) || s?.category_name || s?.categoryName || '';
      const key = id || '__none__';
      if (!map.has(key)) {
        map.set(key, { id: key, name: name || t('services.noCategory', 'Без категорії') });
      }
    }
    return Array.from(map.values()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [services, t]);

  useEffect(() => {
    if (!services || services.length === 0) {
      setServiceCategoryId('');
      return;
    }

    const selectedService = formData.service_id
      ? (services || []).find((s) => String(s.id) === String(formData.service_id))
      : null;
    const selectedCategory =
      (selectedService?.category && selectedService.category.id) ||
      selectedService?.category_id ||
      selectedService?.categoryId ||
      '';

    if (selectedCategory) {
      setServiceCategoryId(String(selectedCategory));
      return;
    }
    if (!serviceCategoryId && serviceCategories.length > 0) {
      setServiceCategoryId(String(serviceCategories[0].id));
    }
  }, [services, formData.service_id, serviceCategories, serviceCategoryId]);

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
      serviceType: selected ? selected.name || '' : prev.serviceType,
      appointment_price:
        isNewAppointment
          ? (selected && selected.price != null ? String(selected.price) : '')
          : prev.appointment_price || (selected && selected.price != null ? String(selected.price) : ''),
      appointment_duration:
        isNewAppointment
          ? (selected && selected.duration != null ? String(selected.duration) : '')
          : prev.appointment_duration || (selected && selected.duration != null ? String(selected.duration) : ''),
    }));
  };

  const handleMechanicChange = (e) => {
    const { value } = e.target;
    setFormData((prev) => ({
      ...prev,
      mechanic_id: value || null,
      service_id: null,
      appointment_price: '',
      appointment_duration: ''
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

  // --- Completion Logic ---
  const handleAddPart = () => {
    if (!newPart.name) return;
    setCompletionData(prev => ({
      ...prev,
      parts: [...prev.parts, { ...newPart, id: Date.now() }]
    }));
    setNewPart({
      name: '',
      part_number: '',
      price: '',
      quantity: 1,
      purchased_by: 'owner',
      notes: ''
    });
  };

  const handleRemovePart = (partId) => {
    setCompletionData(prev => ({
      ...prev,
      parts: prev.parts.filter(p => p.id !== partId)
    }));
  };

  const handleStatusAction = async (newStatus) => {
    if (newStatus === 'completed') {
      // Find current vehicle mileage
      const vehicle = vehicles.find(v => v.vin === formData.vehicle_vin);
      setCompletionData(prev => ({
        ...prev,
        completion_mileage: vehicle ? vehicle.mileage : '',
        completion_notes: formData.notes
      }));
      setCompletionDialogOpen(true);
      return;
    }

    try {
      await updateStatus(id, newStatus);
      setFormData(prev => ({ ...prev, status: newStatus }));
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Помилка оновлення статусу');
    }
  };

  const handleConfirmCompletion = async () => {
    if (!completionData.completion_mileage) {
        alert(t('errors.mileageRequired', 'Будь ласка, вкажіть пробіг'));
        return;
    }
    
    try {
      setSaving(true);
      await updateStatus(id, 'completed', completionData);
      setFormData(prev => ({ ...prev, status: 'completed' }));
      setSuccess(true);
      setCompletionDialogOpen(false);
      setTimeout(() => navigate('/appointments'), 1500);
    } catch (err) {
      setError(err.message || 'Помилка завершення запису');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Validation logic (simplified)
      if (!formData.scheduledDate) throw new Error(t('errors.invalidScheduledDate', 'Некоректна дата'));
      if (!formData.service_id) throw new Error(t('errors.serviceRequired', 'Оберіть послугу'));
      if (!formData.mechanic_id) throw new Error(t('errors.mechanicRequired', 'Оберіть механіка'));
      
      const isClientUser = String(user?.role || '').toLowerCase() === 'client';
      const payload = {
        user_id: isClientUser ? (user?.id || null) : (clientId || null),
        service_id: formData.service_id || null,
        mechanic_id: formData.mechanic_id || null,
        service_type: formData.serviceType,
        scheduled_time: formData.scheduledDate.toISOString(),
        vehicle_vin: formData.vehicle_vin,
        status: formData.status,
        description: formData.description || '',
        notes: formData.notes || '',
        estimated_completion_date: formData.estimatedCompletionDate ? new Date(formData.estimatedCompletionDate).toISOString() : null,
      };

      if (formData.appointment_price) payload.appointment_price = Number(formData.appointment_price);
      if (formData.appointment_duration) payload.appointment_duration = Number(formData.appointment_duration);

      if (isNewAppointment) {
        if (!payload.user_id) throw new Error(t('errors.clientRequired', 'Оберіть клієнта'));
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
      await updateStatus(id, 'cancelled');
      navigate('/appointments');
    } catch (err) {
      setError(err.message || 'Не вдалося скасувати');
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

  const filteredServices = useMemo(() => {
    if (!serviceCategoryId) return [];
    return (services || []).filter((s) => {
      const cid = (s?.category && s.category.id) || s?.category_id || s?.categoryId || '';
      const key = cid || '__none__';
      return String(key) === String(serviceCategoryId);
    });
  }, [services, serviceCategoryId]);

  const selectedService = useMemo(() => {
    if (!formData.service_id) return null;
    return (services || []).find((s) => String(s?.id || '') === String(formData.service_id)) || null;
  }, [services, formData.service_id]);

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
      <Paper elevation={3} sx={{ p: 3, mt: 4, mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
             <Typography variant="h4">
                {isNewAppointment ? t('appointment.schedule') : t('common.edit')}
             </Typography>
             {!isNewAppointment && isMasterUser && formData.status !== 'completed' && formData.status !== 'cancelled' && (
               <Box>
                 {formData.status === 'scheduled' && (
                    <Button variant="contained" color="primary" onClick={() => handleStatusAction('in-progress')}>
                      {t('appointment.startWork', 'Розпочати роботу')}
                    </Button>
                 )}
                 {formData.status === 'in-progress' && (
                    <Button variant="contained" color="success" onClick={() => handleStatusAction('completed')}>
                      {t('appointment.completeWork', 'Завершити роботу')}
                    </Button>
                 )}
               </Box>
             )}
          </Box>
          
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
          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
          
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Common Fields */}
              {isNewAppointment && String(user?.role || '').toLowerCase() !== 'client' && (
                <Grid item xs={12}>
                  <FormControl fullWidth required>
                    <InputLabel>{t('clients.title', 'Клієнт')}</InputLabel>
                    <Select value={clientId} onChange={handleClientChange} label={t('clients.title', 'Клієнт')}>
                      {clients.map((c) => (
                        <MenuItem key={c.id} value={c.id}>{c.name || c.email}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>{t('vehicle.title')}</InputLabel>
                  <Select
                    name="vehicle_vin"
                    value={formData.vehicle_vin}
                    onChange={handleChange}
                    label={t('vehicle.title')}
                    disabled={!isNewAppointment}
                  >
                    {vehicles.map((vehicle) => (
                      <MenuItem key={vehicle.vin} value={vehicle.vin}>
                        {vehicle.brand} {vehicle.model} ({vehicle.licensePlate || vehicle.license_plate || vehicle.vin})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Mechanic & Service Selection - Similar to previous code, simplified for brevity but functional */}
              {!hideMechanicSelection && (
                 <Grid item xs={12} sm={6}>
                   <TextField fullWidth label={t('auth.city', 'Місто')} value={mechanicCity} onChange={handleMechanicCityChange} />
                 </Grid>
              )}

              {/* ... (Include Mechanic/Service Selectors here as per original code) ... */}
              {/* Re-using simplified logic for rendering these fields if needed, or assuming they are filled if not editing */}
              
               <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required>
                    <InputLabel>{t('appointment.mechanic', 'Механік')}</InputLabel>
                    <Select
                      name="mechanic_id"
                      value={formData.mechanic_id || ''}
                      onChange={handleMechanicChange}
                      label={t('appointment.mechanic', 'Механік')}
                      disabled={hideMechanicSelection && mechanics.length === 1}
                    >
                      {mechanics.map((mechanic) => (
                        <MenuItem key={mechanic.id} value={mechanic.id}>{mechanic.fullName || mechanic.email}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required disabled={!formData.mechanic_id || services.length === 0}>
                    <InputLabel>{t('services.category', 'Категорія')}</InputLabel>
                    <Select value={serviceCategoryId || ''} onChange={(e) => {
                         setServiceCategoryId(String(e.target.value));
                         setFormData(prev => ({...prev, service_id: null}));
                    }} label={t('services.category', 'Категорія')}>
                      {serviceCategories.map((cat) => <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6}>
                   <FormControl fullWidth required disabled={!serviceCategoryId}>
                      <InputLabel>{t('appointment.serviceType')}</InputLabel>
                      <Select name="service_id" value={formData.service_id || ''} onChange={handleServiceChange} label={t('appointment.serviceType')}>
                         {filteredServices.map((service) => (
                            <MenuItem key={service.id} value={service.id}>
                               {service.name} {formatServicePrice(service)}
                            </MenuItem>
                         ))}
                      </Select>
                   </FormControl>
                </Grid>

              <Grid item xs={12} sm={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DateTimePicker
                    label={t('appointment.scheduledDate')}
                    value={formData.scheduledDate}
                    onChange={(date) => handleDateChange('scheduledDate', date)}
                    renderInput={(params) => <TextField {...params} fullWidth required />}
                  />
                </LocalizationProvider>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('appointment.notes')}
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  multiline
                  rows={3}
                />
              </Grid>
              
              {/* Chat Section */}
              {!isNewAppointment && formData.status !== 'cancelled' && (
                <Grid item xs={12}>
                  <AppointmentChat
                    appointmentId={id}
                    recipientId={user?.role === 'client' ? formData.mechanic_id : appointmentUserId}
                  />
                </Grid>
              )}

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button type="submit" variant="contained" color="primary" disabled={saving}>
                    {isNewAppointment ? t('appointment.schedule') : t('common.save')}
                  </Button>
                  {!isNewAppointment && (
                    <Button type="button" variant="outlined" color="error" onClick={() => setDeleteDialogOpen(true)}>
                      {t('appointment.cancelAppointment')}
                    </Button>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Box>
      </Paper>

      {/* Completion Dialog */}
      <Dialog open={completionDialogOpen} onClose={() => setCompletionDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('appointment.completeWork', 'Завершення робіт')}</DialogTitle>
        <DialogContent>
           <DialogContentText sx={{ mb: 2 }}>
             {t('appointment.completePrompt', 'Введіть дані про завершення робіт. Це створить запис у сервісній книзі.')}
           </DialogContentText>
           
           <TextField
             fullWidth
             label={t('vehicle.mileage', 'Пробіг (км)')}
             type="number"
             value={completionData.completion_mileage}
             onChange={(e) => setCompletionData({...completionData, completion_mileage: e.target.value})}
             required
             margin="normal"
           />
           
           <TextField
             fullWidth
             label={t('appointment.completionNotes', 'Примітки до виконання')}
             multiline
             rows={2}
             value={completionData.completion_notes}
             onChange={(e) => setCompletionData({...completionData, completion_notes: e.target.value})}
             margin="normal"
           />
           
           <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>{t('parts.usedParts', 'Використані запчастини')}</Typography>
           
           {/* Add Part Form */}
           <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
             <TextField label={t('parts.name')} size="small" value={newPart.name} onChange={(e) => setNewPart({...newPart, name: e.target.value})} sx={{ flexGrow: 1 }} />
             <TextField label={t('parts.price')} size="small" type="number" value={newPart.price} onChange={(e) => setNewPart({...newPart, price: e.target.value})} sx={{ width: 100 }} />
             <TextField label={t('parts.qty', 'К-сть')} size="small" type="number" value={newPart.quantity} onChange={(e) => setNewPart({...newPart, quantity: e.target.value})} sx={{ width: 80 }} />
             <FormControl size="small" sx={{ width: 150 }}>
               <InputLabel>{t('parts.buyer', 'Купив')}</InputLabel>
               <Select value={newPart.purchased_by} label={t('parts.buyer')} onChange={(e) => setNewPart({...newPart, purchased_by: e.target.value})}>
                 <MenuItem value="owner">{t('parts.owner', 'Власник')}</MenuItem>
                 <MenuItem value="service">{t('parts.service', 'Сервіс')}</MenuItem>
               </Select>
             </FormControl>
             <IconButton color="primary" onClick={handleAddPart} disabled={!newPart.name}>
               <AddIcon />
             </IconButton>
           </Box>
           
           {/* Parts List */}
           {completionData.parts.length > 0 ? (
             <TableContainer component={Paper} variant="outlined">
               <Table size="small">
                 <TableHead>
                   <TableRow>
                     <TableCell>{t('parts.name')}</TableCell>
                     <TableCell>{t('parts.price')}</TableCell>
                     <TableCell>{t('parts.qty')}</TableCell>
                     <TableCell>{t('parts.buyer')}</TableCell>
                     <TableCell></TableCell>
                   </TableRow>
                 </TableHead>
                 <TableBody>
                   {completionData.parts.map((part) => (
                     <TableRow key={part.id}>
                       <TableCell>{part.name}</TableCell>
                       <TableCell>{part.price}</TableCell>
                       <TableCell>{part.quantity}</TableCell>
                       <TableCell>{part.purchased_by === 'owner' ? t('parts.owner') : t('parts.service')}</TableCell>
                       <TableCell>
                         <IconButton size="small" color="error" onClick={() => handleRemovePart(part.id)}>
                           <DeleteIcon />
                         </IconButton>
                       </TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             </TableContainer>
           ) : (
             <Typography variant="body2" color="text.secondary">{t('parts.noPartsAdded', 'Запчастини не додано')}</Typography>
           )}

        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompletionDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleConfirmCompletion} variant="contained" color="success">{t('common.complete')}</Button>
        </DialogActions>
      </Dialog>
      
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('common.confirm')}</DialogTitle>
        <DialogContent><DialogContentText>{t('appointment.confirmDelete')}</DialogContentText></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleDelete} color="error">{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default AppointmentDetails;
