import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
  MenuItem
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
  create: async (data) => {
    const payload = await requestJson('/api/reminders', {
      method: 'POST',
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

const Reminders = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [reminders, setReminders] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newReminder, setNewReminder] = useState({
    title: '',
    date: '',
    vehicleVin: '',
    type: 'maintenance' // maintenance, insurance, other
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (user?.id) {
        const remindersData = await remindersApi.list();
        setReminders(remindersData);
        const vehiclesData = await vehiclesDao.listForUser(user.id);
        setVehicles(vehiclesData || []);
      }
    } catch (err) {
      setError(err?.message || t('errors.loadFailed', 'Помилка завантаження даних'));
    } finally {
      setLoading(false);
    }
  }, [user?.id, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddReminder = async () => {
    if (!newReminder.title || !newReminder.date) {
      alert(t('reminders.fillRequired', 'Заповніть обов\'язкові поля'));
      return;
    }

    try {
      const payload = {
        title: newReminder.title,
        reminder_date: newReminder.date,
        vehicle_vin: newReminder.vehicleVin || null,
        reminder_type: newReminder.type || 'maintenance'
      };
      const created = await remindersApi.create(payload);
      if (created) {
        setReminders((prev) => [...prev, created]);
      }
      setDialogOpen(false);
      setNewReminder({ title: '', date: '', vehicleVin: '', type: 'maintenance' });
    } catch (err) {
      alert(err?.message || t('errors.saveFailed', 'Помилка збереження даних'));
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
        <Button 
          variant="contained" 
          startIcon={<AddAlertIcon />}
          onClick={() => setDialogOpen(true)}
        >
          {t('reminders.add', 'Додати')}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

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
                  secondaryAction={
                    <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(reminder.id)}>
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemIcon>
                    <AlarmIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={reminder.title}
                    secondary={`${formatReminderDate(reminder)} • ${reminder.reminder_type || reminder.type}`}
                  />
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
                  {v.make} {v.model} ({v.licensePlate})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleAddReminder} variant="contained">{t('common.save')}</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Reminders;
