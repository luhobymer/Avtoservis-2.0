import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Button,
  Box,
  CircularProgress,
  Alert,
  Divider,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const resolveUrl = (url) => (url.startsWith('http') ? url : `${API_BASE_URL}${url}`);

const api = {
  getMyClients: async () => {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(resolveUrl('/api/relationships/clients'), {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  },
  updateStatus: async (id, status) => {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(resolveUrl(`/api/relationships/${id}`), {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Failed to update status');
    return res.json();
  },
  createClientWithRelationship: async ({ firstName, lastName, phone }) => {
    const token = localStorage.getItem('auth_token');
    const cleanedPhone = String(phone || '').trim().replace(/[^\d+]/g, '');
    let normalizedPhone = cleanedPhone;
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = `+380${normalizedPhone.slice(1)}`;
    } else if (normalizedPhone.startsWith('380')) {
      normalizedPhone = `+${normalizedPhone}`;
    }

    const registerRes = await fetch(resolveUrl('/api/auth/register'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        name: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        phone: normalizedPhone,
        password: '12345678',
        role: 'client'
      })
    });
    if (!registerRes.ok) {
      let message = 'Failed to create client';
      try {
        const body = await registerRes.json();
        if (body && typeof body.message === 'string') {
          message = body.message;
        }
      } catch (error) {
        void error;
      }
      throw new Error(message);
    }
    const registerData = await registerRes.json();
    const createdUser = registerData?.user || registerData;
    if (!createdUser?.id) {
      throw new Error('Invalid user response');
    }

    const relRes = await fetch(resolveUrl('/api/relationships/clients'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ client_id: createdUser.id })
    });
    if (!relRes.ok) {
      let message = 'Failed to create relationship';
      try {
        const body = await relRes.json();
        if (body && typeof body.message === 'string') {
          message = body.message;
        }
      } catch (error) {
        void error;
      }
      throw new Error(message);
    }

    return {
      id: createdUser.id,
      client_id: createdUser.id,
      name: createdUser.name || `${firstName} ${lastName}`.trim(),
      email: createdUser.email || '',
      phone: createdUser.phone || normalizedPhone,
      status: 'accepted'
    };
  }
};

