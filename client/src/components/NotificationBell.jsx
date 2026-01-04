import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BuildIcon from '@mui/icons-material/Build';
import EventIcon from '@mui/icons-material/Event';
import useAuth from '../context/useAuth';
import * as notificationsDao from '../api/dao/notificationsDao';

const NotificationBell = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  
  const fetchNotifications = useCallback(async () => {
    try {
      if (!user?.id) return;
      const rows = await notificationsDao.listForUser(user.id);
      setNotifications(rows);
      setUnreadCount(rows.filter(notification => !notification.read).length);
    } catch (error) {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, user?.id, fetchNotifications]);
  
  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleClose = () => {
    setAnchorEl(null);
  };
  
  const handleNotificationClick = async (notification) => {
    // Mark as read
    if (!notification.read) {
      try {
        await notificationsDao.markAsRead(notification.id);
        // Update local state
        setNotifications(prevNotifications =>
          prevNotifications.map(n =>
            n.id === notification.id ? { ...n, read: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }
    
    // Navigate based on notification type
    if (notification.type === 'appointment') {
      navigate(`/appointments/${notification.referenceId}`);
    } else if (notification.type === 'service-record') {
      navigate(`/service-records/${notification.referenceId}`);
    }
    
    handleClose();
  };
  
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'appointment':
        return <EventIcon fontSize="small" />;
      case 'service-record':
        return <BuildIcon fontSize="small" />;
      case 'status-update':
        return <CheckCircleOutlineIcon fontSize="small" />;
      default:
        return <NotificationsIcon fontSize="small" />;
    }
  };
  
  if (!isAuthenticated) return null;
  
  return (
    <>
      <IconButton 
        color="inherit" 
        onClick={handleClick}
        aria-label={t('notifications.title')}
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: { width: 320, maxHeight: 400 },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6">{t('notifications.title')}</Typography>
        </Box>
        <Divider />
        
        {notifications.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2">{t('notifications.empty')}</Typography>
          </MenuItem>
        ) : (
          notifications.map(notification => (
            <MenuItem 
              key={notification.id} 
              onClick={() => handleNotificationClick(notification)}
              sx={{
                backgroundColor: notification.read ? 'inherit' : 'rgba(25, 118, 210, 0.08)',
                '&:hover': {
                  backgroundColor: notification.read ? 'rgba(0, 0, 0, 0.04)' : 'rgba(25, 118, 210, 0.12)',
                },
              }}
            >
              <ListItemIcon>
                {getNotificationIcon(notification.type)}
              </ListItemIcon>
              <ListItemText 
                primary={notification.title}
                secondary={
                  <React.Fragment>
                    <Typography variant="body2" component="span" sx={{ display: 'block' }}>
                      {notification.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(notification.createdAt).toLocaleString()}
                    </Typography>
                  </React.Fragment>
                }
              />
            </MenuItem>
          ))
        )}
        
        {notifications.length > 0 && (
          <Box sx={{ p: 1, display: 'flex', justifyContent: 'center' }}>
            <Typography 
              variant="body2" 
              color="primary" 
              sx={{ cursor: 'pointer' }}
              onClick={() => {
                navigate('/notifications');
                handleClose();
              }}
            >
              {t('notifications.viewAll')}
            </Typography>
          </Box>
        )}
      </Menu>
    </>
  );
};

export default NotificationBell;
