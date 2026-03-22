import React, { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Box, Drawer, AppBar, Toolbar, List, Typography, Divider, IconButton, ListItem, ListItemIcon, ListItemText, BottomNavigation, BottomNavigationAction, Paper, useMediaQuery, useTheme, Alert, Snackbar } from '@mui/material';
import { useTranslation } from 'react-i18next';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import EventIcon from '@mui/icons-material/Event';
import EditIcon from '@mui/icons-material/Edit';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import NotificationsIcon from '@mui/icons-material/Notifications';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NotificationBell from '../components/NotificationBell';
import FloatingActionButton from '../components/FloatingActionButton';
import useAuth from '../context/useAuth';

const drawerWidth = 240;

import PeopleIcon from '@mui/icons-material/People';
import EngineeringIcon from '@mui/icons-material/Engineering';
import ChatIcon from '@mui/icons-material/Chat';
import BuildIcon from '@mui/icons-material/Build';
import AlarmIcon from '@mui/icons-material/Alarm';
import HistoryIcon from '@mui/icons-material/History';
import ForumIcon from '@mui/icons-material/Forum';

const MainLayout = () => {
  const { t } = useTranslation();
  const { isAuthenticated, loading, logout, user, isAdmin, isMaster } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [fabMode] = useState('speed-dial');
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showOfflineToast, setShowOfflineToast] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineToast(true);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Redirect if not authenticated
  if (!isAuthenticated && !loading) {
    return <Navigate to="/auth/login" />;
  }

  // Show loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography>{t('common.loading')}</Typography>
      </Box>
    );
  }

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const isMasterUser =
    typeof isMaster === 'function'
      ? isMaster()
      : typeof isAdmin === 'function'
        ? isAdmin()
        : false;

  const menuItems = [
    { text: isMasterUser ? t('nav.masterDashboard', 'Робочий простір') : t('nav.dashboard'), icon: <DashboardIcon />, path: '/' },
    { text: t('nav.vehicles'), icon: <DirectionsCarIcon />, path: '/vehicles' },
    {
      text: isMasterUser ? t('nav.myAppointments', 'Мої записи') : t('nav.appointments'),
      icon: <EventIcon />,
      path: '/appointments'
    },
    ...(!isMasterUser
      ? [{ text: t('nav.myMechanics', 'Мої Механіки'), icon: <EngineeringIcon />, path: '/my-mechanics' }]
      : []),
    ...(isMasterUser
      ? [{ text: t('nav.myClients', 'Мої Клієнти'), icon: <PeopleIcon />, path: '/my-clients' }]
      : []),
    ...(isMasterUser
      ? [{ text: t('nav.myServices', 'Мої послуги'), icon: <EditIcon />, path: '/my-services' }]
      : []),
    { text: t('nav.myChats', 'Мої чати'), icon: <ChatIcon />, path: '/my-chats' },
    { text: t('nav.interactions', 'Взаємодії'), icon: <ForumIcon />, path: '/interactions' },
    { text: t('nav.serviceBook', 'Сервісна книга'), icon: <HistoryIcon />, path: '/service-book' },
    { text: t('nav.myParts', 'Мої запчастини'), icon: <BuildIcon />, path: '/my-parts' },
    { text: t('nav.reminders', 'Нагадування'), icon: <AlarmIcon />, path: '/reminders' },
    { text: t('nav.profile'), icon: <AccountCircleIcon />, path: '/profile' },
  ];

  const mobileNavItems = [
    {
      label: isMasterUser ? t('nav.masterDashboard', 'Робочий простір') : t('nav.dashboard'),
      icon: <DashboardIcon />,
      path: '/'
    },
    { label: t('nav.vehicles'), icon: <DirectionsCarIcon />, path: '/vehicles' },
    { label: t('nav.appointments'), icon: <EventIcon />, path: '/appointments' },
    { label: t('nav.notifications', 'Сповіщення'), icon: <NotificationsIcon />, path: '/notifications' },
    { label: t('nav.serviceBook', 'Сервісна книга'), icon: <HistoryIcon />, path: '/service-book' },
    { label: t('nav.profile'), icon: <AccountCircleIcon />, path: '/profile' },
  ];

  const resolveMobileNavValue = () => {
    const pathname = location.pathname || '/';
    if (pathname === '/' || pathname.startsWith('/master-dashboard')) return '/';
    if (pathname.startsWith('/vehicles')) return '/vehicles';
    if (pathname.startsWith('/appointments')) return '/appointments';
    if (pathname.startsWith('/notifications')) return '/notifications';
    if (pathname.startsWith('/service-book')) return '/service-book';
    if (pathname.startsWith('/profile')) return '/profile';
    return false;
  };

  const drawer = (
    <div>
      <Toolbar
        sx={{
          background: 'linear-gradient(to right, #c62828, #b71c1c)'
        }}
      >
        <Typography 
          variant="h6" 
          noWrap 
          component="div"
          sx={{ 
            fontWeight: 600,
            color: '#ffffff',
            textShadow: '1px 1px 1px rgba(0,0,0,0.2)'
          }}
        >
          {t('app.name')}
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem 
            button 
            key={item.text} 
            onClick={() => {
              navigate(item.path);
              setMobileOpen(false);
            }}
            selected={location.pathname === item.path}
            sx={{
              margin: '4px 8px',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              '&.Mui-selected': {
                backgroundColor:
                  theme.palette.mode === 'dark' ? 'rgba(198, 40, 40, 0.22)' : 'rgba(198, 40, 40, 0.1)',
                '&:hover': {
                  backgroundColor:
                    theme.palette.mode === 'dark'
                      ? 'rgba(198, 40, 40, 0.28)'
                      : 'rgba(198, 40, 40, 0.15)'
                }
              },
              '&:hover': {
                backgroundColor:
                  theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                transform: 'translateX(4px)'
              }
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        <ListItem button onClick={logout}>
          <ListItemIcon><ExitToAppIcon /></ListItemIcon>
          <ListItemText primary={t('nav.logout')} />
        </ListItem>
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {user?.name}
          </Typography>
          <NotificationBell />
          <LanguageSwitcher />
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              bgcolor: theme.palette.background.paper,
              color: theme.palette.text.primary
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              bgcolor: theme.palette.background.paper,
              color: theme.palette.text.primary
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: { xs: 1.5, sm: 3 },
          py: { xs: 2, sm: 3 },
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
          pb: { xs: 'calc(80px + env(safe-area-inset-bottom))', sm: 3 },
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: { xs: 720, md: 1200 },
            mx: 'auto',
          }}
        >
          <Outlet />
        </Box>
        <FloatingActionButton 
          mode={fabMode}
          position="bottom-right"
          color="primary"
          bottomOffset={isMobile ? 64 : 0}
          actions={[
            {
              icon: <DirectionsCarIcon />,
              name: t('fab.addVehicle', 'Додати авто'),
              key: 'add-vehicle',
              onClick: () => navigate('/vehicles/add')
            },
            {
              icon: <EventIcon />,
              name: t('fab.newAppointment', 'Новий запис'),
              key: 'new-appointment',
              onClick: () => navigate('/appointments/schedule')
            },
            ...(isMasterUser
              ? [
                  {
                    icon: <EditIcon />,
                    name: t('fab.myServices', 'Мої послуги'),
                    key: 'my-services',
                    onClick: () => navigate('/my-services')
                  }
                ]
              : []),
            {
              icon: <ChatIcon />,
              name: t('fab.myChats', 'Мої чати'),
              key: 'my-chats',
              onClick: () => navigate('/my-chats')
            }
            ,
            {
              icon: <ForumIcon />,
              name: t('nav.interactions', 'Взаємодії'),
              key: 'interactions',
              onClick: () => navigate('/interactions')
            }
          ]}
        />
      </Box>
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: { xs: 'block', sm: 'none' },
          zIndex: theme.zIndex.drawer + 1,
          pb: 'env(safe-area-inset-bottom)',
        }}
      >
        <BottomNavigation
          showLabels
          value={resolveMobileNavValue()}
          onChange={(event, nextValue) => {
            void event;
            if (typeof nextValue === 'string') {
              navigate(nextValue);
            }
          }}
        >
          {mobileNavItems.map((item) => (
            <BottomNavigationAction
              key={item.path}
              label={item.label}
              icon={item.icon}
              value={item.path}
              sx={{
                minWidth: 0,
                paddingX: 0.5,
                '& .MuiBottomNavigationAction-label': {
                  fontSize: 11
                },
                '& .MuiSvgIcon-root': {
                  fontSize: 22
                }
              }}
            />
          ))}
        </BottomNavigation>
      </Paper>
      <Snackbar
        open={showOfflineToast && !isOnline}
        onClose={() => setShowOfflineToast(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        autoHideDuration={6000}
      >
        <Alert severity="warning" variant="filled">
          {t('common.offline', 'Немає інтернету. Деякі дії недоступні.')}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MainLayout;
