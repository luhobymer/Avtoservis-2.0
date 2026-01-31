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
  
} from '@mui/material';
import dayjs from 'dayjs';
import ServiceBookExport from '../components/ServiceBookExport';

const ServiceRecords = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const vehicleIdParam = queryParams.get('vehicleId');
  const { user } = useAuth();
  
  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filteredVehicleId] = useState(vehicleIdParam || null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!user || !user.id) {
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
          serviceRecordsDao.listForUser(user.id),
          vehiclesDao.listForUser(user.id)
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
  }, [filteredVehicleId, t, user]);

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

  const headerVehicle =
    records[0]?.Vehicle || records[0]?.vehicles || records[0]?.vehicle || null;
  const selectedVehicle =
    filteredVehicleId ? vehicles.find(v => v.id?.toString() === filteredVehicleId) : null;
  const headerVehicleLabel = headerVehicle
    ? `${headerVehicle.make || headerVehicle.brand || ''} ${headerVehicle.model || ''} (${
        headerVehicle.licensePlate || headerVehicle.license_plate || ''
      })`.trim()
    : null;

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
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('serviceRecord.serviceDate')}</TableCell>
                {!filteredVehicleId && <TableCell>{t('vehicle.title')}</TableCell>}
                <TableCell>{t('serviceRecord.serviceType')}</TableCell>
                <TableCell>{t('serviceRecord.mileage')}</TableCell>
                <TableCell>{t('serviceRecord.performedBy')}</TableCell>
                <TableCell>{t('serviceRecord.cost')}</TableCell>
                <TableCell align="right">{t('common.edit')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((record, index) => {
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
