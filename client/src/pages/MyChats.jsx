import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Box,
  CircularProgress,
  Container,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { listConversations } from '../api/dao/interactionsDao';

const MyChats = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const rows = await listConversations({ related_entity: 'appointment', limit: 400 });
        setConversations(rows);
      } catch (err) {
        setError(err?.message || t('common.error', 'Помилка'));
      } finally {
        setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [t]);

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
        <Typography variant="h5" gutterBottom>
          {t('chats.myChats', 'Мої чати')}
        </Typography>

        {error ? (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        ) : null}

        {conversations.length === 0 ? (
          <Typography color="text.secondary">{t('chats.empty', 'Немає чатів')}</Typography>
        ) : (
          <List>
            {conversations.map((c) => (
              <ListItem
                key={c.related_entity_id}
                button
                onClick={() => navigate(`/appointments/${c.related_entity_id}`)}
                sx={{ borderRadius: 2 }}
              >
                <Box sx={{ mr: 2 }}>
                  <Badge color="error" badgeContent={c.unread_count || 0} invisible={!c.unread_count} />
                </Box>
                <ListItemText
                  primary={t('chats.appointmentChat', 'Чат по запису')}
                  secondary={
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="caption" color="text.secondary">
                        {c.last_at ? new Date(c.last_at).toLocaleString() : ''}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 520 }}>
                        {c.last_message || ''}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>
    </Container>
  );
};

export default MyChats;
