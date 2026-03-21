import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Divider,
  Box,
  Chip,
  Button,
  Alert,
  Skeleton
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BuildIcon from '@mui/icons-material/Build';
import EventIcon from '@mui/icons-material/Event';
import DeleteIcon from '@mui/icons-material/Delete';
import AlarmIcon from '@mui/icons-material/Alarm';
import { useAuth } from '../context/useAuth';
import * as notificationsDao from '../api/dao/notificationsDao';

const Notifications = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const pageSize = 20;

  const withRetry = useCallback(async (fn, options = {}) => {
    const retries = typeof options.retries === 'number' ? options.retries : 2;
    const baseDelayMs = typeof options.baseDelayMs === 'number' ? options.baseDelayMs : 500;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        const message = String(err?.message || '');
        const maybeTransient =
          message.includes('NetworkError') ||
          message.includes('Failed to fetch') ||
          message.includes('timeout') ||
          message.includes('502') ||
          message.includes('503') ||
          message.includes('504');
        const shouldRetry = attempt < retries && maybeTransient;
        if (!shouldRetry) throw err;
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    return undefined;
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setLoadingMore(false);
    try {
      if (!user?.id) {
        setNotifications([]);
        setHasMore(false);
        setNextOffset(0);
      } else {
        const page = await withRetry(() =>
          notificationsDao.listForUserPaged(user.id, { limit: pageSize, offset: 0 })
        );
        setNotifications(Array.isArray(page?.rows) ? page.rows : []);
        setHasMore(!!page?.hasMore);
        setNextOffset(typeof page?.nextOffset === 'number' ? page.nextOffset : 0);
      }
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.msg || err?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [pageSize, user?.id, withRetry]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore) return;
    if (!user?.id) return;
    if (!hasMore) return;
    setLoadingMore(true);
    try {
      const page = await withRetry(() =>
        notificationsDao.listForUserPaged(user.id, { limit: pageSize, offset: nextOffset })
      );
      const newRows = Array.isArray(page?.rows) ? page.rows : [];
      setNotifications((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        const merged = prev.slice();
        for (const n of newRows) {
          if (!seen.has(n.id)) merged.push(n);
        }
        return merged;
      });
      setHasMore(!!page?.hasMore);
      setNextOffset(typeof page?.nextOffset === 'number' ? page.nextOffset : nextOffset + newRows.length);
    } catch (err) {
      setError(err?.response?.data?.msg || err?.message || 'Failed to load notifications');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loading, loadingMore, nextOffset, pageSize, user?.id, withRetry]);

  useEffect(() => {
    fetchNotifications();
  }, [user?.id, fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      await notificationsDao.markAsRead(id);
      setNotifications((prev) =>
        prev.map((notification) => (notification.id === id ? { ...notification, read: true } : notification))
      );
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      if (user?.id) await notificationsDao.markAllRead(user.id);
      setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to mark all notifications as read');
    }
  };

  const deleteNotification = async (id) => {
    try {
      await notificationsDao.deleteById(id);
      setNotifications((prev) => prev.filter((notification) => notification.id !== id));
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to delete notification');
    }
  };

  const deleteAllNotifications = async () => {
    try {
      if (user?.id) await notificationsDao.deleteAllForUser(user.id);
      setNotifications([]);
      setHasMore(false);
      setNextOffset(0);
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to delete all notifications');
    }
  };

  const handleNotificationClick = (notification) => {
    // Mark as read if not already read
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    const msg = String(notification?.message || '').toLowerCase();
    const title = String(notification?.title || '').toLowerCase();
    const wantsChat =
      notification?.type === 'chat' ||
      notification?.type === 'message' ||
      notification?.type === 'chat_message' ||
      msg.includes('чат') ||
      msg.includes('повідом') ||
      title.includes('чат') ||
      title.includes('повідом');

    // Navigate based on notification type
    if (notification.type === 'appointment' && notification.referenceId) {
      navigate(`/appointments/${notification.referenceId}${wantsChat ? '#chat' : ''}`);
      return;
    }
    if (notification.type === 'service-record' && notification.referenceId) {
      navigate(`/service-records/${notification.referenceId}`);
      return;
    }
    if (notification.type === 'reminder') {
      let reminderId = null;
      try {
        const raw = notification?.data;
        const parsed = raw && typeof raw === 'string' ? JSON.parse(raw) : raw;
        reminderId = parsed?.reminderId || parsed?.reminder_id || null;
      } catch (_) {
        void _;
      }
      navigate(reminderId ? `/reminders?reminderId=${encodeURIComponent(reminderId)}` : '/reminders');
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'appointment':
        return <EventIcon />;
      case 'chat':
      case 'message':
      case 'chat_message':
        return <EventIcon />;
      case 'service-record':
        return <BuildIcon />;
      case 'status-update':
        return <CheckCircleOutlineIcon />;
      case 'reminder':
        return <AlarmIcon />;
      default:
        return <NotificationsIcon />;
    }
  };

  const skeletonItems = useMemo(() => Array.from({ length: 7 }, (_, i) => i), []);

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        {t('notifications.title')}
      </Typography>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={fetchNotifications}>
              {t('common.retry', 'Повторити')}
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <Paper elevation={3}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            {t('notifications.all')}
          </Typography>
          <Box>
            {notifications.some(n => !n.read) && (
              <Button 
                size="small" 
                onClick={markAllAsRead} 
                sx={{ mr: 1 }}
                disabled={loading}
              >
                {t('notifications.markAllRead')}
              </Button>
            )}
            {notifications.length > 0 && (
              <Button 
                size="small" 
                color="error" 
                onClick={deleteAllNotifications}
                disabled={loading}
              >
                {t('notifications.deleteAll')}
              </Button>
            )}
          </Box>
        </Box>
        <Divider />

        {loading ? (
          <List>
            {skeletonItems.map((key) => (
              <React.Fragment key={key}>
                <ListItem alignItems="flex-start">
                  <ListItemIcon sx={{ mt: 1 }}>
                    <Skeleton variant="circular" width={24} height={24} />
                  </ListItemIcon>
                  <ListItemText
                    primary={<Skeleton width="60%" />}
                    secondary={
                      <React.Fragment>
                        <Skeleton width="90%" />
                        <Skeleton width="40%" />
                      </React.Fragment>
                    }
                  />
                  <Skeleton variant="circular" width={32} height={32} />
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))}
          </List>
        ) : notifications.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {t('notifications.empty')}
            </Typography>
          </Box>
        ) : (
          <List>
            {notifications.map((notification) => (
              <React.Fragment key={notification.id}>
                <ListItem 
                  alignItems="flex-start"
                  sx={{
                    backgroundColor: notification.read ? 'inherit' : 'rgba(25, 118, 210, 0.08)',
                    '&:hover': {
                      backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  <ListItemIcon sx={{ mt: 1 }}>
                    {getNotificationIcon(notification.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography 
                          variant="subtitle1" 
                          component="span" 
                          sx={{ cursor: 'pointer', flexGrow: 1 }}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          {notification.title}
                        </Typography>
                        {!notification.read && (
                          <Chip 
                            label={t('notifications.new')} 
                            size="small" 
                            color="primary" 
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <React.Fragment>
                        <Typography
                          variant="body2"
                          color="text.primary"
                          sx={{ display: 'block', cursor: 'pointer', mb: 1 }}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          {notification.message}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(notification.createdAt).toLocaleString()}
                        </Typography>
                      </React.Fragment>
                    }
                  />
                  <IconButton 
                    edge="end" 
                    aria-label="delete" 
                    onClick={() => deleteNotification(notification.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))}

            {hasMore ? (
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                <Button onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? t('common.loading', 'Завантаження...') : t('common.loadMore', 'Завантажити ще')}
                </Button>
              </Box>
            ) : null}
          </List>
        )}
      </Paper>
    </Container>
  );
};

export default Notifications;
