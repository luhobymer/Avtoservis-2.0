import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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

const VehiclesManagement = () => {
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [users, setUsers] = useState([]);
  
  const [formData, setFormData] = useState({
    make: '',
    model: '',
    year: '',
    vin: '',
    licensePlate: '',
    mileage: '',
    lastService: null,
    UserId: ''
  });

  useEffect(() => {
    fetchVehicles();
    fetchUsers();
  }, []);

  const fetchVehicles = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await vehiclesDao.list();
      setVehicles(list.map(v => ({ ...v, lastService: null })));
    } catch (err) {
      setVehicles([]);
      setError(err.message || 'Failed to load vehicles');
    } finally {
      setLoading(false);
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

  const handleOpenDialog = (vehicle) => {
    setSelectedVehicle(vehicle);
    setFormData({
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      vin: vehicle.vin,
      licensePlate: vehicle.licensePlate,
      mileage: vehicle.mileage,
      lastService: vehicle.lastService ? new Date(vehicle.lastService) : null,
      UserId: vehicle.UserId
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
      lastService: date
    });
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        make: formData.make,
        model: formData.model,
        year: parseInt(formData.year, 10),
        vin: formData.vin,
        license_plate: formData.licensePlate,
        mileage: parseInt(formData.mileage, 10),
        user_id: formData.UserId || null
      };
      await vehiclesDao.update(selectedVehicle.id, payload);
      fetchVehicles();
      handleCloseDialog();
    } catch (err) {
      setError(err.message || 'Failed to update vehicle');
    }
  };

  const getUserName = (userId) => {
    const user = users.find(u => u.id === userId);
    return user ? (user.name || user.email || 'Unknown') : 'Unknown';
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
        {t('admin.vehicles')}
      </Typography>
      <Divider sx={{ mb: 3 }} />
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {vehicles.length === 0 ? (
        <Alert severity="info">{t('vehicle.noVehicles')}</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('vehicle.make')}</TableCell>
                <TableCell>{t('vehicle.model')}</TableCell>
                <TableCell>{t('vehicle.year')}</TableCell>
                <TableCell>{t('vehicle.licensePlate')}</TableCell>
                <TableCell>{t('vehicle.vin')}</TableCell>
                <TableCell>{t('vehicle.mileage')}</TableCell>
                <TableCell>{t('auth.owner')}</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vehicles.map((vehicle) => (
                <TableRow key={vehicle.id}>
                  <TableCell>{vehicle.make}</TableCell>
                  <TableCell>{vehicle.model}</TableCell>
                  <TableCell>{vehicle.year}</TableCell>
                  <TableCell>{vehicle.licensePlate}</TableCell>
                  <TableCell>{vehicle.vin}</TableCell>
                  <TableCell>{vehicle.mileage} km</TableCell>
                  <TableCell>{getUserName(vehicle.UserId)}</TableCell>
                  <TableCell align="right">
                    <Button 
                      size="small" 
                      onClick={() => handleOpenDialog(vehicle)}
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
          {t('common.edit')} {t('vehicle.title')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {selectedVehicle?.make} {selectedVehicle?.model} ({selectedVehicle?.licensePlate})
          </DialogContentText>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth margin="normal">
                <InputLabel>{t('auth.owner')}</InputLabel>
                <Select
                  name="UserId"
                  value={formData.UserId}
                  onChange={handleChange}
                  label={t('auth.owner')}
                >
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('vehicle.make')}
                name="make"
                value={formData.make}
                onChange={handleChange}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('vehicle.model')}
                name="model"
                value={formData.model}
                onChange={handleChange}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('vehicle.year')}
                name="year"
                type="number"
                value={formData.year}
                onChange={handleChange}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('vehicle.licensePlate')}
                name="licensePlate"
                value={formData.licensePlate}
                onChange={handleChange}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('vehicle.vin')}
                name="vin"
                value={formData.vin}
                onChange={handleChange}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('vehicle.mileage')}
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
            <Grid item xs={12}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label={t('vehicle.lastService')}
                  value={formData.lastService}
                  onChange={handleDateChange}
                  renderInput={(params) => <TextField {...params} fullWidth margin="normal" />}
                />
              </LocalizationProvider>
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

export default VehiclesManagement;
