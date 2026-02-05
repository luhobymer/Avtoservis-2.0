import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Box,
  Divider,
  Card,
  CardContent,
  CardHeader,
  Chip
} from '@mui/material';
import {
  PeopleOutline as PeopleIcon,
  DirectionsCar as CarIcon,
  Build as ServiceIcon,
  EventNote as AppointmentIcon
} from '@mui/icons-material';
import * as usersDao from '../../api/dao/usersDao';
import * as vehiclesDao from '../../api/dao/vehiclesDao';
import * as appointmentsDao from '../../api/dao/appointmentsDao';
import * as serviceRecordsDao from '../../api/dao/serviceRecordsDao';

const DashboardStats = () => {
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    userCount: 0,
    vehicleCount: 0,
    appointmentCount: 0,
    serviceRecordCount: 0,
    appointmentsByStatus: {},
    recentAppointments: [],
    recentServiceRecords: []
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const [users, vehicles, appointments, serviceRecords] = await Promise.all([
        usersDao.list(),
        vehiclesDao.list(),
        appointmentsDao.listAdmin(),
        serviceRecordsDao.listAdmin()
      ]);

      const userCount = Array.isArray(users) ? users.length : 0;
      const vehicleCount = Array.isArray(vehicles) ? vehicles.length : 0;
      const appointmentCount = Array.isArray(appointments) ? appointments.length : 0;
      const serviceRecordCount = Array.isArray(serviceRecords) ? serviceRecords.length : 0;

      const appointmentsByStatus = {};
      (appointments || []).forEach(a => {
        const status = a.status || 'unknown';
        appointmentsByStatus[status] = (appointmentsByStatus[status] || 0) + 1;
      });

      const recentAppointments = (appointments || []).slice(0, 5);
      const recentServiceRecords = (serviceRecords || []).slice(0, 5);

      setStats({
        userCount,
        vehicleCount,
        appointmentCount,
        serviceRecordCount,
        appointmentsByStatus,
        recentAppointments,
        recentServiceRecords
      });
    } catch (err) {
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
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
        return 'warning';
      case 'in-progress':
        return 'warning';
      default:
        return 'default';
    }
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
        {t('admin.dashboard')}
      </Typography>
      <Divider sx={{ mb: 3 }} />
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {/* Summary Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PeopleIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6" component="div">
                  {t('admin.users')}
                </Typography>
              </Box>
              <Typography variant="h4" component="div">
                {stats.userCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CarIcon color="secondary" sx={{ mr: 1 }} />
                <Typography variant="h6" component="div">
                  {t('admin.vehicles')}
                </Typography>
              </Box>
              <Typography variant="h4" component="div">
                {stats.vehicleCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AppointmentIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6" component="div">
                  {t('admin.appointments')}
                </Typography>
              </Box>
              <Typography variant="h4" component="div">
                {stats.appointmentCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ServiceIcon color="secondary" sx={{ mr: 1 }} />
                <Typography variant="h6" component="div">
                  {t('admin.serviceRecords')}
                </Typography>
              </Box>
              <Typography variant="h4" component="div">
                {stats.serviceRecordCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Appointment Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title={t('admin.appointmentsByStatus')} />
            <CardContent>
              <Grid container spacing={1}>
                {Object.entries(stats.appointmentsByStatus || {}).map(([status, count]) => (
                  <Grid item key={status}>
                    <Chip 
                      label={`${t(`appointment.statuses.${status}`)}: ${count}`}
                      color={getStatusChipColor(status)}
                    />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title={t('admin.recentActivity')} />
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                {t('admin.recentAppointments')}
              </Typography>
              {stats.recentAppointments && stats.recentAppointments.length > 0 ? (
                stats.recentAppointments.map((appointment, index) => (
                  <Box key={index} sx={{ mb: 1 }}>
                    <Typography variant="body2">
                      {appointment.serviceName || appointment.serviceType || t('common.notAvailable')} - 
                      <Chip 
                        label={t(`appointment.statuses.${appointment.status}`)}
                        color={getStatusChipColor(appointment.status)}
                        size="small"
                      />
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography variant="body2">{t('appointment.noAppointments')}</Typography>
              )}
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="subtitle2" gutterBottom>
                {t('admin.recentServiceRecords')}
              </Typography>
              {stats.recentServiceRecords && stats.recentServiceRecords.length > 0 ? (
                stats.recentServiceRecords.map((record, index) => (
                  <Box key={index} sx={{ mb: 1 }}>
                    <Typography variant="body2">
                      {record.serviceType} - {record.mileage} km
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography variant="body2">{t('serviceRecord.noRecords')}</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default DashboardStats;
