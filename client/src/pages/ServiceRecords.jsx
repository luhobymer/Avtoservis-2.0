import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as serviceRecordsDao from '../api/dao/serviceRecordsDao';
import * as vehiclesDao from '../api/dao/vehiclesDao';
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
import { format } from 'date-fns';
import ServiceBookExport from '../components/ServiceBookExport';

const ServiceRecords = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const vehicleIdParam = queryParams.get('vehicleId');
  
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
        const [recordsList, vehiclesList] = await Promise.all([
          serviceRecordsDao.listAdmin(),
          vehiclesDao.list()
        ]);
        let filteredRecords = recordsList;
        if (filteredVehicleId) {
          filteredRecords = filteredRecords.filter(record => 
            record.VehicleId?.toString() === filteredVehicleId || record.vehicle_id?.toString() === filteredVehicleId
          );
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
  }, [filteredVehicleId, t]);

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

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {t('serviceRecord.title')}
          {filteredVehicleId && records.length > 0 && (records[0].Vehicle || records[0].vehicles) && (
            <Typography component="span" variant="subtitle1" sx={{ ml: 2 }}>
              - {records[0].Vehicle?.make || records[0].vehicles?.brand} {records[0].Vehicle?.model || records[0].vehicles?.model} ({records[0].Vehicle?.licensePlate || records[0].vehicles?.license_plate})
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
            to={filteredVehicleId ? `/service-records/new?vehicle_vin=${filteredVehicleId}` : '/service-records/new'} 
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
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell component="th" scope="row">
                    {format(new Date(record.serviceDate || record.service_date), 'dd.MM.yyyy')}
                  </TableCell>
                  {!filteredVehicleId && (
                    <TableCell>
                      {(() => {
                        const vehicle = vehicles.find(v => {
                          if (record.VehicleId) return v.id === record.VehicleId;
                          if (record.vehicle_id) return v.id === record.vehicle_id;
                          if (record.vehicle_vin) return v.vin === record.vehicle_vin;
                          return false;
                        });
                        return vehicle ? (
                          <Link to={`/vehicles/${vehicle.id}`}>
                            {vehicle.brand || vehicle.make} {vehicle.model} ({vehicle.year})
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
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
};

export default ServiceRecords;
