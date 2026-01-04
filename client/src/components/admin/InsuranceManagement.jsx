import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Typography,
  Alert,
  Snackbar,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import * as insuranceDao from '../../api/dao/insuranceDao';
import * as vehiclesDao from '../../api/dao/vehiclesDao';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { uk } from 'date-fns/locale';

const InsuranceManagement = () => {
  const { t } = useTranslation();
  const [insurances, setInsurances] = useState([]);
  const [cars, setCars] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedInsurance, setSelectedInsurance] = useState(null);
  const [formData, setFormData] = useState({
    car_id: '',
    policy_number: '',
    insurance_company: '',
    start_date: null,
    end_date: null
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchInsurances = useCallback(async () => {
    try {
      const data = await insuranceDao.listAll();
      setInsurances(data);
    } catch (error) {
      showSnackbar(t('insurance.fetch_error'), 'error');
    }
  }, [t]);

  const fetchCars = useCallback(async () => {
    try {
      const list = await vehiclesDao.list();
      setCars(list);
    } catch (error) {
      showSnackbar(t('cars.fetch_error'), 'error');
    }
  }, [t]);

  useEffect(() => {
    fetchInsurances();
    fetchCars();
  }, [t, fetchInsurances, fetchCars]);

  const handleOpenDialog = (insurance = null) => {
    setSelectedInsurance(insurance);
    setFormData(insurance ? {
      vehicle_vin: insurance.vehicle_vin,
      policy_number: insurance.policy_number,
      insurance_company: insurance.insurance_company,
      start_date: insurance.start_date ? new Date(insurance.start_date) : null,
      end_date: insurance.end_date ? new Date(insurance.end_date) : null
    } : {
      vehicle_vin: '',
      policy_number: '',
      insurance_company: '',
      start_date: null,
      end_date: null
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedInsurance(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    try {
      if (selectedInsurance) {
        await insuranceDao.updateById(selectedInsurance.id, formData);
        showSnackbar(t('insurance.updated'), 'success');
      } else {
        await insuranceDao.create(formData);
        showSnackbar(t('insurance.created'), 'success');
      }
      handleCloseDialog();
      fetchInsurances();
    } catch (error) {
      showSnackbar(t('insurance.save_error'), 'error');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('insurance.confirm_delete'))) {
      try {
        await insuranceDao.deleteById(id);
        showSnackbar(t('insurance.deleted'), 'success');
        fetchInsurances();
      } catch (error) {
        showSnackbar(t('insurance.delete_error'), 'error');
      }
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const getCarInfoByVin = (vin) => {
    const car = cars.find(c => c.vin === vin);
    return car ? `${car.brand || car.make} ${car.model} (${car.year})` : '';
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={uk}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <Typography variant="h6">{t('insurance.title')}</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          {t('insurance.add_new')}
        </Button>
      </div>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('insurance.car')}</TableCell>
              <TableCell>{t('insurance.policy_number')}</TableCell>
              <TableCell>{t('insurance.company')}</TableCell>
              <TableCell>{t('insurance.start_date')}</TableCell>
              <TableCell>{t('insurance.end_date')}</TableCell>
              <TableCell>{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {insurances.map((insurance) => (
              <TableRow key={insurance.id}>
                <TableCell>{getCarInfoByVin(insurance.vehicle_vin)}</TableCell>
                <TableCell>{insurance.policy_number}</TableCell>
                <TableCell>{insurance.insurance_company}</TableCell>
                <TableCell>{new Date(insurance.start_date).toLocaleDateString()}</TableCell>
                <TableCell>{new Date(insurance.end_date).toLocaleDateString()}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpenDialog(insurance)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(insurance.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>
          {selectedInsurance ? t('insurance.edit') : t('insurance.add_new')}
        </DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>{t('insurance.car')}</InputLabel>
            <Select
              name="vehicle_vin"
              value={formData.vehicle_vin}
              onChange={handleInputChange}
              label={t('insurance.car')}
            >
              {cars.map(car => (
                <MenuItem key={car.id} value={car.vin}>
                  {`${car.brand || car.make} ${car.model} (${car.year})`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            name="policy_number"
            label={t('insurance.policy_number')}
            value={formData.policy_number}
            onChange={handleInputChange}
            fullWidth
            margin="normal"
          />
          <TextField
            name="insurance_company"
            label={t('insurance.company')}
            value={formData.insurance_company}
            onChange={handleInputChange}
            fullWidth
            margin="normal"
          />
          <DatePicker
            label={t('insurance.start_date')}
            value={formData.start_date}
            onChange={(value) => handleDateChange('start_date', value)}
            renderInput={(params) => <TextField {...params} fullWidth margin="normal" />}
          />
          <DatePicker
            label={t('insurance.end_date')}
            value={formData.end_date}
            onChange={(value) => handleDateChange('end_date', value)}
            renderInput={(params) => <TextField {...params} fullWidth margin="normal" />}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} variant="contained">
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </LocalizationProvider>
  );
};

export default InsuranceManagement;
