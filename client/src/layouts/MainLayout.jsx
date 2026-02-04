import React, { useState } from 'react';
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Box, Drawer, AppBar, Toolbar, List, Typography, Divider, IconButton, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import { useTranslation } from 'react-i18next';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import EventIcon from '@mui/icons-material/Event';
import EditIcon from '@mui/icons-material/Edit';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import LanguageSwitcher from '../components/LanguageSwitcher';
import NotificationBell from '../components/NotificationBell';
import FloatingActionButton from '../components/FloatingActionButton';
import useAuth from '../context/useAuth';

const drawerWidth = 240;

import PeopleIcon from '@mui/icons-material/People';
import EngineeringIcon from '@mui/icons-material/Engineering';
import ChatIcon from '@mui/icons-material/Chat';

const MainLayout = () => {
  const { t } = useTranslation();
  const { isAuthenticated, loading, logout, user, isAdmin, isMaster } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [fabMode] = useState('speed-dial');
  const location = useLocation();
  const navigate = useNavigate();

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
    { text: t('nav.dashboard'), icon: <DashboardIcon />, path: '/' },
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
    ...(isMasterUser
      ? [{ text: t('nav.masterDashboard'), icon: <AdminPanelSettingsIcon />, path: '/master-dashboard' }]
      : []),
    ...(isMasterUser ? [{ text: t('nav.admin'), icon: <AdminPanelSettingsIcon />, path: '/admin' }] : []),
    { text: t('nav.profile'), icon: <AccountCircleIcon />, path: '/profile' },
  ];

  const drawer = (
    <div>
      <Toolbar sx={{ background: 'linear-gradient(to right, #c62828, #b71c1c)' }}>
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
                backgroundColor: 'rgba(198, 40, 40, 0.1)',
                '&:hover': {
                  backgroundColor: 'rgba(198, 40, 40, 0.15)',
                }
              },
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
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
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` }, mt: 8 }}
      >
        <Outlet />
        {/* Додаємо FAB компонент */}
        <FloatingActionButton 
          mode={fabMode}
          position="bottom-right"
          color="primary"
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
          ]}
        />
      </Box>
    </Box>
  );
};

export default MainLayout;
