import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  TextField,
  Typography
} from '@mui/material';
import useAuth from '../../context/useAuth';
import {
  createInteraction,
  listEntityInteractions,
  updateInteractionStatus
} from '../../api/dao/interactionsDao';

const normalizeId = (value) => (value == null ? '' : String(value));

const AppointmentChat = ({ appointmentId, recipientId }) => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const currentUserId = normalizeId(user?.id);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  const effectiveRecipientId = normalizeId(recipientId);
  const canSend = Boolean(currentUserId && effectiveRecipientId && appointmentId);

  const unreadToMark = useMemo(() => {
    const uid = currentUserId;
    return (messages || [])
      .filter((m) => normalizeId(m?.recipient_id) === uid && String(m?.status || '') === 'unread')
      .map((m) => m.id)
      .filter(Boolean);
  }, [messages, currentUserId]);

  const load = useCallback(async () => {
    if (!appointmentId) return;
    try {
      setError('');
      const list = await listEntityInteractions('appointment', appointmentId);
      setMessages(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err?.message || t('common.error', 'Помилка'));
    } finally {
      setLoading(false);
    }
  }, [appointmentId, t]);

  useEffect(() => {
    setLoading(true);
    void load();
    const interval = setInterval(() => {
      void load();
    }, 5000);
    return () => clearInterval(interval);
  }, [appointmentId, load]);

  useEffect(() => {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    const run = async () => {
      if (!currentUserId) return;
      if (unreadToMark.length === 0) return;
      for (const id of unreadToMark) {
        try {
          await updateInteractionStatus(id, 'read');
        } catch (_) {
          break;
        }
      }
    };
    void run();
  }, [unreadToMark, currentUserId]);

  const handleSend = async () => {
    const message = String(text || '').trim();
    if (!message || !canSend) return;
    setSending(true);
    try {
      await createInteraction({
        sender_id: currentUserId,
        recipient_id: effectiveRecipientId,
        message,
        type: 'message',
        status: 'unread',
        related_entity: 'appointment',
        related_entity_id: String(appointmentId)
      });
      setText('');
      await load();
    } catch (err) {
      setError(err?.message || t('common.error', 'Помилка'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Paper sx={{ p: 2, mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        {t('chat.title', 'Чат')}
      </Typography>
      <Divider sx={{ mb: 2 }} />

      {error ? (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      ) : null}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 320, overflowY: 'auto', mb: 2 }}>
          {(messages || []).length === 0 ? (
            <Typography color="text.secondary">
              {t('chat.empty', 'Повідомлень ще немає')}
            </Typography>
          ) : (
            (messages || []).map((m) => {
              const mine = normalizeId(m?.sender_id) === currentUserId;
              return (
                <Box
                  key={m.id}
                  sx={{
                    display: 'flex',
                    justifyContent: mine ? 'flex-end' : 'flex-start'
                  }}
                >
                  <Box
                    sx={{
                      maxWidth: '80%',
                      px: 1.5,
                      py: 1,
                      borderRadius: 2,
                      bgcolor: mine ? 'rgba(198, 40, 40, 0.12)' : 'rgba(0, 0, 0, 0.06)'
                    }}
                  >
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                      {m.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {m.created_at ? new Date(m.created_at).toLocaleString() : ''}
                    </Typography>
                  </Box>
                </Box>
              );
            })
          )}
          <div ref={bottomRef} />
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('chat.placeholder', 'Напишіть повідомлення...')}
          disabled={!canSend || sending}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <Button variant="contained" onClick={handleSend} disabled={!canSend || sending}>
          {t('chat.send', 'Надіслати')}
        </Button>
      </Box>
    </Paper>
  );
};

export default AppointmentChat;
