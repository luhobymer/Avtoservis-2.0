import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as servicesDao from '../../api/dao/servicesDao';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

const emptyForm = {
  name: '',
  description: '',
  price: '',
  duration: '',
  is_active: true,
};

const parseNumericOrText = (value) => {
  const raw = value == null ? '' : String(value).trim();
  if (!raw) return { number: null, text: null };
  const isPureNumber = /^-?\d+(?:[.,]\d+)?$/.test(raw);
  if (isPureNumber) {
    const n = Number(raw.replace(',', '.'));
    if (Number.isFinite(n)) return { number: n, text: null };
  }
  return { number: null, text: raw };
};

const ServicesManagement = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const title = useMemo(() => t('master.servicesTitle', 'Послуги'), [t]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await servicesDao.list();
      setItems(list);
    } catch (e) {
      setItems([]);
      setError(e?.message || 'Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setSelected(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (row) => {
    setSelected(row);
    setForm({
      name: row.name || '',
      description: row.description || '',
      price: row.price_text ?? (row.price ?? ''),
      duration: row.duration_text ?? (row.duration ?? ''),
      is_active: row.is_active !== false,
    });
    setOpen(true);
  };

  const close = () => setOpen(false);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onToggleActive = (e) => {
    setForm((prev) => ({ ...prev, is_active: e.target.checked }));
  };

  const submit = async () => {
    try {
      setError(null);
      const priceParsed = parseNumericOrText(form.price);
      const durationParsed = parseNumericOrText(form.duration);
      const payload = {
        name: String(form.name || '').trim(),
        description: form.description || null,
        price: priceParsed.number,
        price_text: priceParsed.text,
        duration: durationParsed.number,
        duration_text: durationParsed.text,
        is_active: Boolean(form.is_active),
      };
      if (!payload.name) {
        setError(t('errors.validation', 'Перевірте введені дані'));
        return;
      }

      if (selected) {
        await servicesDao.update(selected.id, payload);
      } else {
        await servicesDao.create(payload);
      }
      await load();
      close();
    } catch (e) {
      setError(e?.message || 'Failed to save service');
    }
  };

  const remove = async (row) => {
    const ok = window.confirm(t('master.confirmDeleteService', 'Видалити послугу?'));
    if (!ok) return;
    try {
      setError(null);
      await servicesDao.remove(row.id);
      await load();
    } catch (e) {
      setError(e?.message || 'Failed to delete service');
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">{title}</Typography>
        <Button variant="contained" onClick={openCreate}>
          {t('master.addService', 'Додати послугу')}
        </Button>
      </Box>
      <Divider sx={{ my: 2 }} />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {items.length === 0 ? (
        <Alert severity="info">{t('master.noServices', 'Немає послуг')}</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('service.name', 'Назва')}</TableCell>
                <TableCell>{t('service.price', 'Ціна')}</TableCell>
                <TableCell>{t('service.duration', 'Тривалість')}</TableCell>
                <TableCell>{t('service.active', 'Активна')}</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.price_text || row.price || ''}</TableCell>
                  <TableCell>{row.duration_text || row.duration || ''}</TableCell>
                  <TableCell>{row.is_active ? '✓' : ''}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => openEdit(row)} sx={{ mr: 1 }}>
                      {t('common.edit')}
                    </Button>
                    <Button size="small" color="error" onClick={() => remove(row)}>
                      {t('common.delete')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
        <DialogTitle>
          {selected ? t('master.editService', 'Редагувати послугу') : t('master.newService', 'Нова послуга')}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label={t('service.name', 'Назва')}
            name="name"
            value={form.name}
            onChange={onChange}
            margin="normal"
          />
          <TextField
            fullWidth
            label={t('service.description', 'Опис')}
            name="description"
            value={form.description}
            onChange={onChange}
            margin="normal"
            multiline
            rows={3}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              fullWidth
              label={t('service.price', 'Ціна')}
              name="price"
              value={form.price}
              onChange={onChange}
              margin="normal"
              inputMode="decimal"
            />
            <TextField
              fullWidth
              label={t('service.duration', 'Тривалість (хв)')}
              name="duration"
              value={form.duration}
              onChange={onChange}
              margin="normal"
              inputMode="numeric"
            />
          </Box>
          <FormControlLabel
            control={<Checkbox checked={Boolean(form.is_active)} onChange={onToggleActive} />}
            label={t('service.active', 'Активна')}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={submit}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default ServicesManagement;
