import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Container, Paper, Typography, Alert, Button, CircularProgress, Box } from '@mui/material';

const baseURL = import.meta.env.VITE_API_BASE_URL || '';

const VerifyEmail = () => {
  const { t } = useTranslation();
  const location = useLocation();

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const email = params.get('email') || '';
  const token = params.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError('');
      setSuccess('');

      try {
        if (!email || !token) {
          throw new Error(t('auth.verifyEmailMissingParams'));
        }
        const response = await axios.post(
          `${baseURL}/api/auth/verify-email`,
          { email, token },
          { withCredentials: true }
        );
        setSuccess(response?.data?.message || t('auth.verifyEmailSuccess'));
      } catch (err) {
        setError(
          err?.response?.data?.message ||
            err?.message ||
            t('auth.verifyEmailFailed')
        );
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [email, token, t]);

  return (
    <Container component="main" maxWidth="sm">
      <Paper elevation={3} sx={{ p: 4, mt: 8 }}>
        <Typography component="h1" variant="h5" sx={{ mb: 2 }}>
          {t('auth.verifyEmailTitle')}
        </Typography>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}

        <Button component={RouterLink} to="/auth/login" variant="contained">
          {t('auth.goToLogin')}
        </Button>
      </Paper>
    </Container>
  );
};

export default VerifyEmail;

