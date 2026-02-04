import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import { listForUser as listAppointmentsForUser, listAdmin as listAdminAppointments } from '../api/dao/appointmentsDao';
import { list as listVehicles } from '../api/dao/vehiclesDao';
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
  Chip,
  CircularProgress,
  Alert,
  Box,
  Tabs,
  Tab
} from '@mui/material';
import { format } from 'date-fns';

const Appointments = () => {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState([]);
  const [adminAppointments, setAdminAppointments] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);

  const location = useLocation();
  const { user, isMaster } = useAuth();
  const isMasterUser = typeof isMaster === 'function' ? isMaster() : false;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const promises = [
          user?.id ? listAppointmentsForUser(user.id) : Promise.resolve([]),
          listVehicles()
        ];
        
        if (isMasterUser) {
          promises.push(listAdminAppointments());
        } else {
          promises.push(Promise.resolve([]));
        }

        const [userRows, vehiclesRows, adminRows] = await Promise.all(promises);
        
        setAppointments(userRows);
        setVehicles(vehiclesRows);
        
        if (isMasterUser) {
          // Filter admin appointments for the current mechanic if needed, or show all
          // For now, showing all for master/admin
          // If we want to show only assigned to this mechanic:
          // const myWork = adminRows.filter(a => a.mechanic_id === user.id); // Assuming mechanic_id matches user.id
          setAdminAppointments(adminRows);
          // Default to work tab if no personal appointments but have work appointments
          if (userRows.length === 0 && adminRows.length > 0) {
             setTabValue(1);
          }
        }
      } catch (err) {
        setError(err.message || t('errors.failedToLoadAppointments'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [location.key, user?.id, t, isMasterUser]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const getStatusChipColor = (status) => {
    switch (status) {
      case 'pending':
        return 'primary';
      case 'confirmed':
        return 'warning';
      case 'scheduled':
        return 'primary';
      case 'in-progress':
        return 'warning';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      case 'canceled':
        return 'error';
      default:
        return 'default';
    }
  };

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

  const currentList = isMasterUser && tabValue === 1 ? adminAppointments : appointments;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {t('appointment.title')}
        </Typography>
        <Button 
          component={Link} 
          to="/appointments/schedule" 
          variant="contained" 
          color="primary"
        >
          {t('appointment.schedule')}
        </Button>
      </Box>

      {isMasterUser && (
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="appointment tabs">
            <Tab label={t('dashboard.myAppointments', 'Мої записи')} />
            <Tab label={t('dashboard.workSchedule', 'Робочий графік')} />
          </Tabs>
        </Box>
      )}

      {currentList.length === 0 ? (
        <Alert severity="info">
          {tabValue === 0 
            ? t('appointment.noAppointments', 'У вас ще немає записів на обслуговування') 
            : t('appointment.noWorkAppointments', 'У вас немає робочих записів')}
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  <TableCell>{t('appointment.scheduledDate')}</TableCell>
                  <TableCell>{t('vehicle.title')}</TableCell>
                  <TableCell>{t('appointment.serviceType')}</TableCell>
                  <TableCell>{t('appointment.status')}</TableCell>
                  <TableCell>{t('appointment.estimatedCompletionDate')}</TableCell>
                  <TableCell>{t('appointment.actualCompletionDate', 'Фактичне завершення')}</TableCell>
                  <TableCell align="right">{t('common.edit')}</TableCell>
                </TableRow>
              </TableHead>
            <TableBody>
              {currentList.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell component="th" scope="row">
                    {(appointment.scheduledDate || appointment.scheduled_time) ? 
                      format(new Date(appointment.scheduledDate || appointment.scheduled_time), 'dd.MM.yyyy HH:mm') : 
                      t('common.notAvailable')}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      // Try to find vehicle in loaded list (for personal appointments)
                      // For admin appointments, we might need vehicle info from the appointment object itself if not in 'vehicles' list
                      let vehicle = vehicles.find(v => v.vin === appointment.vehicle_vin);
                      
                      // Fallback if vehicle info is embedded in appointment (common in some admin APIs) or just show VIN
                      const vehicleInfo = vehicle 
                        ? `${vehicle.brand || vehicle.make} ${vehicle.model} (${vehicle.year})`
                        : (appointment.vehicle_vin || t('common.notAvailable'));

                      return vehicle ? (
                        <Link to={`/vehicles/${vehicle.vin}`}>
                          {vehicleInfo}
                        </Link>
                      ) : (
                        <span>{vehicleInfo}</span>
                      );
                    })()}
                  </TableCell>
                  <TableCell>{appointment.serviceType || appointment.service_type || t('common.notAvailable')}</TableCell>
                  <TableCell>
                    <Chip 
                      label={t(`appointment.statuses.${appointment.status || 'pending'}`)}
                      color={getStatusChipColor(appointment.status || 'pending')}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {(appointment.estimatedCompletionDate || appointment.estimated_completion_date) ? 
                      format(new Date(appointment.estimatedCompletionDate || appointment.estimated_completion_date), 'dd.MM.yyyy') : 
                      t('common.notAvailable')}
                  </TableCell>
                  <TableCell>
                    {(appointment.actualCompletionDate || appointment.actual_completion_date) ? 
                      format(new Date(appointment.actualCompletionDate || appointment.actual_completion_date), 'dd.MM.yyyy HH:mm') : 
                      t('common.notAvailable')}
                  </TableCell>
                  <TableCell align="right">
                    <Button 
                      size="small" 
                      component={Link} 
                      to={`/appointments/${appointment.id}`}
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

export default Appointments;
