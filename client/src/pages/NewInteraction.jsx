import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography
} from '@mui/material';
import useAuth from '../context/useAuth';
import * as usersDao from '../api/dao/usersDao';
import * as vehiclesDao from '../api/dao/vehiclesDao';
import { listForUser as listAppointmentsForUser } from '../api/dao/appointmentsDao';
import { createInteraction } from '../api/dao/interactionsDao';

const normalizeId = (value) => (value == null ? '' : String(value));

const NewInteraction = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const currentUserId = normalizeId(user?.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [recipients, setRecipients] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [appointments, setAppointments] = useState([]);

  const [draft, setDraft] = useState({
    recipientId: '',
    type: 'message',
    relatedEntity: 'appointment',
    relatedEntityId: '',
    message: ''
  });

  const recipientOptions = useMemo(() => {
    const list = Array.isArray(recipients) ? recipients : [];
    return list.filter((u) => {
      const role = String(u?.role || '').toLowerCase();
      return role === 'admin' || role === 'master' || role === 'mechanic';
    });
  }, [recipients]);

  const relatedOptions = useMemo(() => {
    if (draft.relatedEntity === 'vehicle') {
      return vehicles.map((v) => ({
        id: v.vin,
        label: `${(v.make || v.brand || '').trim()} ${v.model || ''}${v.licensePlate ? ` — ${v.licensePlate}` : ''}`
      }));
    }
    if (draft.relatedEntity === 'appointment') {
      return appointments.map((a) => ({
        id: a.id,
        label: a.scheduledDate
          ? new Date(a.scheduledDate).toLocaleString()
          : a.scheduled_time
            ? new Date(a.scheduled_time).toLocaleString()
            : `#${a.id}`
      }));
    }
    return [];
  }, [appointments, draft.relatedEntity, vehicles]);

  const load = useCallback(async () => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [usersList, vehiclesList, appointmentsList] = await Promise.all([
        usersDao.list(),
        vehiclesDao.listForUser(currentUserId),
        listAppointmentsForUser(currentUserId)
      ]);

      const safeUsers = Array.isArray(usersList) ? usersList : [];
      const safeVehicles = Array.isArray(vehiclesList) ? vehiclesList : [];
      const safeAppointments = Array.isArray(appointmentsList) ? appointmentsList : [];

      setRecipients(safeUsers);
      setVehicles(safeVehicles);
      setAppointments(safeAppointments);

      if (!draft.recipientId) {
        const first = safeUsers.find((u) => {
          const role = String(u?.role || '').toLowerCase();
          return role === 'admin' || role === 'master' || role === 'mechanic';
        });
        if (first?.id) {
          setDraft((prev) => ({ ...prev, recipientId: String(first.id) }));
        }
      }

      if (!draft.relatedEntityId) {
        if (draft.relatedEntity === 'appointment' && safeAppointments.length > 0) {
          setDraft((prev) => ({ ...prev, relatedEntityId: String(safeAppointments[0].id) }));
        }
        if (draft.relatedEntity === 'vehicle' && safeVehicles.length > 0) {
          setDraft((prev) => ({ ...prev, relatedEntityId: String(safeVehicles[0].vin) }));
        }
      }
    } catch (err) {
      setError(err?.message || t('common.error', 'Помилка'));
    } finally {
      setLoading(false);
    }
  }, [currentUserId, draft.recipientId, draft.relatedEntity, draft.relatedEntityId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    // When switching related entity, reset id to first available.
    if (draft.relatedEntity === 'appointment') {
      if (appointments.length > 0) {
        setDraft((prev) => ({ ...prev, relatedEntityId: String(appointments[0].id) }));
      } else {
        setDraft((prev) => ({ ...prev, relatedEntityId: '' }));
      }
      return;
    }

    if (draft.relatedEntity === 'vehicle') {
      if (vehicles.length > 0) {
        setDraft((prev) => ({ ...prev, relatedEntityId: String(vehicles[0].vin) }));
      } else {
        setDraft((prev) => ({ ...prev, relatedEntityId: '' }));
      }
    }
  }, [draft.relatedEntity, appointments, vehicles]);

  const handleSubmit = async () => {
    const message = String(draft.message || '').trim();
    if (!draft.recipientId) {
      setError(t('interactions.select_recipient', 'Оберіть отримувача'));
      return;
    }
    if (!message) {
      setError(t('interactions.enter_message', 'Введіть повідомлення'));
      return;
    }
    if (!draft.relatedEntityId) {
      setError(t('interactions.related_entity', 'Оберіть повʼязану сутність'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      await createInteraction({
        sender_id: currentUserId,
        recipient_id: String(draft.recipientId),
        message,
        type: String(draft.type || 'message'),
        status: 'unread',
        related_entity: String(draft.relatedEntity || 'appointment'),
        related_entity_id: String(draft.relatedEntityId)
      });

      // After send — go to related entity chat.
      if (draft.relatedEntity === 'appointment') {
        navigate(`/appointments/${draft.relatedEntityId}#chat`);
      } else {
        navigate('/interactions');
      }
    } catch (err) {
      setError(err?.message || t('interactions.send_error', 'Не вдалося відправити'));
    } finally {
      setSaving(false);
    }
  };

  if (!currentUserId) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{t('errors.unauthorized', 'Будь ласка, увійдіть в систему.')}</Alert>
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
    <Container maxWidth="sm" sx={{ mt: 4, mb: 6 }}>
      <Paper sx={{ p: 3 }} elevation={3}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h5">{t('interactions.new', 'Нова взаємодія')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('interactions.newSubtitle', 'Надішліть повідомлення майстру/адміну з привʼязкою до сутності')}
          </Typography>
        </Box>

        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControl fullWidth>
            <InputLabel id="recipient-label">{t('interactions.recipient', 'Отримувач')}</InputLabel>
            <Select
              labelId="recipient-label"
              value={draft.recipientId}
              label={t('interactions.recipient', 'Отримувач')}
              onChange={(e) => setDraft((prev) => ({ ...prev, recipientId: e.target.value }))}
            >
              {recipientOptions.map((u) => (
                <MenuItem key={u.id} value={String(u.id)}>
                  {u.name || u.email} ({u.role})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="type-label">{t('interactions.type', 'Тип')}</InputLabel>
            <Select
              labelId="type-label"
              value={draft.type}
              label={t('interactions.type', 'Тип')}
              onChange={(e) => setDraft((prev) => ({ ...prev, type: e.target.value }))}
            >
              <MenuItem value="message">{t('interactions.types.message', 'Повідомлення')}</MenuItem>
              <MenuItem value="question">{t('interactions.types.question', 'Питання')}</MenuItem>
              <MenuItem value="request">{t('interactions.types.request', 'Запит')}</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="entity-label">{t('interactions.related_entity', 'Сутність')}</InputLabel>
            <Select
              labelId="entity-label"
              value={draft.relatedEntity}
              label={t('interactions.related_entity', 'Сутність')}
              onChange={(e) => setDraft((prev) => ({ ...prev, relatedEntity: e.target.value }))}
            >
              <MenuItem value="appointment">{t('interactions.entities.appointment', 'Запис')}</MenuItem>
              <MenuItem value="vehicle">{t('interactions.entities.vehicle', 'Авто')}</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="entity-id-label">{t('interactions.entity', 'Обрати')}</InputLabel>
            <Select
              labelId="entity-id-label"
              value={draft.relatedEntityId}
              label={t('interactions.entity', 'Обрати')}
              onChange={(e) => setDraft((prev) => ({ ...prev, relatedEntityId: e.target.value }))}
            >
              {relatedOptions.map((opt) => (
                <MenuItem key={opt.id} value={String(opt.id)}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            multiline
            minRows={4}
            label={t('interactions.message', 'Повідомлення')}
            value={draft.message}
            onChange={(e) => setDraft((prev) => ({ ...prev, message: e.target.value }))}
          />

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button variant="outlined" onClick={() => navigate(-1)} disabled={saving}>
              {t('common.cancel', 'Скасувати')}
            </Button>
            <Button variant="contained" onClick={handleSubmit} disabled={saving}>
              {saving ? t('common.saving', 'Збереження...') : t('interactions.send', 'Надіслати')}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default NewInteraction;
