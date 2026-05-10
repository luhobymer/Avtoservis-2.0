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
  Typography,
  TableSortLabel
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

  const [sortKey, setSortKey] = useState(() => {
    try {
      return localStorage.getItem('service_records_sort_key') || 'service_date';
    } catch (e) {
      void e;
      return 'service_date';
    }
  });
  const [sortDir, setSortDir] = useState(() => {
    try {
      return localStorage.getItem('service_records_sort_dir') || 'desc';
    } catch (e) {
      void e;
      return 'desc';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('service_records_sort_key', sortKey);
      localStorage.setItem('service_records_sort_dir', sortDir);
    } catch (e) {
      void e;
    }
  }, [sortDir, sortKey]);

  const requestSort = useCallback(
    (nextKey, options = {}) => {
      const defaultDir = options?.defaultDir || 'asc';
      if (sortKey === nextKey) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        return;
      }
      setSortKey(nextKey);
      setSortDir(defaultDir);
    },
    [sortKey]
  );

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

  const sortedRecords = useMemo(() => {
    const rows = Array.isArray(records) ? records : [];
    const dir = sortDir === 'asc' ? 1 : -1;

    const getString = (v) => String(v ?? '').trim().toLowerCase();
    const getNumber = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const getServiceDate = (r) => r?.serviceDate || r?.service_date || null;
    const getMileage = (r) => getNumber(r?.mileage);
    const getCost = (r) => getNumber(r?.cost);
    const getServiceType = (r) => getString(r?.serviceName || r?.serviceType || r?.service_type || '');

    const keyFn = (r) => {
      switch (sortKey) {
        case 'mileage':
          return getMileage(r);
        case 'cost':
          return getCost(r);
        case 'service_type':
          return getServiceType(r);
        case 'service_date':
        default:
          return getServiceDate(r) ? new Date(getServiceDate(r)).getTime() : null;
      }
    };

    return rows
      .map((record, idx) => ({ record, idx }))
      .sort((a, b) => {
        const va = keyFn(a.record);
        const vb = keyFn(b.record);
        if (va == null && vb == null) return a.idx - b.idx;
        if (va == null) return 1;
        if (vb == null) return -1;

        if (typeof va === 'number' && typeof vb === 'number') {
          if (va === vb) return a.idx - b.idx;
          return (va - vb) * dir;
        }

        const result = String(va).localeCompare(String(vb), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
        if (result === 0) return a.idx - b.idx;
        return result * dir;
      })
      .map((entry) => entry.record);
  }, [records, sortDir, sortKey]);

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
        <>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="service-book-sort-key">{t('common.sortBy', 'Сортувати за')}</InputLabel>
              <Select
                labelId="service-book-sort-key"
                value={sortKey}
                label={t('common.sortBy', 'Сортувати за')}
                onChange={(e) => setSortKey(e.target.value)}
              >
                <MenuItem value="service_date">{t('serviceRecord.serviceDate', 'Дата')}</MenuItem>
                <MenuItem value="service_type">{t('serviceRecord.serviceType', 'Тип')}</MenuItem>
                <MenuItem value="mileage">{t('serviceRecord.mileage', 'Пробіг')}</MenuItem>
                <MenuItem value="cost">{t('serviceRecord.cost', 'Вартість')}</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="service-book-sort-dir">{t('common.order', 'Порядок')}</InputLabel>
              <Select
                labelId="service-book-sort-dir"
                value={sortDir}
                label={t('common.order', 'Порядок')}
                onChange={(e) => setSortDir(e.target.value)}
              >
                <MenuItem value="asc">{t('common.ascending', 'Зростання')}</MenuItem>
                <MenuItem value="desc">{t('common.descending', 'Спадання')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sortDirection={sortKey === 'service_date' ? sortDir : false}>
                  <TableSortLabel
                    active={sortKey === 'service_date'}
                    direction={sortKey === 'service_date' ? sortDir : 'asc'}
                    onClick={() => requestSort('service_date', { defaultDir: 'desc' })}
                  >
                    {t('serviceRecord.serviceDate', 'Дата')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortKey === 'service_type' ? sortDir : false}>
                  <TableSortLabel
                    active={sortKey === 'service_type'}
                    direction={sortKey === 'service_type' ? sortDir : 'asc'}
                    onClick={() => requestSort('service_type')}
                  >
                    {t('serviceRecord.serviceType', 'Тип')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortKey === 'mileage' ? sortDir : false}>
                  <TableSortLabel
                    active={sortKey === 'mileage'}
                    direction={sortKey === 'mileage' ? sortDir : 'asc'}
                    onClick={() => requestSort('mileage')}
                  >
                    {t('serviceRecord.mileage', 'Пробіг')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortKey === 'cost' ? sortDir : false}>
                  <TableSortLabel
                    active={sortKey === 'cost'}
                    direction={sortKey === 'cost' ? sortDir : 'asc'}
                    onClick={() => requestSort('cost')}
                  >
                    {t('serviceRecord.cost', 'Вартість')}
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">{t('common.edit', 'Редагувати')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRecords.map((record, idx) => {
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
        </>
      )}
    </Container>
  );
};

export default ServiceBook;
