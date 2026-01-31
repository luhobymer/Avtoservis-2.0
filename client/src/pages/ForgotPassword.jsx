import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import axios from 'axios';
import {
  Container,
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Link,
} from '@mui/material';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [debugLink, setDebugLink] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setDebugLink(null);

    try {
      const response = await axios.post(
        '/api/auth/forgot-password',
        { email },
        { withCredentials: true }
      );
      const data = response?.data || {};
      setSuccess(
        data?.message || 'Якщо email існує, ми надіслали лист для скидання пароля'
      );
      if (data?.debug_reset_link) {
        setDebugLink(data.debug_reset_link);
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message || err?.message || 'Помилка при відправці листа';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Paper elevation={3} sx={{ p: 4, mt: 8 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography component="h1" variant="h5">
            Скидання пароля
          </Typography>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mt: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ width: '100%', mt: 2 }}>
              {success}
            </Alert>
          )}
          {debugLink && (
            <Alert severity="info" sx={{ width: '100%', mt: 2 }}>
              Debug link: <Link href={debugLink}>{debugLink}</Link>
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email"
              name="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Надіслати лист'}
            </Button>
            <Button
              component={RouterLink}
              to="/auth/login"
              fullWidth
              sx={{ mt: 1 }}
            >
              Повернутись до входу
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default ForgotPassword;
