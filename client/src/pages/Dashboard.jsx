import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import * as vehiclesDao from '../api/dao/vehiclesDao';
import * as appointmentsDao from '../api/dao/appointmentsDao';
import * as serviceRecordsDao from '../api/dao/serviceRecordsDao';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  DirectionsCar as CarIcon,
  EventNote as AppointmentIcon,
  Build as ServiceIcon
} from '@mui/icons-material';
import { format } from 'date-fns';

const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [serviceRecords, setServiceRecords] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!user || !user.id) {
          setLoading(false);
          setError(t('errors.unauthorized', 'Будь ласка, увійдіть в систему для перегляду даних.'));
          return;
        }
        const [vehiclesList, appointmentsList, serviceRecordsList] = await Promise.all([
          vehiclesDao.listForUser(user.id),
          appointmentsDao.listForUser(user.id),
          serviceRecordsDao.listForUser(user.id)
        ]);
        setVehicles(Array.isArray(vehiclesList) ? vehiclesList : []);
        const normalizedAppointments = (appointmentsList || []).map(a => ({
          id: a.id,
          vehicleVin: a.vehicle_vin,
          serviceId: a.serviceId || null,
          serviceType: a.serviceType,
          serviceName: a.serviceName || null,
          scheduledTime: a.scheduledDate,
          status: a.status,
          notes: a.notes || ''
        }));
        const upcomingAppointments = normalizedAppointments
          .filter(app => app.status !== 'completed' && app.status !== 'cancelled')
          .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime))
          .slice(0, 3);
        setAppointments(upcomingAppointments);
        const normalizedServiceRecords = (serviceRecordsList || []).map(r => ({
          id: r.id,
          vehicleId: r.vehicleId || r.VehicleId,
          serviceId: r.serviceId || null,
          serviceType: r.serviceType,
          serviceName: r.serviceName || null,
          serviceDetails: r.description || r.serviceDetails || '',
          serviceDate: r.serviceDate,
          mileage: r.mileage,
          cost: r.cost
        }));
        const recentServiceRecords = normalizedServiceRecords
          .filter(r => r.serviceDate)
          .sort((a, b) => new Date(b.serviceDate) - new Date(a.serviceDate))
          .slice(0, 3);
        setServiceRecords(recentServiceRecords);

      } catch (error) {
        setError(error?.message || t('errors.unknownError', 'Виникла невідома помилка. Спробуйте пізніше.'));
      } finally {
        setLoading(false);
      }
    };
    if (user && user.id) fetchDashboardData();
  }, [user, t]);

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
      <Typography variant="h4" gutterBottom>
        {t('dashboard.title')}
      </Typography>
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" color="text.secondary">
          {t('dashboard.greeting', 'Вітаємо,')} {user?.name || user?.email}
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Paper
            elevation={3}
            sx={{
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <CarIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="subtitle1">
                {t('dashboard.vehicleStatus')}
              </Typography>
            </Box>
            <Typography variant="h5">
              {vehicles.length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper
            elevation={3}
            sx={{
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <AppointmentIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="subtitle1">
                {t('dashboard.upcomingAppointments')}
              </Typography>
            </Box>
            <Typography variant="h5">
              {appointments.length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper
            elevation={3}
            sx={{
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <ServiceIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="subtitle1">
                {t('dashboard.recentServiceRecords')}
              </Typography>
            </Box>
            <Typography variant="h5">
              {serviceRecords.length}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Vehicle Status */}
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              {t('dashboard.vehicleStatus')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {vehicles.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('vehicle.noVehicles')}
              </Typography>
            ) : (
              <List>
                {vehicles.map((vehicle, index) => (
                  <ListItem 
                    key={vehicle.id || `vehicle-${index}`} 
                    component={Link} 
                    to={`/vehicles/${vehicle.vin}`} 
                    sx={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <ListItemText 
                      primary={vehicle.make && vehicle.model ? 
                        `${vehicle.make} ${vehicle.model} (${vehicle.year || t('common.notAvailable')})` : 
                        t('common.notAvailable')
                      }
                      secondary={
                        <Typography variant="body2" color="text.secondary">
                          {vehicle.licensePlate ? 
                            `${t('vehicle.licensePlate')}: ${vehicle.licensePlate}` : 
                            t('common.notAvailable')
                          }
                          {vehicle.vin && (
                            <>
                              <br />
                              VIN: {vehicle.vin}
                            </>
                          )}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
            
            <Box sx={{ mt: 2 }}>
              <Button 
                component={Link} 
                to="/vehicles"
                variant="outlined" 
                size="small"
              >
                {t('vehicle.title')}
              </Button>
            </Box>
          </Paper>
        </Grid>
        
        {/* Upcoming Appointments */}
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              {t('dashboard.upcomingAppointments')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {appointments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('appointment.noAppointments')}
              </Typography>
            ) : (
              <List>
                {appointments.map((appointment, index) => {
  // Пошук авто по VIN або ID
  const vehicle = vehicles.find(v => 
    (appointment.vehicleVin && v.vin === appointment.vehicleVin) || 
    (appointment.vehicleId && v.id === appointment.vehicleId)
  );
  
  return (
    <ListItem
      key={appointment.id || index}
      component={Link}
      to={`/appointments/${appointment.id || index}`}
      sx={{ textDecoration: 'none', color: 'inherit' }}
    >
      <ListItemText
        primary={appointment.serviceName || appointment.serviceType || t('common.notAvailable')}
        secondary={
          <React.Fragment>
            <Typography variant="body2" color="text.secondary">
              {appointment.scheduledTime ? format(new Date(appointment.scheduledTime), 'PPpp') : t('common.notAvailable')}
            </Typography>
            <Typography variant="body2" color={vehicle ? "text.secondary" : "error"}>
              {vehicle ? 
                `${vehicle.make} ${vehicle.model} (${vehicle.year})` : 
                t('vehicle.notFound', 'Авто не знайдено')
              }
            </Typography>
          </React.Fragment>
        }
      />
    </ListItem>
  );
})}
              </List>
            )}
            
            <Box sx={{ mt: 2 }}>
              <Button 
                component={Link} 
                to="/appointments"
                variant="outlined" 
                size="small"
                sx={{ mr: 1 }}
              >
                {t('appointment.title')}
              </Button>
              <Button 
                component={Link} 
                to="/appointments/schedule"
                variant="contained" 
                size="small"
              >
                {t('appointment.schedule')}
              </Button>
            </Box>
          </Paper>
        </Grid>
        
        {/* Recent Service Records */}
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              {t('dashboard.recentServiceRecords')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {serviceRecords.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('serviceRecord.noRecords')}
              </Typography>
            ) : (
              <List>
                {serviceRecords.map((record, index) => {
  // Пошук авто по VIN або ID
  const vehicle = vehicles.find(v => 
    (record.vehicleVin && v.vin === record.vehicleVin) || 
    (record.vehicleId && v.id === record.vehicleId)
  );
  
  return (
    <ListItem
      key={record.id || `service-record-${index}`}
      component={Link}
      to={`/service-records/${record.id || index}`}
      sx={{ textDecoration: 'none', color: 'inherit' }}
    >
      <ListItemText
        primary={record.serviceName || record.serviceType || t('common.notAvailable')}
        secondary={
          <React.Fragment>
            <Typography variant="body2" color="text.secondary">
              {record.serviceDetails && (
                <>
                  {record.serviceDetails.length > 50 ? 
                    `${record.serviceDetails.substring(0, 50)}...` : 
                    record.serviceDetails
                  }
                  <br />
                </>
              )}
              {record.serviceDate ? 
                format(new Date(record.serviceDate), 'dd.MM.yyyy') : 
                t('common.notAvailable')
              }
            </Typography>
            <Typography variant="body2" color={vehicle ? "text.secondary" : "error"}>
              {vehicle ? 
                `${vehicle.make} ${vehicle.model} (${vehicle.year})` : 
                t('vehicle.notFound', 'Авто не знайдено')
              }
            </Typography>
          </React.Fragment>
        }
      />
    </ListItem>
  );
})}
              </List>
            )}
            
            <Box sx={{ mt: 2 }}>
              <Button 
                component={Link} 
                to="/service-records"
                variant="outlined" 
                size="small"
              >
                {t('serviceRecord.title')}
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

    </Container>
  );
};

export default Dashboard;
