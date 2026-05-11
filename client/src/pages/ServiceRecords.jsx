import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as serviceRecordsDao from '../api/dao/serviceRecordsDao';
import * as vehiclesDao from '../api/dao/vehiclesDao';
import useAuth from '../context/useAuth';
import {
  Container,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Box,
  TableSortLabel,
} from '@mui/material';
import dayjs from 'dayjs';
import ServiceBookExport from '../components/ServiceBookExport';

const ServiceRecords = ({ vehicleId: vehicleIdProp, ownerId: ownerIdProp, vehicleVin: vehicleVinProp } = {}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const vehicleIdParam = queryParams.get('vehicleId');
  const { user } = useAuth();
  
  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const filteredVehicleId = vehicleIdProp || vehicleIdParam || null;
  const filteredVehicleVin = vehicleVinProp || null;
  const effectiveUserId = ownerIdProp || user?.id || null;

  useEffect(() => {
    try {
      localStorage.setItem('service_records_sort_key', sortKey);
      localStorage.setItem('service_records_sort_dir', sortDir);
    } catch (e) {
      void e;
    }
  }, [sortDir, sortKey]);

  const requestSort = React.useCallback(
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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!effectiveUserId) {
          setRecords([]);
          setVehicles([]);
          setError(
            t(
              'errors.unauthorized',
              'Будь ласка, увійдіть в систему для перегляду сервісних записів.'
            )
          );
          return;
        }

        const [recordsList, vehiclesList] = await Promise.all([
          serviceRecordsDao.listForUser(effectiveUserId, {
            vehicleId: filteredVehicleId,
            vehicleVin: filteredVehicleVin
          }),
          vehiclesDao.listForUser(effectiveUserId)
        ]);
        let filteredRecords = recordsList;
        if (filteredVehicleId) {
          filteredRecords = filteredRecords.filter(record => {
            const recordVehicleId = record.vehicleId || record.VehicleId || record.vehicle_id;
            return recordVehicleId?.toString() === filteredVehicleId;
          });
        }
        setRecords(filteredRecords);
        setVehicles(vehiclesList);
      } catch (error) {
        console.error('Error fetching service records:', error);
        setRecords([]);
        setVehicles([]);
        if (error.response) {
          if (error.response.status === 401) {
            setError(t('errors.unauthorized', 'Будь ласка, увійдіть в систему для перегляду сервісних записів.'));
          } else if (error.response.status === 403) {
            setError(t('errors.forbidden', 'У вас немає прав для перегляду цих сервісних записів.'));
          } else if (error.response.status === 404) {
            setError(t('errors.notFound', 'Сервісні записи не знайдено.'));
          } else {
            setError(t('errors.serverError', 'Помилка сервера. Спробуйте пізніше.'));
          }
        } else if (error.request) {
          setError(t('errors.networkError', 'Не вдалося з\'єднатися з сервером. Перевірте підключення до мережі.'));
        } else {
          setError(t('errors.unknownError', 'Виникла невідома помилка. Спробуйте пізніше.'));
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [effectiveUserId, filteredVehicleId, filteredVehicleVin, t]);

  const headerVehicle =
    records[0]?.Vehicle || records[0]?.vehicles || records[0]?.vehicle || null;
  const selectedVehicle =
    filteredVehicleId ? vehicles.find(v => v.id?.toString() === filteredVehicleId) : null;
  const selectedVehicleVin = selectedVehicle?.vin || filteredVehicleVin || '';
  const headerVehicleLabel = headerVehicle
    ? `${headerVehicle.make || headerVehicle.brand || ''} ${headerVehicle.model || ''} (${
        headerVehicle.licensePlate || headerVehicle.license_plate || ''
      })`.trim()
    : null;

  const sortedRecords = React.useMemo(() => {
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

    const vehicleLabel = (r) => {
      const recordVehicleId = r.vehicleId || r.VehicleId || r.vehicle_id;
      const recordVehicleVin = r.vehicleVin || r.vehicle_vin;
      const inlineVehicle = r.Vehicle || r.vehicles || r.vehicle || null;
      const vehicle = vehicles.find((v) => {
        if (recordVehicleId) return v.id?.toString() === recordVehicleId?.toString();
        if (recordVehicleVin) return v.vin === recordVehicleVin;
        return false;
      });
      const resolvedVehicle = vehicle || inlineVehicle;
      if (!resolvedVehicle) return '';
      return getString(`${resolvedVehicle.brand || resolvedVehicle.make || ''} ${resolvedVehicle.model || ''} ${resolvedVehicle.year || ''}`);
    };

    const keyFn = (r) => {
      switch (sortKey) {
        case 'mileage':
          return getMileage(r);
        case 'cost':
          return getCost(r);
        case 'service_type':
          return getServiceType(r);
        case 'vehicle':
          return vehicleLabel(r);
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
  }, [records, sortDir, sortKey, vehicles]);

  if (loading) {
    return (
      <Container sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (filteredVehicleId) {
    // Якщо компонент використовується всередині вкладки, рендеримо тільки контент
    if (location.pathname.includes('/vehicles/')) {
      return (
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button 
              component={Link} 
              to={`/service-records/new?vehicle_vin=${selectedVehicleVin}`}
              variant="contained" 
              color="primary"
            >
              {t('serviceRecord.add')}
            </Button>
          </Box>
          {records.length === 0 ? (
            <Alert severity="info">{t('serviceRecord.noRecords')}</Alert>
          ) : (
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
                        {t('serviceRecord.serviceDate')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sortDirection={sortKey === 'service_type' ? sortDir : false}>
                      <TableSortLabel
                        active={sortKey === 'service_type'}
                        direction={sortKey === 'service_type' ? sortDir : 'asc'}
                        onClick={() => requestSort('service_type')}
                      >
                        {t('serviceRecord.serviceType')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sortDirection={sortKey === 'mileage' ? sortDir : false}>
                      <TableSortLabel
                        active={sortKey === 'mileage'}
                        direction={sortKey === 'mileage' ? sortDir : 'asc'}
                        onClick={() => requestSort('mileage')}
                      >
                        {t('serviceRecord.mileage')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell sortDirection={sortKey === 'cost' ? sortDir : false}>
                      <TableSortLabel
                        active={sortKey === 'cost'}
                        direction={sortKey === 'cost' ? sortDir : 'asc'}
                        onClick={() => requestSort('cost')}
                      >
                        {t('serviceRecord.cost')}
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right">{t('common.edit')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedRecords.map((record, index) => {
                    const serviceDate = record.serviceDate || record.service_date;
                    const formattedServiceDate = serviceDate
                      ? dayjs(serviceDate).isValid()
                        ? dayjs(serviceDate).format('DD.MM.YYYY')
                        : t('common.notAvailable')
                      : t('common.notAvailable');
                    return (
                      <TableRow key={record.id || `record-${index}`}>
                        <TableCell>{formattedServiceDate}</TableCell>
                        <TableCell>{record.serviceName || record.serviceType || record.service_type}</TableCell>
                        <TableCell>{record.mileage ? `${record.mileage} km` : t('common.notAvailable')}</TableCell>
                        <TableCell>{record.cost || t('common.notAvailable')}</TableCell>
                        <TableCell align="right">
                          <Button 
                            size="small" 
                            component={Link} 
                            to={`/service-records/${record.id}`}
                          >
                            {t('common.edit')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      );
    }
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {t('serviceRecord.title')}
          {filteredVehicleId && records.length > 0 && headerVehicleLabel && (
            <Typography component="span" variant="subtitle1" sx={{ ml: 2 }}>
              - {headerVehicleLabel}
            </Typography>
          )}
        </Typography>
        <Box>
          {records.length > 0 && (
            <ServiceBookExport 
              records={records} 
              vehicle={filteredVehicleId && records.length > 0 ? (records[0].Vehicle || records[0].vehicles || null) : null} 
            />
          )}
          <Button 
            component={Link} 
            to={
              filteredVehicleId && selectedVehicle?.vin
                ? `/service-records/new?vehicle_vin=${selectedVehicle.vin}`
                : '/service-records/new'
            } 
            variant="contained" 
            color="primary"
            sx={{ ml: 1 }}
          >
            {t('serviceRecord.add')}
          </Button>
        </Box>
      </Box>
      {records.length === 0 ? (
        <Alert severity="info">{t('serviceRecord.noRecords')}</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: { xs: 0, sm: 650 } }}>
            <TableHead>
              <TableRow>
                <TableCell sortDirection={sortKey === 'service_date' ? sortDir : false}>
                  <TableSortLabel
                    active={sortKey === 'service_date'}
                    direction={sortKey === 'service_date' ? sortDir : 'asc'}
                    onClick={() => requestSort('service_date', { defaultDir: 'desc' })}
                  >
                    {t('serviceRecord.serviceDate')}
                  </TableSortLabel>
                </TableCell>
                {!filteredVehicleId && (
                  <TableCell sortDirection={sortKey === 'vehicle' ? sortDir : false}>
                    <TableSortLabel
                      active={sortKey === 'vehicle'}
                      direction={sortKey === 'vehicle' ? sortDir : 'asc'}
                      onClick={() => requestSort('vehicle')}
                    >
                      {t('serviceRecord.vehicle')}
                    </TableSortLabel>
                  </TableCell>
                )}
                <TableCell sortDirection={sortKey === 'service_type' ? sortDir : false}>
                  <TableSortLabel
                    active={sortKey === 'service_type'}
                    direction={sortKey === 'service_type' ? sortDir : 'asc'}
                    onClick={() => requestSort('service_type')}
                  >
                    {t('serviceRecord.serviceType')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sortDirection={sortKey === 'mileage' ? sortDir : false}>
                  <TableSortLabel
                    active={sortKey === 'mileage'}
                    direction={sortKey === 'mileage' ? sortDir : 'asc'}
                    onClick={() => requestSort('mileage')}
                  >
                    {t('serviceRecord.mileage')}
                  </TableSortLabel>
                </TableCell>
                <TableCell>{t('serviceRecord.performedBy', 'Виконано')}</TableCell>
                <TableCell sortDirection={sortKey === 'cost' ? sortDir : false}>
                  <TableSortLabel
                    active={sortKey === 'cost'}
                    direction={sortKey === 'cost' ? sortDir : 'asc'}
                    onClick={() => requestSort('cost')}
                  >
                    {t('serviceRecord.cost')}
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">{t('common.edit')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRecords.map((record, index) => {
                const recordVehicleId = record.vehicleId || record.VehicleId || record.vehicle_id;
                const recordVehicleVin = record.vehicleVin || record.vehicle_vin;
                const inlineVehicle =
                  record.Vehicle || record.vehicles || record.vehicle || null;
                const vehicle = vehicles.find(v => {
                  if (recordVehicleId) return v.id?.toString() === recordVehicleId?.toString();
                  if (recordVehicleVin) return v.vin === recordVehicleVin;
                  return false;
                });
                const resolvedVehicle = vehicle || inlineVehicle;
                const vehicleVin =
                  resolvedVehicle?.vin ||
                  recordVehicleVin ||
                  record.vehicle_vin ||
                  record.vehicleVin;
                const serviceDate = record.serviceDate || record.service_date;
                const formattedServiceDate = serviceDate
                  ? dayjs(serviceDate).isValid()
                    ? dayjs(serviceDate).format('DD.MM.YYYY')
                    : t('common.notAvailable')
                  : t('common.notAvailable');
                return (
                  <TableRow key={record.id || `record-${index}`}>
                    <TableCell component="th" scope="row">
                      {formattedServiceDate}
                    </TableCell>
                    {!filteredVehicleId && (
                      <TableCell>
                        {(() => {
                          return resolvedVehicle ? (
                            <Link to={`/vehicles/${vehicleVin || ''}`}>
                              {resolvedVehicle.brand || resolvedVehicle.make}{' '}
                              {resolvedVehicle.model}{' '}
                              {resolvedVehicle.year ? `(${resolvedVehicle.year})` : ''}
                            </Link>
                          ) : (
                            <span style={{color: 'red'}}>{t('vehicle.notFound', 'Авто не знайдено')}</span>
                          );
                        })()}
                      </TableCell>
                    )}
                    <TableCell>{record.serviceName || record.serviceType || record.service_type}</TableCell>
                    <TableCell>{record.mileage ? `${record.mileage} km` : t('common.notAvailable')}</TableCell>
                    <TableCell>{record.performedBy || record.performed_by}</TableCell>
                    <TableCell>{record.cost || t('common.notAvailable')}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        component={Link}
                        to={`/service-records/${record.id}`}
                      >
                        {t('common.edit')}
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

export default ServiceRecords;
