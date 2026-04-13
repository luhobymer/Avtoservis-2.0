import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  Alert,
  Box,
  Tabs,
  Tab,
  Skeleton
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
  const navigate = useNavigate();
  const { user, isMaster } = useAuth();
  const isMasterUser = typeof isMaster === 'function' ? isMaster() : false;

  const withRetry = useCallback(async (fn, options = {}) => {
    const retries = typeof options.retries === 'number' ? options.retries : 2;
    const baseDelayMs = typeof options.baseDelayMs === 'number' ? options.baseDelayMs : 500;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        const message = String(err?.message || '');
        const maybeTransient =
          message.includes('NetworkError') ||
          message.includes('Failed to fetch') ||
          message.includes('timeout') ||
          message.includes('502') ||
          message.includes('503') ||
          message.includes('504');
        const shouldRetry = attempt < retries && maybeTransient;
        if (!shouldRetry) throw err;
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    return undefined;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [userRows, vehiclesRows, adminRows] = await withRetry(async () => {
        const promises = [
          user?.id ? listAppointmentsForUser(user.id) : Promise.resolve([]),
          listVehicles()
        ];
        promises.push(isMasterUser ? listAdminAppointments() : Promise.resolve([]));
        return Promise.all(promises);
      });
      
      setAppointments(Array.isArray(userRows) ? userRows : []);
      setVehicles(Array.isArray(vehiclesRows) ? vehiclesRows : []);
      
      if (isMasterUser) {
        setAdminAppointments(Array.isArray(adminRows) ? adminRows : []);
        if ((userRows || []).length === 0 && (adminRows || []).length > 0) {
          setTabValue(1);
        }
      } else {
        setAdminAppointments([]);
      }
    } catch (err) {
      setError(err?.message || t('errors.failedToLoadAppointments'));
    } finally {
      setLoading(false);
    }
  }, [isMasterUser, t, user?.id, withRetry]);

  useEffect(() => {
    fetchData();
  }, [fetchData, location.key]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
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
      case 'canceled':
        return 'error';
      case 'scheduled':
        return 'warning';
      case 'in-progress':
        return 'warning';
      default:
        return 'default';
    }
  };

  const currentList = isMasterUser && tabValue === 1 ? adminAppointments : appointments;
  const skeletonRows = useMemo(() => Array.from({ length: 7 }, (_, i) => i), []);

  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={fetchData}>
              {t('common.retry', 'Повторити')}
            </Button>
          }
        >
          {error}
        </Alert>
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
          disabled={loading}
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

      {loading ? (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: { xs: 0, sm: 650 } }}>
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
              {skeletonRows.map((key) => (
                <TableRow key={key}>
                  <TableCell><Skeleton width={140} /></TableCell>
                  <TableCell><Skeleton width={220} /></TableCell>
                  <TableCell><Skeleton width={160} /></TableCell>
                  <TableCell><Skeleton width={90} /></TableCell>
                  <TableCell><Skeleton width={120} /></TableCell>
                  <TableCell><Skeleton width={160} /></TableCell>
                  <TableCell align="right"><Skeleton width={60} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : currentList.length === 0 ? (
        <Alert severity="info">
          {tabValue === 0 
            ? t('appointment.noAppointments', 'У вас ще немає записів на обслуговування') 
            : t('appointment.noWorkAppointments', 'У вас немає робочих записів')}
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: { xs: 0, sm: 650 } }}>
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
                <TableRow 
                  key={appointment.id} 
                  hover 
                  onClick={() => {
                     // We can navigate, but we need to ensure we don't interfere with button clicks
                     // However, MUI TableRow onClick is fine if buttons stopPropagation.
                     // Or just navigate.
                     // But wait, the edit button is also a Link.
                     // Let's use useNavigate.
                  }}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell component="th" scope="row" onClick={() => navigate(`/appointments/${appointment.id}`)}>
                    {(appointment.scheduledDate || appointment.scheduled_time) ? 
                      format(new Date(appointment.scheduledDate || appointment.scheduled_time), 'dd.MM.yyyy HH:mm') : 
                      t('common.notAvailable')}
                  </TableCell>
                  <TableCell onClick={() => navigate(`/appointments/${appointment.id}`)}>
                    {(() => {
                      // Try to find vehicle in loaded list (for personal appointments)
                      // For admin appointments, we might need vehicle info from the appointment object itself if not in 'vehicles' list
                      let vehicle = vehicles.find(v => v.vin === appointment.vehicle_vin);
                      
                      // Fallback if vehicle info is embedded in appointment (common in some admin APIs) or just show VIN
                      const vehicleInfo = vehicle 
                        ? `${vehicle.brand || vehicle.make} ${vehicle.model} (${vehicle.year})`
                        : (appointment.vehicle_vin || t('common.notAvailable'));

                      return (
                        <span>{vehicleInfo}</span>
                      );
                    })()}
                  </TableCell>
                  <TableCell onClick={() => navigate(`/appointments/${appointment.id}`)}>{appointment.serviceType || appointment.service_type || t('common.notAvailable')}</TableCell>
                  <TableCell onClick={() => navigate(`/appointments/${appointment.id}`)}>
                    <Chip 
                      label={t(`appointment.statuses.${appointment.status || 'pending'}`)}
                      color={getStatusChipColor(appointment.status || 'pending')}
                      size="small"
                    />
                  </TableCell>
                  <TableCell onClick={() => navigate(`/appointments/${appointment.id}`)}>
                    {(appointment.estimatedCompletionDate || appointment.estimated_completion_date) ? 
                      format(new Date(appointment.estimatedCompletionDate || appointment.estimated_completion_date), 'dd.MM.yyyy') : 
                      t('common.notAvailable')}
                  </TableCell>
                  <TableCell onClick={() => navigate(`/appointments/${appointment.id}`)}>
                    {(appointment.actualCompletionDate || appointment.actual_completion_date) ? 
                      format(new Date(appointment.actualCompletionDate || appointment.actual_completion_date), 'dd.MM.yyyy HH:mm') : 
                      t('common.notAvailable')}
                  </TableCell>
                  <TableCell align="right">
                    <Button 
                      size="small" 
                      component={Link} 
                      to={`/appointments/${appointment.id}`}
                      onClick={(e) => e.stopPropagation()}
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
