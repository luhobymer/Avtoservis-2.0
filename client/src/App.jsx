import React, { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import i18n from './i18n.js';

// Layouts
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import CompleteGoogleProfile from './pages/CompleteGoogleProfile';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import MasterDashboard from './pages/MasterDashboard';
import MasterWorkingHours from './pages/MasterWorkingHours';
import Vehicles from './pages/Vehicles';
import VehicleDetails from './pages/VehicleDetails';
import Appointments from './pages/Appointments';
import AppointmentDetails from './pages/AppointmentDetails';
import ServiceRecords from './pages/ServiceRecords';
import ServiceRecordDetails from './pages/ServiceRecordDetails';
import Profile from './pages/Profile';
import AdminPanel from './pages/AdminPanel';
import Notifications from './pages/Notifications';
import MyMechanics from './pages/MyMechanics';
import MyClients from './pages/MyClients';
import ClientDetails from './pages/ClientDetails';
import MyServices from './pages/MyServices';
import MyChats from './pages/MyChats';
import MyParts from './pages/MyParts';
import Reminders from './pages/Reminders';
import ServiceBook from './pages/ServiceBook';
import Interactions from './pages/Interactions';
import NewInteraction from './pages/NewInteraction';

// Context
import useAuth from './context/useAuth';
import { getUserSettings } from './api/dao/userSettingsDao';

const HomePage = () => {
  const { isMaster } = useAuth();
  const isMasterUser = typeof isMaster === 'function' ? isMaster() : false;
  return isMasterUser ? <MasterDashboard /> : <Dashboard />;
};

const App = () => {
  const { isAuthenticated, needsProfileSetup, user } = useAuth();
  const [appSettings, setAppSettings] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setAppSettings(null);
      return;
    }

    let alive = true;
    (async () => {
      try {
        const payload = await getUserSettings(user.id);
        const nextSettings = payload?.settings ?? null;
        if (!alive) return;
        setAppSettings(nextSettings);
      } catch (_) {
        if (!alive) return;
        setAppSettings(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleSettingsUpdated = (event) => {
      const next = event?.detail ?? null;
      if (next && typeof next === 'object') {
        setAppSettings(next);
      }
    };

    window.addEventListener('userSettingsUpdated', handleSettingsUpdated);
    return () => window.removeEventListener('userSettingsUpdated', handleSettingsUpdated);
  }, [isAuthenticated]);

  const darkMode = !!appSettings?.appearance?.darkMode;
  const preferredLanguage = String(appSettings?.locale?.language || '').trim();

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!preferredLanguage) return;
    if (i18n.language === preferredLanguage) return;
    void i18n.changeLanguage(preferredLanguage);
  }, [isAuthenticated, preferredLanguage]);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? 'dark' : 'light',
          primary: {
            main: '#c62828',
            light: '#e53935',
            dark: '#b71c1c'
          },
          secondary: {
            main: '#9e9e9e',
            light: '#f5f5f5',
            dark: '#757575'
          },
          background: {
            default: darkMode ? '#121212' : '#f8f8f8',
            paper: darkMode ? '#1e1e1e' : '#ffffff'
          }
        },
        typography: {
          fontFamily: "'Roboto', 'Arial', sans-serif",
          h1: {
            fontWeight: 500
          },
          h2: {
            fontWeight: 500
          },
          h3: {
            fontWeight: 500
          }
        },
        shape: {
          borderRadius: 8
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                borderRadius: 8,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
                }
              }
            }
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: 12,
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                overflow: 'hidden'
              }
            }
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                borderRadius: 12
              }
            }
          }
        }
      }),
    [darkMode]
  );

  return (
    <ThemeProvider theme={theme}>
        <CssBaseline />
        <Routes>
          {/* Auth Routes */}
          <Route path="/auth" element={<AuthLayout />}>
            <Route index element={<Navigate to="login" replace />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="complete-profile" element={<CompleteGoogleProfile />} />
            <Route path="verify-email" element={<VerifyEmail />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="change-password" element={<ChangePassword />} />
          </Route>
          
          {/* Protected Routes */}
          <Route
            element={
              isAuthenticated ? (
                needsProfileSetup ? (
                  <Navigate to="/auth/complete-profile" replace />
                ) : (
                  <MainLayout />
                )
              ) : (
                <Navigate to="/auth/login" />
              )
            }
          >
            <Route path="/" element={<HomePage />} />
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/vehicles/add" element={<VehicleDetails isNew={true} />} />
            <Route path="/vehicles/:id" element={<VehicleDetails />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/appointments/schedule" element={<AppointmentDetails isNew={true} />} />
            <Route path="/appointments/:id" element={<AppointmentDetails />} />
            <Route path="/service-records" element={<ServiceRecords />} />
            <Route path="/service-records/new" element={<ServiceRecordDetails isNew={true} />} />
            <Route path="/service-records/:id" element={<ServiceRecordDetails />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/master-dashboard" element={<MasterDashboard />} />
            <Route path="/master-working-hours" element={<MasterWorkingHours />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/my-mechanics" element={<MyMechanics />} />
            <Route path="/my-clients" element={<MyClients />} />
            <Route path="/my-clients/:id" element={<ClientDetails />} />
            <Route path="/my-services" element={<MyServices />} />
            <Route path="/my-chats" element={<MyChats />} />
            <Route path="/my-parts" element={<MyParts />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/service-book" element={<ServiceBook />} />
            <Route path="/interactions" element={<Interactions />} />
            <Route path="/interactions/new" element={<NewInteraction />} />
          </Route>
          
          {/* Redirect to login if no route matches */}
          <Route path="*" element={<Navigate to="/auth/login" replace />} />
        </Routes>
        <ToastContainer position="bottom-right" />
      </ThemeProvider>
  );
};

export default App;
