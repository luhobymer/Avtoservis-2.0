import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  TextField,
  Typography
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import useAuth from '../context/useAuth';
import { getCurrent as getCurrentMechanic, list as listMechanics } from '../api/dao/mechanicsDao';
import {
  listMechanicServices,
  createMechanicService,
  updateMechanicServiceDetails,
  setMechanicServiceEnabled
} from '../api/dao/mechanicServicesDao';

const normalizeCategoryKey = (service) => {
  const id = service?.category?.id ? String(service.category.id) : '';
  const name = service?.category?.name ? String(service.category.name) : '';
  if (id) return `id:${id}`;
  if (name) return `name:${name}`;
  return 'none';
};

const getCategoryLabel = (service, t) => {
  const name = service?.category?.name ? String(service.category.name) : '';
  return name || t('services.noCategory', 'Без категорії');
};

const formatServicePrice = (service) => {
  if (service?.price_text) return String(service.price_text);
  if (service?.price != null) return `${service.price} грн`;
  return '';
};

const formatServiceDuration = (service) => {
  if (service?.duration_text) return String(service.duration_text);
  if (service?.duration != null) return `${service.duration} хв`;
  return '';
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

const MyServices = () => {
  const { t } = useTranslation();
  const { isAdmin, isMaster } = useAuth();

  const isMasterUser =
    typeof isMaster === 'function'
      ? isMaster()
      : typeof isAdmin === 'function'
        ? isAdmin()
        : false;

  const [mechanics, setMechanics] = useState([]);
  const [mechanicId, setMechanicId] = useState('');
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [canSelectMechanic, setCanSelectMechanic] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState({
    id: '',
    name: '',
    description: '',
    price: '',
    duration: '',
    isOwned: true
  });

  const reloadServices = useCallback(
    async (targetMechanicId) => {
      const mid = targetMechanicId || mechanicId;
      if (!mid) {
        setServices([]);
        return;
      }
      const list = await listMechanicServices(mid);
      setServices(list);
    },
    [mechanicId]
  );

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError('');
        setCanSelectMechanic(false);
        if (isMasterUser) {
          try {
            const current = await getCurrentMechanic();
            if (current?.id) {
              setMechanics([current]);
              setMechanicId(String(current.id));
              setCanSelectMechanic(false);
              return;
            }
          } catch (_) {
            void _;
          }
          setMechanics([]);
          setMechanicId('');
          setCanSelectMechanic(false);
          setError(t('errors.mechanicProfileNotFound', 'Профіль механіка не знайдено'));
          return;
        }

        const list = await listMechanics();
        setMechanics(list);
        if (!mechanicId && list.length > 0) {
          setMechanicId(String(list[0].id));
        }
        setCanSelectMechanic((list || []).length > 1);
      } catch (err) {
        setError(err?.message || t('common.error', 'Помилка'));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [isMasterUser, mechanicId, t]);

  useEffect(() => {
    const run = async () => {
      if (!mechanicId) {
        setServices([]);
        return;
      }
      try {
        setLoading(true);
        setError('');
        await reloadServices(mechanicId);
      } catch (err) {
        setError(err?.message || t('common.error', 'Помилка'));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [mechanicId, reloadServices, t]);

  const openAdd = () => {
    setDraft({ id: '', name: '', description: '', price: '', duration: '', isOwned: true });
    setAddOpen(true);
  };

  const openEdit = (service) => {
    const isOwned = String(service?.created_by_mechanic_id || '') === String(mechanicId);
    setDraft({
      id: service?.id || '',
      name: service?.name || '',
      description: service?.description || '',
      price: service?.price_text != null ? String(service.price_text) : service?.price != null ? String(service.price) : '',
      duration: service?.duration_text != null ? String(service.duration_text) : service?.duration != null ? String(service.duration) : '',
      isOwned
    });
    setEditOpen(true);
  };

  const submitCreate = async () => {
    if (!mechanicId) return;
    const name = String(draft.name || '').trim();
    if (!name) {
      setSnackbar({ open: true, message: "Вкажіть назву послуги", severity: 'error' });
      return;
    }

    setSaving(true);
    try {
      const priceParsed = parseNumericOrText(draft.price);
      const durationParsed = parseNumericOrText(draft.duration);
      await createMechanicService(mechanicId, {
        name,
        description: String(draft.description || '').trim() || null,
        price: priceParsed.number,
        price_text: priceParsed.text,
        duration: durationParsed.number,
        duration_text: durationParsed.text
      });
      await reloadServices(mechanicId);
      setAddOpen(false);
      setSnackbar({ open: true, message: t('common.saved', 'Збережено'), severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err?.message || t('common.error', 'Помилка'), severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async () => {
    if (!mechanicId || !draft.id) return;
    const name = String(draft.name || '').trim();
    if (draft.isOwned && !name) {
      setSnackbar({ open: true, message: "Вкажіть назву послуги", severity: 'error' });
      return;
    }

    setSaving(true);
    try {
      const priceParsed = parseNumericOrText(draft.price);
      const durationParsed = parseNumericOrText(draft.duration);

      if (!draft.isOwned) {
        if (priceParsed.text || durationParsed.text) {
          setSnackbar({
            open: true,
            message: t('errors.validation', 'Для не власних послуг можна змінювати лише числову ціну/час'),
            severity: 'error'
          });
          setSaving(false);
          return;
        }
      }

      await updateMechanicServiceDetails(
        mechanicId,
        draft.id,
        draft.isOwned
          ? {
              name,
              description: String(draft.description || '').trim() || null,
              price: priceParsed.number,
              price_text: priceParsed.text,
              duration: durationParsed.number,
              duration_text: durationParsed.text
            }
          : {
              price: priceParsed.number,
              duration: durationParsed.number
            }
      );
      await reloadServices(mechanicId);
      setEditOpen(false);
      setSnackbar({ open: true, message: t('common.saved', 'Збережено'), severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err?.message || t('common.error', 'Помилка'), severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map();
    for (const s of services || []) {
      const key = normalizeCategoryKey(s);
      if (!map.has(key)) {
        map.set(key, { label: getCategoryLabel(s, t), items: [] });
      }
      map.get(key).items.push(s);
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [services, t]);

  const handleToggle = async (service) => {
    const serviceId = service?.id;
    if (!serviceId || !mechanicId) return;

    const nextEnabled = !service?.is_enabled;

    setSaving(true);
    try {
      await setMechanicServiceEnabled(mechanicId, serviceId, nextEnabled);
      setServices((prev) =>
        (prev || []).map((s) => (s.id === serviceId ? { ...s, is_enabled: nextEnabled } : s))
      );
      setSnackbar({
        open: true,
        message: t('common.saved', 'Збережено'),
        severity: 'success'
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err?.message || t('common.error', 'Помилка'),
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  if (!isMasterUser) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="warning">{t('common.forbidden', 'Доступ заборонено')}</Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1 }}>
          <Typography variant="h5">{t('services.myServices', 'Мої послуги')}</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openAdd}
            disabled={!mechanicId || saving}
          >
            {t('services.add', 'Додати послугу')}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {canSelectMechanic ? (
          <FormControl fullWidth sx={{ mb: 3 }} disabled={saving}>
            <InputLabel>{t('appointment.mechanic', 'Механік')}</InputLabel>
            <Select
              value={mechanicId}
              label={t('appointment.mechanic', 'Механік')}
              onChange={(e) => setMechanicId(e.target.value)}
            >
              {(mechanics || []).map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.fullName || `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}

        {isMasterUser && mechanics.length === 1 ? (
          <TextField
            fullWidth
            sx={{ mb: 3 }}
            label={t('appointment.mechanic', 'Механік')}
            value={mechanics[0].fullName || `${mechanics[0].first_name || ''} ${mechanics[0].last_name || ''}`.trim() || mechanics[0].id}
            disabled
          />
        ) : null}

        {grouped.length === 0 ? (
          <Typography color="text.secondary">{t('services.empty', 'Немає послуг')}</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {grouped.map((group) => (
              <Box key={group.label}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                  {group.label}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  {group.items
                    .slice()
                    .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
                    .map((service) => (
                      <FormControlLabel
                        key={service.id}
                        control={
                          <Checkbox
                            checked={Boolean(service.is_enabled)}
                            onChange={() => handleToggle(service)}
                            disabled={saving}
                          />
                        }
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, width: '100%' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                              <Typography>{service.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatServicePrice(service)}
                                {formatServicePrice(service) && formatServiceDuration(service) ? ' • ' : ''}
                                {formatServiceDuration(service)}
                              </Typography>
                              {service.description ? (
                                <Typography variant="caption" color="text.secondary">
                                  {service.description}
                                </Typography>
                              ) : null}
                            </Box>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<EditIcon />}
                              disabled={saving}
                              onClick={(e) => {
                                e.preventDefault();
                                openEdit(service);
                              }}
                            >
                              {t('common.edit', 'Редагувати')}
                            </Button>
                          </Box>
                        }
                      />
                    ))}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Paper>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('services.add', 'Додати послугу')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            fullWidth
            label={t('services.name', 'Назва')}
            value={draft.name}
            disabled={!draft.isOwned}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            label={t('services.description', 'Опис')}
            value={draft.description}
            disabled={!draft.isOwned}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            sx={{ mt: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <TextField
              fullWidth
              label={t('services.price', 'Ціна')}
              value={draft.price}
              onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
            />
            <TextField
              fullWidth
              label={t('services.duration', 'Час (хв)')}
              value={draft.duration}
              onChange={(e) => setDraft((d) => ({ ...d, duration: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} disabled={saving}>
            {t('common.cancel', 'Скасувати')}
          </Button>
          <Button onClick={submitCreate} variant="contained" disabled={saving}>
            {t('common.save', 'Зберегти')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('common.edit', 'Редагувати')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            fullWidth
            label={t('services.name', 'Назва')}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            label={t('services.description', 'Опис')}
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            sx={{ mt: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <TextField
              fullWidth
              label={t('services.price', 'Ціна')}
              value={draft.price}
              onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
            />
            <TextField
              fullWidth
              label={t('services.duration', 'Час (хв)')}
              value={draft.duration}
              onChange={(e) => setDraft((d) => ({ ...d, duration: e.target.value }))}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={saving}>
            {t('common.cancel', 'Скасувати')}
          </Button>
          <Button onClick={submitEdit} variant="contained" disabled={saving}>
            {t('common.save', 'Зберегти')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={2500}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        message={snackbar.message}
      />
    </Container>
  );
};

export default MyServices;
