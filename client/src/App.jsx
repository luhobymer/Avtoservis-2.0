import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

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
import Dashboard from './pages/Dashboard';
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
import MyServices from './pages/MyServices';
import MyChats from './pages/MyChats';
import MyParts from './pages/MyParts';
import Reminders from './pages/Reminders';

// Context
import useAuth from './context/useAuth';

// Theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#c62828', // Червоний колір
      light: '#e53935',
      dark: '#b71c1c',
    },
    secondary: {
      main: '#9e9e9e', // Сріблястий колір
      light: '#f5f5f5',
      dark: '#757575',
    },
    background: {
      default: '#f8f8f8',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: "'Roboto', 'Arial', sans-serif",
    h1: {
      fontWeight: 500,
    },
    h2: {
      fontWeight: 500,
    },
    h3: {
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8,
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
            boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});

const App = () => {
  const { isAuthenticated, needsProfileSetup } = useAuth();

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
            <Route path="/" element={<Dashboard />} />
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
            <Route path="/master-dashboard" element={<Navigate to="/" replace />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/my-mechanics" element={<MyMechanics />} />
            <Route path="/my-clients" element={<MyClients />} />
            <Route path="/my-services" element={<MyServices />} />
            <Route path="/my-chats" element={<MyChats />} />
            <Route path="/my-parts" element={<MyParts />} />
            <Route path="/reminders" element={<Reminders />} />
          </Route>
          
          {/* Redirect to login if no route matches */}
          <Route path="*" element={<Navigate to="/auth/login" replace />} />
        </Routes>
        <ToastContainer position="bottom-right" />
      </ThemeProvider>
  );
};

export default App;
