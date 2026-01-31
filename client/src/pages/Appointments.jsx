import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import { listForUser as listAppointmentsForUser } from '../api/dao/appointmentsDao';
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
  Box
} from '@mui/material';
import { format } from 'date-fns';

const Appointments = () => {
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [rows, vehiclesRows] = await Promise.all([
          user?.id ? listAppointmentsForUser(user.id) : Promise.resolve([]),
          listVehicles()
        ]);
        setAppointments(rows);
        setVehicles(vehiclesRows);
      } catch (err) {
        setError(err.message || t('errors.failedToLoadAppointments'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [location.key, user?.id, t]);

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

      {appointments.length === 0 ? (
        <Alert severity="info">{t('appointment.noAppointments')}</Alert>
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
              {appointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell component="th" scope="row">
                    {(appointment.scheduledDate || appointment.scheduled_time) ? 
                      format(new Date(appointment.scheduledDate || appointment.scheduled_time), 'dd.MM.yyyy HH:mm') : 
                      t('common.notAvailable')}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const vehicle = vehicles.find(v => v.vin === appointment.vehicle_vin);
                      return vehicle ? (
                        <Link to={`/vehicles/${vehicle.vin}`}>
                          {vehicle.brand || vehicle.make} {vehicle.model} ({vehicle.year})
                        </Link>
                      ) : (
                        <span style={{color: 'red'}}>{t('vehicle.notFound', 'Авто не знайдено')}</span>
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
