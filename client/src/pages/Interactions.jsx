import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Badge,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Typography
} from '@mui/material';
import useAuth from '../context/useAuth';
import { listEntityInteractions, updateInteractionStatus } from '../api/dao/interactionsDao';

const normalizeId = (value) => (value == null ? '' : String(value));

const Interactions = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);

  const currentUserId = normalizeId(user?.id);

  const load = useCallback(async () => {
    if (!currentUserId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      // "Взаємодії" у Mobile — це загальний inbox. Тут беремо все, що стосується appointment.
      // Якщо треба розширити (vehicle/direct), додамо фільтр по related_entity з UI.
      const list = await listEntityInteractions('appointment', '');
      const safe = Array.isArray(list) ? list : [];

      // Only conversations where current user is sender or recipient are returned by backend for non-privileged.
      const sorted = [...safe].sort((a, b) => {
        const atA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const atB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return atB - atA;
      });

      setRows(sorted);
    } catch (err) {
      setRows([]);
      setError(err?.message || t('common.error', 'Помилка'));
    } finally {
      setLoading(false);
    }
  }, [currentUserId, t]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 12000);
    return () => clearInterval(interval);
  }, [load]);

  const unreadCount = useMemo(() => {
    const uid = currentUserId;
    return (rows || []).filter(
      (m) => normalizeId(m?.recipient_id) === uid && String(m?.status || '') === 'unread'
    ).length;
  }, [rows, currentUserId]);

  const markRowRead = async (interaction) => {
    const uid = currentUserId;
    if (!interaction?.id) return;
    if (normalizeId(interaction?.recipient_id) !== uid) return;
    if (String(interaction?.status || '') !== 'unread') return;
    try {
      await updateInteractionStatus(interaction.id, 'read');
      setRows((prev) =>
        (prev || []).map((m) => (m.id === interaction.id ? { ...m, status: 'read' } : m))
      );
    } catch (_) {
      void _;
    }
  };

  const openInteraction = async (interaction) => {
    await markRowRead(interaction);

    const entity = String(interaction?.related_entity || '').toLowerCase();
    const entityId = interaction?.related_entity_id;

    if (entity === 'appointment' && entityId) {
      navigate(`/appointments/${entityId}#chat`);
      return;
    }

    // Fallback: just show appointment list
    navigate('/my-chats');
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
    <Container maxWidth="md" sx={{ mt: 4, mb: 6 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4">{t('interactions.title', 'Взаємодії')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('interactions.subtitle', 'Вхідні повідомлення та запити')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Badge color="error" badgeContent={unreadCount} invisible={!unreadCount}>
            <Box sx={{ width: 10, height: 10 }} />
          </Badge>
          <Button component={Link} to="/interactions/new" variant="contained" color="primary">
            {t('interactions.new', 'Нова взаємодія')}
          </Button>
        </Box>
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Paper elevation={3}>
        {rows.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">{t('interactions.empty', 'Немає взаємодій')}</Typography>
          </Box>
        ) : (
          <List>
            {rows.map((m) => {
              const isUnread =
                normalizeId(m?.recipient_id) === currentUserId && String(m?.status || '') === 'unread';
              const title = m?.sender_name || m?.sender_role || t('interactions.message', 'Повідомлення');
              const created = m?.created_at ? new Date(m.created_at).toLocaleString() : '';
              const secondary = `${m?.message || ''}${created ? `\n${created}` : ''}`;

              return (
                <React.Fragment key={m.id}>
                  <ListItem
                    button
                    alignItems="flex-start"
                    onClick={() => openInteraction(m)}
                    sx={{
                      backgroundColor: isUnread ? 'rgba(25, 118, 210, 0.08)' : 'inherit'
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                            {title}
                          </Typography>
                          {isUnread ? (
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                bgcolor: 'primary.main'
                              }}
                            />
                          ) : null}
                        </Box>
                      }
                      secondary={
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                          {secondary}
                        </Typography>
                      }
                    />
                  </ListItem>
                  <Divider component="li" />
                </React.Fragment>
              );
            })}
          </List>
        )}
      </Paper>
    </Container>
  );
};

export default Interactions;
