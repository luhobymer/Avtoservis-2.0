import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  Alert,
  CircularProgress
} from '@mui/material';

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, googleLogin } = useAuth();
  const googleButtonRef = useRef(null);
  const googleRenderedRef = useRef(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  
  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  useEffect(() => {
    if (!googleClientId || googleRenderedRef.current || !googleButtonRef.current) return;
    const initialize = () => {
      if (!window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (credentialResponse) => {
          if (!credentialResponse?.credential) return;
          setLoading(true);
          setError(null);
          try {
            const result = await googleLogin(credentialResponse.credential);
            if (result?.requireProfileSetup) {
              navigate('/auth/complete-profile');
              return;
            }
            navigate('/');
          } catch (err) {
            setError(err.message || t('auth.login_failed'));
          } finally {
            setLoading(false);
          }
        }
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320
      });
      googleRenderedRef.current = true;
    };

    const existingScript = document.getElementById('google-identity');
    if (existingScript) {
      initialize();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.id = 'google-identity';
    script.onload = initialize;
    document.body.appendChild(script);
  }, [googleClientId, googleLogin, navigate, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(formData);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Paper elevation={3} sx={{ p: 4, mt: 8 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography component="h1" variant="h5">
            {t('auth.login')}
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ width: '100%', mt: 2 }}>
              {error}
            </Alert>
          )}
          
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="identifier"
              label={t('auth.emailOrPhone')}
              name="identifier"
              autoComplete="username"
              autoFocus
              value={formData.identifier}
              onChange={handleChange}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label={t('auth.password')}
              type="password"
              id="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : t('auth.login')}
            </Button>
            {googleClientId && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <div ref={googleButtonRef} />
              </Box>
            )}
            <Grid container justifyContent="flex-end">
              <Grid item sx={{ mr: 2 }}>
                <Link to="/auth/forgot-password" variant="body2">
                  Забули пароль?
                </Link>
              </Grid>
              <Grid item>
                <Link to="/auth/register" variant="body2">
                  {t('auth.register')}
                </Link>
              </Grid>
            </Grid>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default Login;
