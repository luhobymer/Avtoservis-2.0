import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Container, Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import useAuth from '../context/useAuth';

const AuthLayout = () => {
  const { t } = useTranslation();
  const { isAuthenticated, loading, needsProfileSetup } = useAuth();
  const location = useLocation();

  // Redirect if already authenticated
  const isCompleteProfileRoute = location.pathname === '/auth/complete-profile';
  if (isAuthenticated && !loading) {
    if (needsProfileSetup && !isCompleteProfileRoute) {
      return <Navigate to="/auth/complete-profile" replace />;
    }
    if (!needsProfileSetup) {
      return <Navigate to="/" />;
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)',
        padding: 2
      }}
    >
      <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
        <LanguageSwitcher />
      </Box>
      <Container component="main" maxWidth="xs">
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Typography 
            component="h1" 
            variant="h4" 
            sx={{ 
              mb: 3, 
              fontWeight: 600,
              color: '#c62828',
              textShadow: '1px 1px 1px rgba(0,0,0,0.1)'
            }}
          >
            {t('app.name')}
          </Typography>
          <Outlet />
        </Box>
      </Container>
    </Box>
  );
};

export default AuthLayout;
