import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useAuth from '../context/useAuth';
import * as vehiclesDao from '../api/dao/vehiclesDao';
import * as serviceRecordsDao from '../api/dao/serviceRecordsDao';
import ServiceBookExport from '../components/ServiceBookExport';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import dayjs from 'dayjs';

const ServiceBook = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleVin, setSelectedVehicleVin] = useState('');
  const [records, setRecords] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [error, setError] = useState(null);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => String(v.vin) === String(selectedVehicleVin)) || null,
    [vehicles, selectedVehicleVin]
  );

  const fetchVehicles = useCallback(async () => {
    setLoadingVehicles(true);
    setError(null);
    try {
      const list = await vehiclesDao.listForUser(user?.id || '');
      const rows = Array.isArray(list) ? list : [];
      setVehicles(rows);

      if (!selectedVehicleVin && rows.length > 0) {
        setSelectedVehicleVin(rows[0]?.vin || '');
      }
    } catch (err) {
      setVehicles([]);
      setError(err?.message || t('errors.failedToLoadVehicles', 'Не вдалося завантажити автомобілі'));
    } finally {
      setLoadingVehicles(false);
    }
  }, [selectedVehicleVin, t, user?.id]);

  const fetchRecords = useCallback(async () => {
    if (!user?.id) return;
    if (!selectedVehicleVin) {
      setRecords([]);
      return;
    }

    setLoadingRecords(true);
    setError(null);
    try {
      const rows = await serviceRecordsDao.listForUser(user.id, { vehicleVin: selectedVehicleVin });
      setRecords(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setRecords([]);
      setError(err?.message || t('serviceRecord.fetchError', 'Не вдалося завантажити сервісні записи'));
    } finally {
      setLoadingRecords(false);
    }
  }, [selectedVehicleVin, t, user?.id]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  if (!user?.id) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">
          {t('errors.unauthorized', 'Будь ласка, увійдіть в систему.')}
        </Alert>
      </Container>
    );
  }

  if (loadingVehicles) {
    return (
      <Container sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4">{t('serviceBook.title', 'Сервісна книга')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('serviceBook.subtitle', 'Історія обслуговування по вибраному авто')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {records.length > 0 && (
            <ServiceBookExport records={records} vehicle={selectedVehicle} />
          )}
          <Button
            component={Link}
            to={selectedVehicleVin ? `/service-records/new?vehicle_vin=${encodeURIComponent(selectedVehicleVin)}` : '/service-records/new'}
            variant="contained"
            color="primary"
          >
            {t('serviceRecord.add', 'Додати запис')}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {vehicles.length === 0 ? (
        <Alert severity="info">
          {t('vehicle.noVehicles', 'У вас немає доданих автомобілів. Спочатку додайте автомобіль.')}
        </Alert>
      ) : (
        <Paper sx={{ p: 2, mb: 3 }}>
          <FormControl fullWidth>
            <InputLabel id="service-book-vehicle-label">
              {t('vehicle.title', 'Автомобіль')}
            </InputLabel>
            <Select
              labelId="service-book-vehicle-label"
              value={selectedVehicleVin}
              label={t('vehicle.title', 'Автомобіль')}
              onChange={(e) => setSelectedVehicleVin(e.target.value)}
            >
              {vehicles.map((v) => (
                <MenuItem key={v.vin} value={v.vin}>
                  {(v.make || v.brand || '').trim()} {v.model || ''} {v.year ? `(${v.year})` : ''}
                  {v.licensePlate ? ` — ${v.licensePlate}` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>
      )}

      {loadingRecords ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : records.length === 0 ? (
        <Alert severity="info">{t('serviceRecord.noRecords', 'Немає сервісних записів')}</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('serviceRecord.serviceDate', 'Дата')}</TableCell>
                <TableCell>{t('serviceRecord.serviceType', 'Тип')}</TableCell>
                <TableCell>{t('serviceRecord.mileage', 'Пробіг')}</TableCell>
                <TableCell>{t('serviceRecord.cost', 'Вартість')}</TableCell>
                <TableCell align="right">{t('common.edit', 'Редагувати')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((record, idx) => {
                const serviceDate = record.serviceDate || record.service_date;
                const formattedDate = serviceDate
                  ? dayjs(serviceDate).isValid()
                    ? dayjs(serviceDate).format('DD.MM.YYYY')
                    : t('common.notAvailable', '—')
                  : t('common.notAvailable', '—');
                const mileageValue = record.mileage != null ? String(record.mileage) : '';
                const costValue = record.cost != null ? String(record.cost) : '';
                return (
                  <TableRow key={record.id || `record-${idx}`}>
                    <TableCell>{formattedDate}</TableCell>
                    <TableCell>{record.serviceName || record.serviceType || record.service_type || '—'}</TableCell>
                    <TableCell>{mileageValue ? `${mileageValue} km` : '—'}</TableCell>
                    <TableCell>{costValue ? `${costValue} ₴` : '—'}</TableCell>
                    <TableCell align="right">
                      <Button size="small" component={Link} to={`/service-records/${record.id}`}>
                        {t('common.edit', 'Редагувати')}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
};

export default ServiceBook;
