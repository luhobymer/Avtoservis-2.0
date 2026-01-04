import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as serviceRecordsDao from '../../api/dao/serviceRecordsDao';
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
  InputAdornment
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { format } from 'date-fns';

const ServiceRecordsManagement = () => {
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [serviceRecords, setServiceRecords] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [users, setUsers] = useState([]);
  
  const [formData, setFormData] = useState({
    vehicleId: '',
    serviceId: '',
    serviceType: '',
    description: '',
    mileage: '',
    serviceDate: new Date(),
    performedBy: '',
    cost: '',
    parts: []
  });

  useEffect(() => {
    fetchServiceRecords();
    fetchVehicles();
    fetchUsers();
  }, []);

  const fetchServiceRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await serviceRecordsDao.listAdmin();
      setServiceRecords(list);
    } catch (err) {
      setServiceRecords([]);
      setError(err.message || 'Failed to load service records');
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      const list = await vehiclesDao.list();
      setVehicles(list);
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

  const handleOpenDialog = (record) => {
    setSelectedRecord(record);
    setFormData({
      vehicleId: record.VehicleId,
      serviceId: record.serviceId || '',
      serviceType: record.serviceName || record.serviceType || '',
      description: record.description,
      mileage: record.mileage,
      serviceDate: new Date(record.serviceDate),
      performedBy: record.performedBy,
      cost: record.cost,
      parts: record.parts || []
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
      serviceDate: date
    });
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        vehicle_id: formData.vehicleId,
        service_type: formData.serviceType,
        description: formData.description,
        mileage: parseInt(formData.mileage, 10),
        service_date: formData.serviceDate.toISOString(),
        cost: parseFloat(formData.cost)
      };
      await serviceRecordsDao.update(selectedRecord.id, payload);
      fetchServiceRecords();
      handleCloseDialog();
    } catch (err) {
      setError(err.message || 'Failed to update service record');
    }
  };

  const getUserName = (userId) => {
    const user = users.find(u => u.id === userId);
    return user ? user.name : 'Unknown';
  };

  const getVehicleInfo = (vehicleId) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
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
        {t('admin.serviceRecords')}
      </Typography>
      <Divider sx={{ mb: 3 }} />
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {serviceRecords.length === 0 ? (
        <Alert severity="info">{t('serviceRecord.noRecords')}</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('serviceRecord.serviceDate')}</TableCell>
                <TableCell>{t('auth.name')}</TableCell>
                <TableCell>{t('vehicle.title')}</TableCell>
                <TableCell>{t('serviceRecord.serviceType')}</TableCell>
                <TableCell>{t('serviceRecord.mileage')}</TableCell>
                <TableCell>{t('serviceRecord.performedBy')}</TableCell>
                <TableCell>{t('serviceRecord.cost')}</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {serviceRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    {format(new Date(record.serviceDate), 'dd.MM.yyyy')}
                  </TableCell>
                  <TableCell>{getUserName(record.createdBy)}</TableCell>
                  <TableCell>{getVehicleInfo(record.VehicleId)}</TableCell>
                  <TableCell>{record.serviceName || record.serviceType}</TableCell>
                  <TableCell>{record.mileage} km</TableCell>
                  <TableCell>{record.performedBy}</TableCell>
                  <TableCell>{record.cost}</TableCell>
                  <TableCell align="right">
                    <Button 
                      size="small" 
                      onClick={() => handleOpenDialog(record)}
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
          {t('common.edit')} {t('serviceRecord.title')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {t('serviceRecord.serviceType')}: {selectedRecord?.serviceName || selectedRecord?.serviceType}
          </DialogContentText>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth margin="normal">
                <InputLabel>{t('vehicle.title')}</InputLabel>
                <Select
                  name="vehicleId"
                  value={formData.vehicleId}
                  onChange={handleChange}
                  label={t('vehicle.title')}
                >
                  {vehicles.map((vehicle) => (
                    <MenuItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.make} {vehicle.model} ({vehicle.licensePlate})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('serviceRecord.serviceType')}
                name="serviceType"
                value={formData.serviceType}
                onChange={handleChange}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label={t('serviceRecord.serviceDate')}
                  value={formData.serviceDate}
                  onChange={handleDateChange}
                  renderInput={(params) => <TextField {...params} fullWidth margin="normal" />}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('serviceRecord.mileage')}
                name="mileage"
                type="number"
                value={formData.mileage}
                onChange={handleChange}
                InputProps={{
                  endAdornment: <InputAdornment position="end">km</InputAdornment>,
                }}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('serviceRecord.cost')}
                name="cost"
                type="number"
                value={formData.cost}
                onChange={handleChange}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('serviceRecord.performedBy')}
                name="performedBy"
                value={formData.performedBy}
                onChange={handleChange}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('serviceRecord.description')}
                name="description"
                value={formData.description}
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

export default ServiceRecordsManagement;
