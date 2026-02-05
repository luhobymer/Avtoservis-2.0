import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  CircularProgress,
  Alert,
  Grid
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';

// API helper (since we don't have a dao file yet, defining here or usually in api/dao)
const fetchJson = async (url, options = {}) => {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  if (!res.ok) throw new Error('Request failed');
  return res.json();
};

const MaintenanceTab = ({ vin }) => {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    service_item: '',
    interval_km: '',
    interval_months: '',
    last_service_date: '',
    last_service_mileage: ''
  });

  const fetchSchedule = useCallback(async () => {
    if (!vin) return;
    setLoading(true);
    try {
      let data = await fetchJson(`/api/maintenance/${vin}`);
      
      // If empty, try to initialize default schedule
      if (data && data.length === 0) {
        try {
          await fetchJson(`/api/maintenance/init-default/${vin}`, { method: 'POST' });
          // Re-fetch after init
          data = await fetchJson(`/api/maintenance/${vin}`);
        } catch (initErr) {
          console.warn('Failed to init default schedule:', initErr);
        }
      }
      
      setItems(data || []);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(t('errors.loadFailed', 'Не вдалося завантажити регламент'));
    } finally {
      setLoading(false);
    }
  }, [vin, t]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleOpenDialog = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        service_item: item.service_item,
        interval_km: item.interval_km || '',
        interval_months: item.interval_months || '',
        last_service_date: item.last_service_date ? item.last_service_date.split('T')[0] : '',
        last_service_mileage: item.last_service_mileage || ''
      });
    } else {
      setEditingItem(null);
      setFormData({
        service_item: '',
        interval_km: '',
        interval_months: '',
        last_service_date: '',
        last_service_mileage: ''
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        vehicle_vin: vin,
        service_item: formData.service_item,
        interval_km: formData.interval_km ? Number(formData.interval_km) : null,
        interval_months: formData.interval_months ? Number(formData.interval_months) : null,
        last_service_date: formData.last_service_date || null,
        last_service_mileage: formData.last_service_mileage ? Number(formData.last_service_mileage) : null
      };

      if (editingItem) {
        await fetchJson(`/api/maintenance/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await fetchJson('/api/maintenance', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      setDialogOpen(false);
      fetchSchedule();
    } catch (err) {
      alert(t('errors.saveFailed', 'Помилка збереження'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('common.confirmDelete', 'Видалити цей пункт?'))) return;
    try {
      await fetchJson(`/api/maintenance/${id}`, { method: 'DELETE' });
      setItems(items.filter(i => i.id !== id));
    } catch (err) {
      alert('Error deleting');
    }
  };

  const getStatusChip = (item) => {
    if (item.status === 'overdue') {
      return <Chip icon={<ErrorIcon />} label={t('maintenance.overdue', 'Прострочено')} color="error" size="small" />;
    }
    if (item.status === 'upcoming') {
      return <Chip icon={<WarningIcon />} label={t('maintenance.upcoming', 'Скоро')} color="warning" size="small" />;
    }
    return <Chip icon={<CheckCircleIcon />} label={t('maintenance.ok', 'OK')} color="success" size="small" />;
  };

  if (loading) return <CircularProgress />;

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">{t('maintenance.title', 'Регламент ТО')}</Typography>
        <Button startIcon={<AddIcon />} variant="contained" onClick={() => handleOpenDialog()}>
          {t('common.add', 'Додати')}
        </Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <List>
        {items.map(item => (
          <ListItem
            key={item.id}
            sx={{ 
              border: '1px solid #eee', 
              borderRadius: 2, 
              mb: 1,
              bgcolor: item.status === 'overdue' ? '#fff4f4' : 'inherit'
            }}
            secondaryAction={
              <Box>
                <IconButton onClick={() => handleOpenDialog(item)} size="small"><EditIcon /></IconButton>
                <IconButton onClick={() => handleDelete(item.id)} size="small" color="error"><DeleteIcon /></IconButton>
              </Box>
            }
          >
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle1" fontWeight="bold">{item.service_item}</Typography>
                  {getStatusChip(item)}
                </Box>
              }
              secondary={
                <Box component="span" sx={{ display: 'flex', flexDirection: 'column', mt: 0.5 }}>
                  <Typography variant="body2" component="span">
                    {t('maintenance.interval', 'Інтервал')}: 
                    {item.interval_km ? ` ${item.interval_km} км` : ''}
                    {item.interval_km && item.interval_months ? ' / ' : ''}
                    {item.interval_months ? ` ${item.interval_months} міс` : ''}
                  </Typography>
                  <Typography variant="body2" component="span" color="text.secondary">
                    {t('maintenance.last', 'Останнє')}: 
                    {item.last_service_date ? ` ${new Date(item.last_service_date).toLocaleDateString()}` : ''}
                    {item.last_service_mileage ? ` @ ${item.last_service_mileage} км` : ''}
                  </Typography>
                  {(item.remaining_km !== null || item.remaining_days !== null) && (
                    <Typography variant="caption" color={item.status === 'overdue' ? 'error' : 'primary'}>
                      {t('maintenance.remaining', 'Залишилось')}: 
                      {item.remaining_km !== null ? ` ${item.remaining_km} км` : ''}
                      {item.remaining_days !== null ? ` ${item.remaining_days} дн` : ''}
                    </Typography>
                  )}
                </Box>
              }
            />
          </ListItem>
        ))}
        {items.length === 0 && (
          <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
            {t('maintenance.empty', 'Регламент ще не налаштовано')}
          </Typography>
        )}
      </List>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingItem ? t('maintenance.edit') : t('maintenance.add')}</DialogTitle>
        <DialogContent>
          <TextField
            label={t('maintenance.serviceItem', 'Назва робіт')}
            fullWidth
            margin="normal"
            value={formData.service_item}
            onChange={e => setFormData({...formData, service_item: e.target.value})}
          />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                label={t('maintenance.intervalKm', 'Інтервал (км)')}
                fullWidth
                margin="normal"
                type="number"
                value={formData.interval_km}
                onChange={e => setFormData({...formData, interval_km: e.target.value})}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label={t('maintenance.intervalMonths', 'Інтервал (міс)')}
                fullWidth
                margin="normal"
                type="number"
                value={formData.interval_months}
                onChange={e => setFormData({...formData, interval_months: e.target.value})}
              />
            </Grid>
          </Grid>
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>{t('maintenance.lastServiceInfo', 'Дані останнього обслуговування')}</Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                label={t('maintenance.lastDate', 'Дата')}
                fullWidth
                type="date"
                InputLabelProps={{ shrink: true }}
                value={formData.last_service_date}
                onChange={e => setFormData({...formData, last_service_date: e.target.value})}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label={t('maintenance.lastMileage', 'Пробіг (км)')}
                fullWidth
                type="number"
                value={formData.last_service_mileage}
                onChange={e => setFormData({...formData, last_service_mileage: e.target.value})}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} variant="contained">{t('common.save')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MaintenanceTab;
