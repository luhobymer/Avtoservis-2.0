import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Box,
  Typography,
  Grid,
  Paper,
  Chip,
  Button,
  Divider,
  CircularProgress,
  Alert,
  Stack,
  Switch,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  EventNote as EventNoteIcon,
  AccessTime as AccessTimeIcon,
  Notifications as NotificationsIcon,
  History as HistoryIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { useAuth } from '../context/useAuth';
import * as appointmentsDao from '../api/dao/appointmentsDao';
import * as scheduleDao from '../api/dao/scheduleDao';
import { getCurrent as getCurrentMechanic } from '../api/dao/mechanicsDao';
import { addMinutes, format } from 'date-fns';

const MasterDashboard = () => {
  const { t } = useTranslation();
  const { user, isMaster } = useAuth();
  const isMasterUser = typeof isMaster === 'function' ? isMaster() : false;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [mechanicProfile, setMechanicProfile] = useState(null);
  const [busyStatus, setBusyStatus] = useState(null);
  const [busyDialogOpen, setBusyDialogOpen] = useState(false);
  const [busyUntilDraft, setBusyUntilDraft] = useState(new Date(new Date().getTime() + 60 * 60 * 1000));
  const [busyReasonDraft, setBusyReasonDraft] = useState('');
  const [savingBusy, setSavingBusy] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');

  useEffect(() => {
    const run = async () => {
      if (!user || !user.id || !isMasterUser) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const currentMechanic = await getCurrentMechanic();
        if (!currentMechanic?.id) {
          throw new Error(t('errors.mechanicProfileNotFound', 'Профіль механіка не знайдено'));
        }
        setMechanicProfile(currentMechanic);

        const [rows, status, adminRows] = await Promise.all([
          appointmentsDao.listForMechanic(currentMechanic.id),
          scheduleDao.getMasterBusyStatus(currentMechanic.id),
          appointmentsDao.listAdmin().catch(() => [])
        ]);
        let list = Array.isArray(rows) ? rows : [];
        if (list.length === 0) {
          try {
            const mechanicIdText = String(currentMechanic.id);
            const adminList = Array.isArray(adminRows) ? adminRows : [];
            const filtered = adminList.filter((a) => {
              const rawMechanicId = a.mechanic_id ?? a.mechanicId ?? a.mechanics?.id ?? null;
              return rawMechanicId != null && String(rawMechanicId) === mechanicIdText;
            });
            list = filtered.length > 0 ? filtered : adminList;
          } catch (_) {
            void _;
          }
        }
        setAppointments(list);
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const today = list
          .filter((a) => {
            if (!a.scheduledDate) return false;
            const d = new Date(a.scheduledDate);
            return d >= startOfToday && d < endOfToday;
          })
          .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
        const upcoming = list
          .filter((a) => {
            if (!a.scheduledDate) return false;
            const d = new Date(a.scheduledDate);
            return d >= endOfToday && a.status !== 'completed' && a.status !== 'cancelled';
          })
          .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
          .slice(0, 5);
        setTodayAppointments(today);
        setUpcomingAppointments(upcoming);
        setBusyStatus(status);
        if (status && status.busy_until) {
          setBusyUntilDraft(new Date(status.busy_until));
        }
        if (status && status.busy_reason) {
          setBusyReasonDraft(status.busy_reason);
        }
      } catch (err) {
        setError(err?.message || t('errors.unknownError', 'Виникла помилка під час завантаження даних'));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user, isMasterUser, t]);

  const getAppointmentEnd = (appointment) => {
    if (!appointment?.scheduledDate) return null;
    const start = new Date(appointment.scheduledDate);
    if (!(start instanceof Date) || Number.isNaN(start.getTime())) return null;
    const durationMinutesRaw =
      appointment.appointmentDuration != null
        ? Number(appointment.appointmentDuration)
        : appointment.serviceDuration != null
          ? Number(appointment.serviceDuration)
          : null;
    const durationMinutes = Number.isFinite(durationMinutesRaw) && durationMinutesRaw > 0 ? durationMinutesRaw : 60;
    return addMinutes(start, durationMinutes);
  };

  const derivedBusyFromAppointments = useMemo(() => {
    const now = new Date();
    const activeStatuses = new Set(['confirmed', 'in_progress']);
    const candidates = (Array.isArray(appointments) ? appointments : [])
      .filter((a) => activeStatuses.has(a.status))
      .map((a) => {
        const start = a?.scheduledDate ? new Date(a.scheduledDate) : null;
        const end = getAppointmentEnd(a);
        return { a, start, end };
      })
      .filter(({ start, end }) => start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()));

    const current = candidates.find(({ start, end }) => now >= start && now <= end);
    if (!current) return null;
    return {
      is_busy: true,
      busy_until: current.end.toISOString(),
      busy_reason: ''
    };
  }, [appointments]);

  const effectiveBusyStatus = useMemo(() => {
    const base = busyStatus && typeof busyStatus === 'object' ? busyStatus : null;
    const now = new Date();
    const serverBusyUntil = base?.busy_until ? new Date(base.busy_until) : null;
    const hasServerBusyUntil =
      serverBusyUntil instanceof Date && !Number.isNaN(serverBusyUntil.getTime()) && serverBusyUntil > now;

    if (base?.is_busy && hasServerBusyUntil) return base;
    return derivedBusyFromAppointments || base || { is_busy: false, busy_until: null, busy_reason: '' };
  }, [busyStatus, derivedBusyFromAppointments]);

  const busyAppointmentOptions = useMemo(() => {
    const now = new Date();
    return (Array.isArray(appointments) ? appointments : [])
      .filter((a) => a?.scheduledDate)
      .map((a) => ({ a, start: new Date(a.scheduledDate), end: getAppointmentEnd(a) }))
      .filter(({ start, end }) => start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()))
      .filter(({ end }) => end >= now)
      .sort((x, y) => x.start - y.start)
      .slice(0, 20)
      .map(({ a, start, end }) => ({
        id: String(a.id),
        start,
        end,
        label: `${format(start, 'dd.MM.yyyy HH:mm')} — ${format(end, 'HH:mm')}`
      }));
  }, [appointments]);

  const stats = useMemo(() => {
    const pending = appointments.filter((a) => a.status === 'pending').length;
    const confirmed = appointments.filter((a) => a.status === 'confirmed').length;
    const inProgress = appointments.filter((a) => a.status === 'in_progress').length;
    return { pending, confirmed, inProgress };
  }, [appointments]);

  const handleBusyToggle = async (checked) => {
    if (!mechanicProfile?.id) return;
    if (!checked) {
      setSavingBusy(true);
      try {
        const updated = await scheduleDao.setMasterBusyStatus(mechanicProfile.id, false, null, '');
        setBusyStatus(updated);
      } catch (error) {
        void error;
      } finally {
        setSavingBusy(false);
      }
      return;
    }
    setSelectedAppointmentId('');
    setBusyReasonDraft('');
    const auto = derivedBusyFromAppointments;
    if (auto?.busy_until) {
      setBusyUntilDraft(new Date(auto.busy_until));
    } else {
      setBusyUntilDraft(new Date(new Date().getTime() + 60 * 60 * 1000));
    }
    setBusyDialogOpen(true);
  };

  const handleBusySave = async () => {
    if (!mechanicProfile?.id) return;
    setSavingBusy(true);
    try {
      const until = busyUntilDraft instanceof Date ? busyUntilDraft.toISOString() : null;
      const updated = await scheduleDao.setMasterBusyStatus(
        mechanicProfile.id,
        true,
        until,
        busyReasonDraft
      );
      setBusyStatus(updated);
      setBusyDialogOpen(false);
    } catch (error) {
      void error;
    } finally {
      setSavingBusy(false);
    }
  };

  if (!isMasterUser) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <Container sx={{ mt: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
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
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 6 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold" gutterBottom>
            {t('dashboard.masterPanelTitle', 'Робочий простір')}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {t('dashboard.greeting', 'Вітаємо,')} {user?.name || user?.email}
          </Typography>
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            variant="outlined"
            component={Link}
            to="/master-working-hours"
            startIcon={<AccessTimeIcon />}
          >
            {t('master.working_hours', 'Робочі години')}
          </Button>
          <Button
            variant="outlined"
            component={Link}
            to="/service-records"
            startIcon={<HistoryIcon />}
          >
            {t('master.service_history', 'Історія робіт')}
          </Button>
          <IconButton component={Link} to="/notifications" color="primary">
            <NotificationsIcon />
          </IconButton>
        </Stack>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, borderRadius: 2 }} elevation={2}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {t('master.status', 'Статус майстра')}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="h6">
                {effectiveBusyStatus?.is_busy ? t('master.busy', 'Зайнятий') : t('master.available', 'Доступний')}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  {t('master.acceptingAppointments', 'Приймаю записи')}
                </Typography>
                <Switch
                  checked={!effectiveBusyStatus?.is_busy}
                  onChange={(e) => handleBusyToggle(!e.target.checked)}
                  disabled={savingBusy}
                />
              </Stack>
            </Box>
            {effectiveBusyStatus?.is_busy && effectiveBusyStatus.busy_until && (
              <Typography variant="body2" color="text.secondary">
                {t('master.busy_until', 'Зайнятий до')}{' '}
                {format(new Date(effectiveBusyStatus.busy_until), 'dd.MM.yyyy HH:mm')}
              </Typography>
            )}
            {effectiveBusyStatus?.busy_reason && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {effectiveBusyStatus.busy_reason}
              </Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, borderRadius: 2 }} elevation={2}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              {t('dashboard.masterStats', 'Статистика записів')}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4">{stats.pending}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('master.pending_appointments', 'Нові')}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4">{stats.confirmed}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('master.confirmed_appointments', 'Підтверджені')}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4">{stats.inProgress}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('master.in_progress_appointments', 'В роботі')}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 2, height: '100%' }} elevation={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                <ScheduleIcon sx={{ mr: 1, color: 'primary.main' }} />
                {t('dashboard.masterTodayAppointments', 'Сьогодні')}
                <Chip
                  label={todayAppointments.length}
                  size="small"
                  sx={{ ml: 1 }}
                  color="primary"
                />
              </Typography>
              <Button component={Link} to="/appointments" size="small">
                {t('common.viewAll', 'Всі записи')}
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {todayAppointments.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  {t('dashboard.noAppointmentsToday', 'На сьогодні записів немає')}
                </Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                {todayAppointments.map((a) => (
                  <Paper
                    key={a.id}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      cursor: 'pointer'
                    }}
                    component={Link}
                    to={`/appointments/${a.id}`}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {a.serviceName || a.serviceType || t('common.notAvailable')}
                      </Typography>
                      <Chip
                        label={t(`appointment.statuses.${a.status || 'pending'}`)}
                        size="small"
                        color="default"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {a.scheduledDate
                        ? format(new Date(a.scheduledDate), 'HH:mm')
                        : t('common.notAvailable')}
                    </Typography>
                    {a.vehicle_vin && (
                      <Typography variant="body2" color="text.secondary">
                        VIN: {a.vehicle_vin}
                      </Typography>
                    )}
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 2, height: '100%' }} elevation={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                <EventNoteIcon sx={{ mr: 1, color: 'info.main' }} />
                {t('dashboard.masterUpcomingAppointments', 'Найближчі записи')}
              </Typography>
              <Button component={Link} to="/appointments" size="small">
                {t('common.viewAll', 'Всі записи')}
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            {upcomingAppointments.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  {t('dashboard.noUpcomingAppointments', 'Запланованих записів немає')}
                </Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                {upcomingAppointments.map((a) => (
                  <Paper
                    key={a.id}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      cursor: 'pointer'
                    }}
                    component={Link}
                    to={`/appointments/${a.id}`}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {a.serviceName || a.serviceType || t('common.notAvailable')}
                      </Typography>
                      <Chip
                        label={t(`appointment.statuses.${a.status || 'pending'}`)}
                        size="small"
                        color="default"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {a.scheduledDate
                        ? format(new Date(a.scheduledDate), 'dd.MM.yyyy HH:mm')
                        : t('common.notAvailable')}
                    </Typography>
                    {a.vehicle_vin && (
                      <Typography variant="body2" color="text.secondary">
                        VIN: {a.vehicle_vin}
                      </Typography>
                    )}
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={busyDialogOpen} onClose={() => setBusyDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('master.busy_status_set', 'Позначити як зайнятий')}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <TextField
              select
              fullWidth
              label={t('master.busy_pick_appointment', 'Виберіть запис')}
              value={selectedAppointmentId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedAppointmentId(nextId);
                const option = busyAppointmentOptions.find((o) => o.id === String(nextId));
                if (option?.end) {
                  setBusyUntilDraft(option.end);
                }
              }}
            >
              {busyAppointmentOptions.length === 0 ? (
                <MenuItem value="" disabled>
                  {t('master.noAppointmentsForBusy', 'Немає записів для вибору')}
                </MenuItem>
              ) : (
                busyAppointmentOptions.map((o) => (
                  <MenuItem key={o.id} value={o.id}>
                    {o.label}
                  </MenuItem>
                ))
              )}
            </TextField>
          </Box>

          {busyAppointmentOptions.length === 0 && (
            <Box sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => {
                  setBusyDialogOpen(false);
                  navigate('/appointments/schedule');
                }}
              >
                {t('appointment.create', 'Створити новий запис')}
              </Button>
            </Box>
          )}

          <Box sx={{ mt: 1, mb: 2 }}>
            <DateTimePicker
              label={t('master.busy_until', 'Зайнятий до')}
              value={busyUntilDraft}
              onChange={(value) => {
                if (value) setBusyUntilDraft(value);
              }}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Box>
          <TextField
            fullWidth
            label={t('master.busy_reason', 'Коментар')}
            value={busyReasonDraft}
            onChange={(e) => setBusyReasonDraft(e.target.value)}
            multiline
            minRows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBusyDialogOpen(false)}>
            {t('common.cancel', 'Скасувати')}
          </Button>
          <Button onClick={handleBusySave} variant="contained" disabled={savingBusy}>
            {t('common.save', 'Зберегти')}
          </Button>
        </DialogActions>
      </Dialog>
      </Container>
    </LocalizationProvider>
  );
};

export default MasterDashboard;
