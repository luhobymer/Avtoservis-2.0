import React, { useState, useEffect, useCallback } from 'react';
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
  CircularProgress,
  Alert
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BuildIcon from '@mui/icons-material/Build';
import EventIcon from '@mui/icons-material/Event';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAuth } from '../context/useAuth';
import * as notificationsDao from '../api/dao/notificationsDao';

const Notifications = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      if (!user?.id) {
        setNotifications([]);
      } else {
        const rows = await notificationsDao.listForUser(user.id);
        setNotifications(rows);
      }
      setError(null);
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [user?.id, fetchNotifications]);

  const markAsRead = async (id) => {
    try {
      await notificationsDao.markAsRead(id);
      setNotifications(notifications.map(notification => 
        notification.id === id ? { ...notification, read: true } : notification
      ));
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to mark notification as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      if (user?.id) await notificationsDao.markAllRead(user.id);
      setNotifications(notifications.map(notification => ({ ...notification, read: true })));
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to mark all notifications as read');
    }
  };

  const deleteNotification = async (id) => {
    try {
      await notificationsDao.deleteById(id);
      setNotifications(notifications.filter(notification => notification.id !== id));
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to delete notification');
    }
  };

  const deleteAllNotifications = async () => {
    try {
      if (user?.id) await notificationsDao.deleteAllForUser(user.id);
      setNotifications([]);
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to delete all notifications');
    }
  };

  const handleNotificationClick = (notification) => {
    // Mark as read if not already read
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // Navigate based on notification type
    if (notification.type === 'appointment') {
      navigate(`/appointments/${notification.referenceId}`);
    } else if (notification.type === 'service-record') {
      navigate(`/service-records/${notification.referenceId}`);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'appointment':
        return <EventIcon />;
      case 'service-record':
        return <BuildIcon />;
      case 'status-update':
        return <CheckCircleOutlineIcon />;
      default:
        return <NotificationsIcon />;
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        {t('notifications.title')}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

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
              >
                {t('notifications.markAllRead')}
              </Button>
            )}
            {notifications.length > 0 && (
              <Button 
                size="small" 
                color="error" 
                onClick={deleteAllNotifications}
              >
                {t('notifications.deleteAll')}
              </Button>
            )}
          </Box>
        </Box>
        <Divider />

        {notifications.length === 0 ? (
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
          </List>
        )}
      </Paper>
    </Container>
  );
};

export default Notifications;
