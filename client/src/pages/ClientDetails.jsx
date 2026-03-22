import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography
} from '@mui/material';

import * as usersDao from '../api/dao/usersDao';
import * as vehiclesDao from '../api/dao/vehiclesDao';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const resolveUrl = (url) => (url.startsWith('http') ? url : `${API_BASE_URL}${url}`);

const ClientDetails = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();

  const [client, setClient] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', patronymic: '', phone: '' });

  const title = useMemo(() => {
    if (!client) return t('clients.card.title', 'Клієнт');
    return client.name || client.phone || client.email || t('clients.card.title', 'Клієнт');
  }, [client, t]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const user = await usersDao.getById(id);
        if (!alive) return;
        setClient(user);
        const fullName = String(user?.name || '').trim();
        const parts = fullName ? fullName.split(/\s+/).filter(Boolean) : [];
        setEditForm({
          firstName: String(user?.firstName || user?.first_name || parts[0] || ''),
          lastName: String(user?.lastName || user?.last_name || parts[1] || ''),
          patronymic: String(user?.patronymic || parts.slice(2).join(' ') || ''),
          phone: String(user?.phone || ''),
        });

        const list = await vehiclesDao.listForUser(id);
        if (!alive) return;
        setVehicles(Array.isArray(list) ? list : []);
      } catch (err) {
        if (!alive) return;
        setError(err?.message || t('common.error', 'Помилка'));
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [id, t]);

  const updateClient = async () => {
    setEditSaving(true);
    setEditError('');
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(resolveUrl(`/api/users/${encodeURIComponent(id)}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          firstName: String(editForm.firstName || '').trim() || null,
          lastName: String(editForm.lastName || '').trim() || null,
          patronymic: String(editForm.patronymic || '').trim() || null,
          name: [editForm.firstName, editForm.lastName, editForm.patronymic]
            .map((v) => String(v || '').trim())
            .filter(Boolean)
            .join(' ')
            .trim(),
          phone: String(editForm.phone || '').trim()
        })
      });
      if (!res.ok) {
        let message = `Request failed with status ${res.status}`;
        try {
          const body = await res.json();
          if (body && typeof body.message === 'string') message = body.message;
          if (body && typeof body.msg === 'string') message = body.msg;
        } catch (_) {
          void 0;
        }
        throw new Error(message);
      }
      const updated = await res.json();
      setClient((prev) => ({ ...(prev || {}), ...(updated || {}) }));
      setEditOpen(false);
    } catch (err) {
      setEditError(err?.message || t('common.error', 'Помилка'));
    } finally {
      setEditSaving(false);
    }
  };

  const disconnectClient = async () => {
    const ok = window.confirm(t('clients.card.confirmDisconnect', 'Від’єднати клієнта?'));
    if (!ok) return;
    try {
      const token = localStorage.getItem('auth_token');
      const listRes = await fetch(resolveUrl('/api/relationships/clients'), {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (!listRes.ok) {
        throw new Error(`Request failed with status ${listRes.status}`);
      }
      const rels = await listRes.json();
      const rel = Array.isArray(rels) ? rels.find((r) => String(r.client_id) === String(id)) : null;
      if (!rel?.id) {
        throw new Error(t('clients.card.relationshipNotFound', 'Звʼязок не знайдено'));
      }

      const res = await fetch(resolveUrl(`/api/relationships/${encodeURIComponent(rel.id)}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ status: 'rejected' })
      });

      if (!res.ok) {
        let message = `Request failed with status ${res.status}`;
        try {
          const body = await res.json();
          if (body && typeof body.message === 'string') message = body.message;
        } catch (_) {
          void 0;
        }
        throw new Error(message);
      }

      navigate('/my-clients');
    } catch (err) {
      setError(err?.message || t('common.error', 'Помилка'));
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">{title}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={() => setEditOpen(true)} disabled={loading || !!error || !client}>
            {t('common.edit', 'Редагувати')}
          </Button>
          <Button variant="outlined" color="error" onClick={disconnectClient} disabled={loading}>
            {t('common.delete', 'Видалити')}
          </Button>
          <Button variant="outlined" onClick={() => navigate('/my-clients')}>
            {t('common.back', 'Назад')}
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                {t('clients.card.contact', 'Контакти')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                {t('common.name', 'Імʼя')}
              </Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                {client?.name || '—'}
              </Typography>

              <Typography variant="body2" color="text.secondary">
                {t('common.phone', 'Телефон')}
              </Typography>
              <Typography variant="body1" sx={{ mb: 1 }}>
                {client?.phone || '—'}
              </Typography>

              <Typography variant="body2" color="text.secondary">
                {t('common.email', 'Email')}
              </Typography>
              <Typography variant="body1">{client?.email || '—'}</Typography>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                {t('vehicle.title_plural', 'Автомобілі')}
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {vehicles.length === 0 ? (
                <Typography color="text.secondary">
                  {t('clients.card.noVehicles', 'Автомобілі не знайдено')}
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {vehicles.map((v) => (
                    <Box
                      key={v.vin}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        px: 2,
                        py: 1
                      }}
                    >
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {v.make} {v.model}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {v.licensePlate ? `(${v.licensePlate})` : v.vin}
                        </Typography>
                      </Box>
                      <Button size="small" onClick={() => navigate(`/vehicles/${encodeURIComponent(v.vin)}`)}>
                        {t('common.open', 'Відкрити')}
                      </Button>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={editOpen} onClose={() => !editSaving && setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('clients.card.editTitle', 'Редагувати клієнта')}</DialogTitle>
        <DialogContent>
          {editError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {editError}
            </Alert>
          ) : null}
          <TextField
            margin="dense"
            label={t('common.firstName', 'Імʼя')}
            fullWidth
            value={editForm.firstName}
            onChange={(e) => setEditForm((prev) => ({ ...prev, firstName: e.target.value }))}
            disabled={editSaving}
          />
          <TextField
            margin="dense"
            label={t('common.lastName', 'Прізвище')}
            fullWidth
            value={editForm.lastName}
            onChange={(e) => setEditForm((prev) => ({ ...prev, lastName: e.target.value }))}
            disabled={editSaving}
          />
          <TextField
            margin="dense"
            label={t('common.patronymic', 'По батькові')}
            fullWidth
            value={editForm.patronymic}
            onChange={(e) => setEditForm((prev) => ({ ...prev, patronymic: e.target.value }))}
            disabled={editSaving}
          />
          <TextField
            margin="dense"
            label={t('common.phone', 'Телефон')}
            fullWidth
            value={editForm.phone}
            onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
            disabled={editSaving}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={editSaving}>
            {t('common.cancel', 'Скасувати')}
          </Button>
          <Button onClick={updateClient} variant="contained" disabled={editSaving}>
            {editSaving ? <CircularProgress size={20} /> : t('common.save', 'Зберегти')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ClientDetails;
