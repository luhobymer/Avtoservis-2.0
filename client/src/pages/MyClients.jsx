import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  Tab
} from '@mui/material';
import {
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

const api = {
  getMyClients: async () => {
    const token = localStorage.getItem('auth_token');
    const res = await fetch('/api/relationships/clients', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  },
  updateStatus: async (id, status) => {
    const token = localStorage.getItem('auth_token');
    const res = await fetch(`/api/relationships/${id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Failed to update status');
    return res.json();
  }
};

const MyClients = () => {
  const { t } = useTranslation();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0); // 0: All, 1: Pending, 2: Accepted

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

  const filteredClients = clients.filter(client => {
    if (tabValue === 1) return client.status === 'pending';
    if (tabValue === 2) return client.status === 'accepted';
    return true;
  });

  if (loading) return <Container sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Container>;

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>{t('clients.title', 'Мої Клієнти')}</Typography>
        
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

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
                <ListItem alignItems="flex-start">
                  <ListItemAvatar>
                    <Avatar src={client.avatar_url}><PersonIcon /></Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={client.name || client.email}
                    secondary={
                      <React.Fragment>
                        <Typography component="span" variant="body2" color="text.primary">
                          {client.city}
                        </Typography>
                        {client.phone && ` — ${client.phone}`}
                        <br />
                        <Typography component="span" variant="caption" color="text.secondary">
                          Status: {client.status}
                        </Typography>
                      </React.Fragment>
                    }
                  />
                  
                  {client.status === 'pending' && (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button 
                        variant="outlined" 
                        color="error" 
                        size="small"
                        onClick={() => handleStatusUpdate(client.id, 'rejected')}
                      >
                        {t('common.reject', 'Відхилити')}
                      </Button>
                      <Button 
                        variant="contained" 
                        color="success" 
                        size="small"
                        onClick={() => handleStatusUpdate(client.id, 'accepted')}
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
      </Paper>
    </Container>
  );
};

export default MyClients;