const MyClients = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [tabValue, setTabValue] = useState(0); // 0: All, 1: Pending, 2: Accepted
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');
  const [addForm, setAddForm] = useState({
    firstName: '',
    lastName: '',
    phone: ''
  });

  const pickContactForClient = async () => {
    try {
      const contactsApi = navigator?.contacts;
      const canSelect = typeof contactsApi?.select === 'function';
      if (!canSelect) {
        setAddError(
          'Вибір контактів не підтримується цим браузером. Введіть дані вручну або відкрийте сайт у Chrome на Android.'
        );
        return;
      }

      const picked = await contactsApi.select(['name', 'tel'], { multiple: false });
      const contact = Array.isArray(picked) ? picked[0] : null;
      if (!contact) return;

      const nameRaw =
        (Array.isArray(contact.name) ? contact.name[0] : contact.name) || '';
      const phoneRaw =
        (Array.isArray(contact.tel) ? contact.tel[0] : contact.tel) || '';

      const parts = String(nameRaw).trim().split(/\s+/).filter(Boolean);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ');
      const phone = String(phoneRaw).trim();

      setAddForm((prev) => ({
        ...prev,
        firstName,
        lastName,
        phone
      }));
    } catch (err) {
      void err;
      setAddError(t('common.error', 'Помилка'));
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const data = await api.getMyClients();
      setClients(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await api.updateStatus(id, status);
      fetchClients();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddClientChange = (e) => {
    const { name, value } = e.target;
    setAddForm((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateClient = async () => {
    const firstName = String(addForm.firstName || '').trim();
    const lastName = String(addForm.lastName || '').trim();
    const phone = String(addForm.phone || '').trim();
    if (!firstName || !lastName || !phone) {
      setAddError(t('validation.please_fill_all_fields', 'Заповніть усі поля'));
      return;
    }
    const cleanedPhone = phone.replace(/[^\d+]/g, '');
    const phoneRegex = /^(\+?380|0)\d{9}$/;
    if (!phoneRegex.test(cleanedPhone)) {
      setAddError(t('validation.invalid_phone', 'Невірний формат телефону'));
      return;
    }

    setAddSaving(true);
    setAddError('');
    try {
      await api.createClientWithRelationship({ firstName, lastName, phone: cleanedPhone });
      await fetchClients();
      setAddDialogOpen(false);
      setAddForm({ firstName: '', lastName: '', phone: '' });
    } catch (err) {
      setAddError(err?.message || t('common.error', 'Помилка'));
    } finally {
      setAddSaving(false);
    }
  };

  const filteredClients = clients.filter(client => {
    if (tabValue === 1) return client.status === 'pending';
    if (tabValue === 2) return client.status === 'accepted';
    return true;
  });

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" gutterBottom>{t('clients.title', 'Мої Клієнти')}</Typography>
          <Button
            variant="contained"
            onClick={() => {
              setAddForm({ firstName: '', lastName: '', phone: '' });
              setAddError('');
              setAddDialogOpen(true);
            }}
          >
            {t('clients.add', 'Додати клієнта')}
          </Button>
        </Box>
        
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Tabs value={tabValue} onChange={(e, val) => setTabValue(val)} sx={{ mb: 2 }}>
              <Tab label={t('common.all', 'Всі')} />
              <Tab label={t('status.pending', 'Запити')} />
              <Tab label={t('status.active', 'Активні')} />
            </Tabs>

            <List>
              {filteredClients.length === 0 ? (
                <Typography align="center" color="text.secondary" sx={{ py: 4 }}>
                  {t('clients.empty', 'Список порожній')}
                </Typography>
              ) : (
                filteredClients.map((client) => (
                  <React.Fragment key={client.id}>
                    <ListItem
                      alignItems="flex-start"
                      button
                      onClick={() => navigate(`/my-clients/${encodeURIComponent(client.client_id || client.id)}`)}
                    >
                      <ListItemAvatar>
                        <Avatar src={client.avatar_url}><PersonIcon /></Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={client.name || client.email}
                        secondary={
                          <>
                            <Typography component="span" variant="body2" color="text.primary">
                              {client.city}
                            </Typography>
                            {client.phone && ` — ${client.phone}`}
                            <br />
                            <Typography component="span" variant="caption" color="text.secondary">
                              Status: {client.status}
                            </Typography>
                          </>
                        }
                      />
                      
                      {client.status === 'pending' && (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button 
                            variant="outlined" 
                            color="error" 
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusUpdate(client.id, 'rejected');
                            }}
                          >
                            {t('common.reject', 'Відхилити')}
                          </Button>
                          <Button 
                            variant="contained" 
                            color="success" 
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusUpdate(client.id, 'accepted');
                            }}
                          >
                            {t('common.accept', 'Прийняти')}
                          </Button>
                        </Box>
                      )}
                      {client.status === 'accepted' && (
                        <CheckCircleIcon color="success" />
                      )}
                    </ListItem>
                    <Divider variant="inset" component="li" />
                  </React.Fragment>
                ))
              )}
            </List>
          </>
        )}
      </Paper>

      <Dialog open={addDialogOpen} onClose={() => !addSaving && setAddDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('clients.add', 'Додати клієнта')}</DialogTitle>
        <DialogContent>
          {addError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {addError}
            </Alert>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
            <Button onClick={pickContactForClient} disabled={addSaving}>
              {t('contacts.from_phone', 'З контактів')}
            </Button>
          </Box>
          <TextField
            margin="dense"
            label={t('common.name_placeholder', 'Введіть імʼя')}
            fullWidth
            name="firstName"
            value={addForm.firstName}
            onChange={handleAddClientChange}
          />
          <TextField
            margin="dense"
            label={t('common.lastname_placeholder', 'Введіть прізвище')}
            fullWidth
            name="lastName"
            value={addForm.lastName}
            onChange={handleAddClientChange}
          />
          <TextField
            margin="dense"
            label={t('common.phone_placeholder', 'Наприклад: 0501234567')}
            fullWidth
            name="phone"
            value={addForm.phone}
            onChange={handleAddClientChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)} disabled={addSaving}>
            {t('common.cancel', 'Скасувати')}
          </Button>
          <Button onClick={handleCreateClient} disabled={addSaving} variant="contained">
            {addSaving ? <CircularProgress size={20} /> : t('common.save', 'Зберегти')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MyClients;
