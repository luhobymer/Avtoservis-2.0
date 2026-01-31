import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useAuth from '../context/useAuth';
import * as appointmentsDao from '../api/dao/appointmentsDao';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Divider,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert
} from '@mui/material';
import dayjs from 'dayjs';

const MasterDashboard = () => {
  const { t } = useTranslation();
  const { user, isMaster } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);

  useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!user || !user.id) {
          setError(t('errors.unauthorized', 'Будь ласка, увійдіть в систему для перегляду даних.'));
          return;
        }
        if (typeof isMaster !== 'function' || !isMaster()) {
          setError(t('errors.forbidden', 'У вас немає прав для перегляду цих даних.'));
          return;
        }
        const adminAppointments = await appointmentsDao.listAdmin();
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const today = (adminAppointments || []).filter(a => {
          if (!a.scheduledDate) return false;
          const d = new Date(a.scheduledDate);
          return d >= startOfToday && d < endOfToday;
        });
        const upcoming = (adminAppointments || [])
          .filter(a => {
            if (!a.scheduledDate) return false;
            const d = new Date(a.scheduledDate);
            return d >= endOfToday && a.status !== 'completed' && a.status !== 'cancelled';
          })
          .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
          .slice(0, 8);
        setTodayAppointments(today);
        setUpcomingAppointments(upcoming);
      } catch (err) {
        setError(err?.message || t('errors.unknownError', 'Виникла невідома помилка. Спробуйте пізніше.'));
      } finally {
        setLoading(false);
      }
    };
    fetchAppointments();
  }, [user, t, isMaster]);

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
        {t('dashboard.masterPanelTitle', 'Панель майстра')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('dashboard.masterPanelSubtitle', 'Сьогоднішні та майбутні записи на обслуговування')}
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              {t('dashboard.masterTodayAppointments', 'Записи на сьогодні')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {todayAppointments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('dashboard.noAppointmentsToday', 'На сьогодні записів немає')}
              </Typography>
            ) : (
              <List>
                {todayAppointments.map((appointment) => (
                  <ListItem
                    key={appointment.id}
                    component={Link}
                    to={`/appointments/${appointment.id}`}
                    sx={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <ListItemText
                      primary={
                        appointment.serviceName ||
                        appointment.serviceType ||
                        t('common.notAvailable')
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {appointment.scheduledDate
                              ? dayjs(appointment.scheduledDate).format('DD.MM.YYYY HH:mm')
                              : t('common.notAvailable')}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {appointment.status ? t(`appointment.statuses.${appointment.status}`) : ''}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              {t('dashboard.masterUpcomingAppointments', 'Майбутні записи')}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {upcomingAppointments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {t('dashboard.noUpcomingAppointments', 'Запланованих записів немає')}
              </Typography>
            ) : (
              <List>
                {upcomingAppointments.map((appointment) => (
                  <ListItem
                    key={appointment.id}
                    component={Link}
                    to={`/appointments/${appointment.id}`}
                    sx={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <ListItemText
                      primary={
                        appointment.serviceName ||
                        appointment.serviceType ||
                        t('common.notAvailable')
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {appointment.scheduledDate
                              ? dayjs(appointment.scheduledDate).format('DD.MM.YYYY HH:mm')
                              : t('common.notAvailable')}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {appointment.status ? t(`appointment.statuses.${appointment.status}`) : ''}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default MasterDashboard;
