import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Divider,
  Box,
  Button,
  CircularProgress,
  Alert,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Switch
} from '@mui/material';
import AlarmIcon from '@mui/icons-material/Alarm';
import DeleteIcon from '@mui/icons-material/Delete';
import AddAlertIcon from '@mui/icons-material/AddAlert';
import { useAuth } from '../context/useAuth';
import * as vehiclesDao from '../api/dao/vehiclesDao';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const resolveUrl = (url) => (url.startsWith('http') ? url : `${API_BASE_URL}${url}`);

async function requestJson(url, options = {}) {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(resolveUrl(url), {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody && typeof errorBody.message === 'string') {
        message = errorBody.message;
      }
    } catch (error) {
      void error;
    }
    throw new Error(message);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return null;
}

const remindersApi = {
  list: async () => {
    const data = await requestJson('/api/reminders');
    return data || [];
  },
  runCheck: async () => {
    const payload = await requestJson('/api/reminders/run-check-auth', {
      method: 'POST'
    });
    return payload || null;
  },
  create: async (data) => {
    const payload = await requestJson('/api/reminders', {
      method: 'POST',
      body: data
    });
    return payload || null;
  },
  update: async (id, data) => {
    const payload = await requestJson(`/api/reminders/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: data
    });
    return payload || null;
  },
  remove: async (id) => {
    await requestJson(`/api/reminders/${id}`, { method: 'DELETE' });
    return true;
  }
};

const resolveReminderDate = (reminder) =>
  reminder?.reminder_date || reminder?.due_date || reminder?.date || null;

const formatReminderDate = (reminder) => {
  const value = resolveReminderDate(reminder);
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
};

const buildReminderPayload = (reminder, overrides = {}) => {
  const base = { ...reminder, ...overrides };
  return {
    title: base.title,
    description: base.description || null,
    reminder_date: base.date || base.reminder_date || base.due_date || null,
    due_date: base.due_date || base.date || base.reminder_date || null,
    vehicle_vin: base.vehicleVin || base.vehicle_vin || null,
    reminder_type: base.type || base.reminder_type || 'maintenance',
    due_mileage: base.due_mileage ?? base.mileage_threshold ?? null,
    mileage_threshold: base.mileage_threshold ?? base.due_mileage ?? null,
    is_completed: !!base.is_completed,
    is_recurring: !!base.is_recurring,
    recurrence_interval: base.recurrence_interval || base.recurring_interval || null,
    priority: base.priority || 'medium',
    is_enabled:
      typeof base.is_enabled !== 'undefined'
        ? !!base.is_enabled
        : typeof base.__enabled !== 'undefined'
          ? !!base.__enabled
          : true
  };
};

const normalizeNotificationPermission = () => {
  try {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission || 'default';
  } catch (_) {
    return 'default';
  }
};

const Reminders = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  const [reminders, setReminders] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [runCheckLoading, setRunCheckLoading] = useState(false);
  const [runCheckSuccess, setRunCheckSuccess] = useState(false);
  const [runCheckReport, setRunCheckReport] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(normalizeNotificationPermission());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [newReminder, setNewReminder] = useState({
    title: '',
    date: '',
    vehicleVin: '',
    type: 'maintenance',
    priority: 'medium'
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (user?.id) {
        const remindersData = await remindersApi.list();
        setReminders((remindersData || []).map((r) => ({
          ...r,
          __enabled: typeof r?.is_enabled !== 'undefined' ? !!r.is_enabled : true,
        })));
        const role = String(user?.role || '').toLowerCase();
        const isMaster = ['master', 'mechanic', 'admin'].includes(role);
        const vehiclesData = isMaster
          ? await vehiclesDao.list({ serviced: true })
          : await vehiclesDao.listForUser(user.id);
        setVehicles(vehiclesData || []);
      }
    } catch (err) {
      setError(err?.message || t('errors.loadFailed', 'Помилка завантаження даних'));
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role, t]);

  const openEditDialog = useCallback((reminder) => {
    setEditingReminder(reminder);
    setNewReminder({
      title: reminder.title || '',
      date: resolveReminderDate(reminder) || '',
      vehicleVin: reminder.vehicle_vin || reminder.vehicleVin || '',
      type: reminder.reminder_type || reminder.type || 'maintenance',
      priority: reminder.priority || 'medium'
    });
    setDialogOpen(true);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const reminderId = params.get('reminderId');
    if (!reminderId) return;
    const reminder = (reminders || []).find((r) => String(r?.id || '') === String(reminderId));
    if (!reminder) return;
    openEditDialog(reminder);
    params.delete('reminderId');
    const nextSearch = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`);
  }, [location.search, reminders, openEditDialog]);

  useEffect(() => {
    const update = () => setNotificationPermission(normalizeNotificationPermission());
    update();
    window.addEventListener('focus', update);
    return () => window.removeEventListener('focus', update);
  }, []);

  const requestNotificationPermission = async () => {
    try {
      if (typeof Notification === 'undefined') {
        setNotificationPermission('unsupported');
        return;
      }
      const res = await Notification.requestPermission();
      setNotificationPermission(res || normalizeNotificationPermission());
    } catch (_) {
      setNotificationPermission(normalizeNotificationPermission());
    }
  };

  const handleSaveReminder = async () => {
    if (!newReminder.title || !newReminder.date) {
      alert(t('reminders.fillRequired', 'Заповніть обов\'язкові поля'));
      return;
    }

    try {
      const payload = buildReminderPayload(newReminder);
      if (editingReminder) {
        const updated = await remindersApi.update(editingReminder.id, payload);
        if (updated) {
          setReminders((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        }
      } else {
        const created = await remindersApi.create(payload);
        if (created) {
          setReminders((prev) => [...prev, created]);
        }
      }
      setDialogOpen(false);
      setEditingReminder(null);
      setNewReminder({ title: '', date: '', vehicleVin: '', type: 'maintenance', priority: 'medium' });
    } catch (err) {
      alert(err?.message || t('errors.saveFailed', 'Помилка збереження даних'));
    }
  };

  const handleToggleEnabled = async (reminder, enabled) => {
    const id = reminder?.id;
    if (!id) return;

    if (enabled) {
      if (notificationPermission === 'denied') {
        alert(t('reminders.permissions_denied', 'Дозвіл на сповіщення заблоковано в браузері'));
        return;
      }
      if (notificationPermission !== 'granted' && notificationPermission !== 'unsupported') {
        await requestNotificationPermission();
        const nextPerm = normalizeNotificationPermission();
        if (nextPerm !== 'granted') {
          return;
        }
      }
    }

    try {
      const updated = await remindersApi.update(id, buildReminderPayload(reminder, { is_enabled: enabled }));
      if (updated) {
        setReminders((prev) => (prev || []).map((r) => {
          if (r.id !== id) return r;
          return { ...updated, __enabled: typeof updated?.is_enabled !== 'undefined' ? !!updated.is_enabled : enabled };
        }));
      } else {
        setReminders((prev) => (prev || []).map((r) => (r.id === id ? { ...r, __enabled: enabled } : r)));
      }
    } catch (err) {
      alert(err?.message || t('common.error', 'Помилка'));
    }
  };

  const handleDelete = async (id) => {
    try {
      await remindersApi.remove(id);
      setReminders(reminders.filter(r => r.id !== id));
    } catch (err) {
      alert(err?.message || t('errors.deleteFailed', 'Помилка видалення'));
    }
  };

  const handleToggleCompleted = async (reminder) => {
    try {
      const payload = buildReminderPayload(reminder, { is_completed: !reminder.is_completed });
      const updated = await remindersApi.update(reminder.id, payload);
      if (updated) {
        setReminders((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      }
    } catch (err) {
      alert(err?.message || t('errors.saveFailed', 'Помилка збереження даних'));
    }
  };

  const openCreateDialog = () => {
    setEditingReminder(null);
    setNewReminder({ title: '', date: '', vehicleVin: '', type: 'maintenance', priority: 'medium' });
    setDialogOpen(true);
  };

  const handleRunCheck = async () => {
    setRunCheckLoading(true);
    setRunCheckSuccess(false);
    setRunCheckReport(null);
    setError(null);
    try {
      const payload = await remindersApi.runCheck();
      if (payload && typeof payload === 'object') {
        setRunCheckReport(payload.report || null);
      }
      setRunCheckSuccess(true);
      try {
        window.dispatchEvent(new Event('notificationsUpdated'));
      } catch (_) {
        void _;
      }
    } catch (err) {
      setError(err?.message || t('errors.loadFailed', 'Помилка завантаження даних'));
    } finally {
      setRunCheckLoading(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {t('reminders.title', 'Нагадування')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            onClick={handleRunCheck}
            disabled={runCheckLoading}
          >
            {runCheckLoading
              ? t('common.loading', 'Завантаження...')
              : t('reminders.runCheckNow', 'Перевірити зараз')}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddAlertIcon />}
            onClick={openCreateDialog}
          >
            {t('reminders.add', 'Додати')}
          </Button>
        </Box>
      </Box>

      {runCheckSuccess ? (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => window.location.assign('/notifications')}>
              {t('notifications.viewAll', 'Перейти до сповіщень')}
            </Button>
          }
        >
          {(() => {
            const due = typeof runCheckReport?.due === 'number' ? runCheckReport.due : null;
            const created = typeof runCheckReport?.created === 'number' ? runCheckReport.created : null;
            const skippedExisting =
              typeof runCheckReport?.skipped_existing === 'number' ? runCheckReport.skipped_existing : null;
            const skippedFlag =
              typeof runCheckReport?.skipped_flag === 'number' ? runCheckReport.skipped_flag : null;
            const errors = typeof runCheckReport?.errors === 'number' ? runCheckReport.errors : null;
            if (due === null && created === null) {
              return t('reminders.runCheckDone', 'Перевірку виконано.');
            }

            const parts = [
              t(
                'reminders.runCheckSummary',
                'Знайдено: {{due}}, створено сповіщень: {{created}}',
                { due: due ?? '-', created: created ?? '-' }
              ),
            ];
            if (skippedExisting !== null) {
              parts.push(
                t('reminders.runCheckSkippedExisting', 'Вже були: {{count}}', { count: skippedExisting })
              );
            }
            if (skippedFlag !== null) {
              parts.push(t('reminders.runCheckSkippedFlag', 'Позначені: {{count}}', { count: skippedFlag }));
            }
            if (errors !== null && errors > 0) {
              parts.push(t('reminders.runCheckErrors', 'Помилки: {{count}}', { count: errors }));
            }
            return `${t('reminders.runCheckDone', 'Перевірку виконано.')} ${parts.join(', ')}`;
          })()}
        </Alert>
      ) : null}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {notificationPermission !== 'granted' ? (
        <Alert
          severity={notificationPermission === 'denied' ? 'warning' : 'info'}
          sx={{ mb: 2 }}
          action={
            notificationPermission === 'unsupported' ? null : (
              <Button color="inherit" size="small" onClick={requestNotificationPermission}>
                {t('reminders.enableNotifications', 'Увімкнути сповіщення')}
              </Button>
            )
          }
        >
          {notificationPermission === 'unsupported'
            ? t('reminders.notificationsUnsupported', 'Цей браузер не підтримує push-сповіщення.')
            : notificationPermission === 'denied'
              ? t('reminders.notificationsDenied', 'Сповіщення вимкнені в налаштуваннях браузера.')
              : t('reminders.notificationsDefault', 'Дозвольте сповіщення, щоб отримувати нагадування.')}
        </Alert>
      ) : null}

      <Paper elevation={3}>
        {reminders.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <AlarmIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              {t('reminders.empty', 'У вас немає активних нагадувань')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('reminders.emptyHint', 'Створіть нагадування про ТО або страховку, щоб не забути.')}
            </Typography>
          </Box>
        ) : (
          <List>
            {reminders.map((reminder) => (
              <React.Fragment key={reminder.id}>
                <ListItem
                  button
                  onClick={() => openEditDialog(reminder)}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(reminder.id);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemIcon>
                    <AlarmIcon color={reminder.is_completed ? 'disabled' : 'primary'} />
                  </ListItemIcon>
                  <ListItemText
                    primary={reminder.title}
                    secondary={
                      <>
                        {formatReminderDate(reminder)} • {reminder.reminder_type || reminder.type}
                        {reminder.vehicle_vin && (
                          (() => {
                            const v = (vehicles || []).find((x) => String(x?.vin || '') === String(reminder.vehicle_vin));
                            const name = v ? `${(v.make || v.brand || '').trim()} ${v.model || ''}`.trim() : '';
                            return <> • {name || reminder.vehicle_vin}</>;
                          })()
                        )}
                      </>
                    }
                  />
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', ml: 2 }}>
                    <Switch
                      checked={
                        typeof reminder.__enabled === 'boolean'
                          ? reminder.__enabled
                          : typeof reminder.is_enabled !== 'undefined'
                            ? !!reminder.is_enabled
                            : true
                      }
                      onClick={(e) => e.stopPropagation()}
                      onChange={(_, checked) => handleToggleEnabled(reminder, checked)}
                      color="primary"
                    />
                    <Button
                      size="small"
                      variant={reminder.is_completed ? 'outlined' : 'contained'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleCompleted(reminder);
                      }}
                    >
                      {reminder.is_completed
                        ? t('reminders.completed', 'Виконано')
                        : t('reminders.markCompleted', 'Завершити')}
                    </Button>
                    <Chip
                      label={reminder.priority || 'medium'}
                      size="small"
                      sx={{ mt: 1 }}
                      color={
                        reminder.priority === 'high'
                          ? 'error'
                          : reminder.priority === 'low'
                            ? 'default'
                            : 'warning'
                      }
                    />
                  </Box>
                </ListItem>
                <Divider />
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      {/* Add Reminder Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('reminders.addTitle', 'Нове нагадування')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('reminders.labelTitle', 'Назва')}
            fullWidth
            variant="outlined"
            value={newReminder.title}
            onChange={(e) => setNewReminder({...newReminder, title: e.target.value})}
            sx={{ mb: 2, mt: 1 }}
          />
          
          <TextField
            margin="dense"
            label={t('reminders.date', 'Дата')}
            type="date"
            fullWidth
            InputLabelProps={{ shrink: true }}
            value={newReminder.date}
            onChange={(e) => setNewReminder({...newReminder, date: e.target.value})}
            sx={{ mb: 2 }}
          />

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>{t('reminders.type', 'Тип')}</InputLabel>
            <Select
              value={newReminder.type}
              label={t('reminders.type', 'Тип')}
              onChange={(e) => setNewReminder({...newReminder, type: e.target.value})}
            >
              <MenuItem value="maintenance">{t('reminders.typeMaintenance', 'Технічне обслуговування')}</MenuItem>
              <MenuItem value="insurance">{t('reminders.typeInsurance', 'Страхування')}</MenuItem>
              <MenuItem value="other">{t('reminders.typeOther', 'Інше')}</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>{t('reminders.priority', 'Пріоритет')}</InputLabel>
            <Select
              value={newReminder.priority}
              label={t('reminders.priority', 'Пріоритет')}
              onChange={(e) => setNewReminder({ ...newReminder, priority: e.target.value })}
            >
              <MenuItem value="low">{t('reminders.priorityLow', 'Низький')}</MenuItem>
              <MenuItem value="medium">{t('reminders.priorityMedium', 'Середній')}</MenuItem>
              <MenuItem value="high">{t('reminders.priorityHigh', 'Високий')}</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>{t('vehicle.title', 'Автомобіль')}</InputLabel>
            <Select
              value={newReminder.vehicleVin}
              label={t('vehicle.title', 'Автомобіль')}
              onChange={(e) => setNewReminder({...newReminder, vehicleVin: e.target.value})}
            >
              <MenuItem value="">
                <em>{t('common.none', 'Не вибрано')}</em>
              </MenuItem>
              {vehicles.map((v) => (
                <MenuItem key={v.vin} value={v.vin}>
                  {v.make} {v.model} ({v.licensePlate || v.license_plate || ''})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSaveReminder} variant="contained">{t('common.save')}</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Reminders;
