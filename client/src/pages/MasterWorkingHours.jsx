import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Box,
  Typography,
  Paper,
  Grid,
  Switch,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { AccessTime as AccessTimeIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { TimePicker } from '@mui/x-date-pickers';
import { useAuth } from '../context/useAuth';
import * as scheduleDao from '../api/dao/scheduleDao';

const MasterWorkingHours = () => {
  const { t } = useTranslation();
  const { user, isMaster } = useAuth();
  const isMasterUser = typeof isMaster === 'function' ? isMaster() : false;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [workingHours, setWorkingHours] = useState({});
  const [timeDialogOpen, setTimeDialogOpen] = useState(false);
  const [currentDay, setCurrentDay] = useState(null);
  const [currentType, setCurrentType] = useState(null);
  const [timeDraft, setTimeDraft] = useState(new Date());

  useEffect(() => {
    const run = async () => {
      if (!user || !user.id || !isMasterUser) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await scheduleDao.getMasterWorkingHours(user.id);
        setWorkingHours(data || {});
      } catch (err) {
        setError(err?.message || t('errors.unknownError', 'Не вдалося завантажити робочі години'));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user, isMasterUser, t]);

  const daysOrder = [1, 2, 3, 4, 5, 6, 0];

  const getDayName = (day) => {
    const map = {
      0: t('days.sunday', 'Неділя'),
      1: t('days.monday', 'Понеділок'),
      2: t('days.tuesday', 'Вівторок'),
      3: t('days.wednesday', 'Середа'),
      4: t('days.thursday', 'Четвер'),
      5: t('days.friday', 'Пʼятниця'),
      6: t('days.saturday', 'Субота')
    };
    return map[day] || '';
  };

  const handleWorkingDayChange = (day, value) => {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: {
        start_time: prev[day]?.start_time || '09:00',
        end_time: prev[day]?.end_time || '18:00',
        is_working_day: value
      }
    }));
  };

  const openTimeDialog = (day, type) => {
    const dayData = workingHours[day] || {
      start_time: '09:00',
      end_time: '18:00',
      is_working_day: day < 6
    };
    const value = type === 'start' ? dayData.start_time : dayData.end_time;
    const [h, m] = String(value || '09:00').split(':');
    const d = new Date();
    d.setHours(Number(h) || 9, Number(m) || 0, 0, 0);
    setTimeDraft(d);
    setCurrentDay(day);
    setCurrentType(type);
    setTimeDialogOpen(true);
  };

  const handleTimeConfirm = () => {
    if (!currentDay && currentDay !== 0) {
      setTimeDialogOpen(false);
      return;
    }
    const hours = String(timeDraft.getHours()).padStart(2, '0');
    const minutes = String(timeDraft.getMinutes()).padStart(2, '0');
    const value = `${hours}:${minutes}`;
    setWorkingHours((prev) => ({
      ...prev,
      [currentDay]: {
        start_time: currentType === 'start' ? value : prev[currentDay]?.start_time || '09:00',
        end_time: currentType === 'end' ? value : prev[currentDay]?.end_time || '18:00',
        is_working_day: prev[currentDay]?.is_working_day ?? currentDay < 6
      }
    }));
    setTimeDialogOpen(false);
  };

  const handleSave = async () => {
    if (!user || !user.id) return;
    setSaving(true);
    setError(null);
    try {
      await scheduleDao.updateMasterWorkingHours(user.id, workingHours);
    } catch (err) {
      setError(err?.message || t('errors.unknownError', 'Не вдалося зберегти робочі години'));
    } finally {
      setSaving(false);
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

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton edge="start" onClick={() => window.history.back()} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold">
            {t('master.working_hours_title', 'Робочі години')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('master.working_hours_description', 'Налаштуйте, коли ви приймаєте клієнтів')}
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, borderRadius: 2 }} elevation={2}>
        <Grid container spacing={2}>
          {daysOrder.map((day) => {
            const dayData = workingHours[day] || {
              start_time: '09:00',
              end_time: '18:00',
              is_working_day: day < 6
            };
            return (
              <Grid item xs={12} key={day}>
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    justifyContent: 'space-between',
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: dayData.is_working_day ? 'primary.light' : 'divider',
                    mb: 1
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: isMobile ? 1 : 0 }}>
                    <Typography variant="subtitle1" sx={{ mr: 2 }}>
                      {getDayName(day)}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ mr: 1 }}>
                        {t('master.working_day', 'Робочий день')}
                      </Typography>
                      <Switch
                        checked={dayData.is_working_day}
                        onChange={(e) => handleWorkingDayChange(day, e.target.checked)}
                      />
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      opacity: dayData.is_working_day ? 1 : 0.5
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                      <AccessTimeIcon fontSize="small" sx={{ mr: 0.5 }} />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => openTimeDialog(day, 'start')}
                        disabled={!dayData.is_working_day}
                      >
                        {dayData.start_time}
                      </Button>
                    </Box>
                    <Typography variant="body2" sx={{ mr: 2 }}>
                      —
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <AccessTimeIcon fontSize="small" sx={{ mr: 0.5 }} />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => openTimeDialog(day, 'end')}
                        disabled={!dayData.is_working_day}
                      >
                        {dayData.end_time}
                      </Button>
                    </Box>
                  </Box>
                </Box>
              </Grid>
            );
          })}
        </Grid>
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t('common.saving', 'Збереження...') : t('common.save', 'Зберегти')}
          </Button>
        </Box>
      </Paper>

      <Dialog open={timeDialogOpen} onClose={() => setTimeDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('master.select_time', 'Виберіть час')}</DialogTitle>
        <DialogContent>
          <TimePicker
            value={timeDraft}
            onChange={(value) => {
              if (value) setTimeDraft(value);
            }}
            slotProps={{ textField: { fullWidth: true } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTimeDialogOpen(false)}>
            {t('common.cancel', 'Скасувати')}
          </Button>
          <Button onClick={handleTimeConfirm} variant="contained">
            {t('common.ok', 'ОК')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MasterWorkingHours;

