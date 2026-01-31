import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as appointmentsDao from '../../api/dao/appointmentsDao';
import * as vehiclesDao from '../../api/dao/vehiclesDao';
import * as usersDao from '../../api/dao/usersDao';
import {
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Box,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { format } from 'date-fns';

const AppointmentsManagement = () => {
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [users, setUsers] = useState([]);
  
  const [formData, setFormData] = useState({
    status: '',
    actualCompletionDate: null,
    notes: ''
  });

  useEffect(() => {
    fetchAppointments();
    fetchVehicles();
    fetchUsers();
  }, []);

  const fetchAppointments = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await appointmentsDao.listAdmin();
      setAppointments(list);
    } catch (err) {
      setAppointments([]);
      setError(err.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      const list = await vehiclesDao.list();
      setVehicles(list.map(v => ({ id: v.id, vin: v.vin, make: v.make, model: v.model, licensePlate: v.licensePlate })));
    } catch (err) {
      setVehicles([]);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await usersDao.list();
      setUsers(data);
    } catch (err) {
      setUsers([]);
    }
  };

  const handleOpenDialog = (appointment) => {
    setSelectedAppointment(appointment);
    setFormData({
      status: appointment.status,
      actualCompletionDate: appointment.actualCompletionDate ? new Date(appointment.actualCompletionDate) : null,
      notes: appointment.notes || ''
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleDateChange = (date) => {
    setFormData({
      ...formData,
      actualCompletionDate: date
    });
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        status: formData.status,
        actual_completion_date: formData.actualCompletionDate ? formData.actualCompletionDate.toISOString() : null,
        notes: formData.notes || ''
      };
      await appointmentsDao.update(selectedAppointment.id, payload);
      fetchAppointments();
      handleCloseDialog();
    } catch (err) {
      setError(err.message || 'Failed to update appointment');
    }
  };

  const mapStatusToTranslation = (status) => {
    switch (status) {
      case 'pending':
        return 'pending';
      case 'confirmed':
        return 'confirmed';
      case 'in_progress':
        return 'in_progress';
      case 'completed':
        return 'completed';
      case 'cancelled':
        return 'cancelled';
      case 'scheduled':
        return 'pending';
      case 'in-progress':
        return 'in_progress';
      default:
        return 'pending';
    }
  };

  const getStatusChipColor = (status) => {
    switch (status) {
      case 'pending':
        return 'primary';
      case 'confirmed':
        return 'warning';
      case 'in_progress':
        return 'warning';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      case 'scheduled':
        return 'primary';
      case 'in-progress':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getUserName = (userId) => {
    const user = users.find(u => u.id === userId);
    return user ? (user.name || user.email || 'Unknown') : 'Unknown';
  };

  const getVehicleInfo = (vehicleVin) => {
    const vehicle = vehicles.find(v => v.vin === vehicleVin);
    return vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.licensePlate})` : 'Unknown';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
      <Typography variant="h5" gutterBottom>
        {t('admin.appointments')}
      </Typography>
      <Divider sx={{ mb: 3 }} />
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {appointments.length === 0 ? (
        <Alert severity="info">{t('appointment.noAppointments')}</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('appointment.scheduledDate')}</TableCell>
                  <TableCell>{t('auth.name')}</TableCell>
                  <TableCell>{t('vehicle.title')}</TableCell>
                  <TableCell>{t('appointment.serviceType')}</TableCell>
                  <TableCell>{t('appointment.status')}</TableCell>
                  <TableCell>{t('appointment.estimatedCompletionDate')}</TableCell>
                  <TableCell>{t('appointment.actualCompletionDate', 'Фактичне завершення')}</TableCell>
                  <TableCell align="right">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
            <TableBody>
              {appointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell>
                    {appointment.scheduledDate ? format(new Date(appointment.scheduledDate), 'dd.MM.yyyy HH:mm') : t('common.notAvailable')}
                  </TableCell>
                  <TableCell>{getUserName(appointment.UserId)}</TableCell>
                  <TableCell>{getVehicleInfo(appointment.vehicle_vin)}</TableCell>
                  <TableCell>{appointment.serviceName || appointment.serviceType || t('common.notAvailable')}</TableCell>
                  <TableCell>
                    <Chip 
                      label={t(`appointment.statuses.${mapStatusToTranslation(appointment.status)}`)}
                      color={getStatusChipColor(appointment.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {appointment.estimatedCompletionDate ? format(new Date(appointment.estimatedCompletionDate), 'dd.MM.yyyy') : t('common.notAvailable')}
                  </TableCell>
                  <TableCell>
                    {appointment.actualCompletionDate ? format(new Date(appointment.actualCompletionDate), 'dd.MM.yyyy HH:mm') : t('common.notAvailable')}
                  </TableCell>
                  <TableCell align="right">
                    <Button 
                      size="small" 
                      onClick={() => handleOpenDialog(appointment)}
                    >
                      {t('common.edit')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {/* Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>
          {t('common.edit')} {t('appointment.title')}
        </DialogTitle>
        <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
            {t('appointment.serviceType')}: {selectedAppointment?.serviceName || selectedAppointment?.serviceType || t('common.notAvailable')}
          </DialogContentText>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth margin="normal">
                <InputLabel>{t('appointment.status')}</InputLabel>
                <Select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  label={t('appointment.status')}
                >
                  <MenuItem value="pending">{t('appointment.statuses.pending')}</MenuItem>
                  <MenuItem value="confirmed">{t('appointment.statuses.confirmed')}</MenuItem>
                  <MenuItem value="in_progress">{t('appointment.statuses.in_progress')}</MenuItem>
                  <MenuItem value="completed">{t('appointment.statuses.completed')}</MenuItem>
                  <MenuItem value="cancelled">{t('appointment.statuses.cancelled')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DateTimePicker
                  label={t('appointment.actualCompletionDate')}
                  value={formData.actualCompletionDate}
                  onChange={handleDateChange}
                  disabled={formData.status !== 'completed'}
                  minDateTime={selectedAppointment?.scheduledDate ? new Date(selectedAppointment.scheduledDate) : undefined}
                  renderInput={(params) => <TextField {...params} fullWidth margin="normal" />}
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
                rows={4}
                margin="normal"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} variant="contained">
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default AppointmentsManagement;
