import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UA_REGION_NAMES, getCitiesByRegion } from '../data/uaRegionsCities';
import { useAuth } from '../context/useAuth';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  MenuItem,
  Paper,
  TextField,
  Typography,
  Alert,
} from '@mui/material';

const CompleteGoogleProfile = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, needsProfileSetup, googleProfile, user, completeGoogleProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [phoneError, setPhoneError] = useState('');

  const initialData = useMemo(() => {
    const fallback = user || {};
    const profile = googleProfile || {};
    const firstName = profile.firstName || fallback.firstName || '';
    const lastName = profile.lastName || fallback.lastName || '';
    const email = profile.email || fallback.email || '';
    const name = profile.name || fallback.name || '';
    return {
      role: fallback.role || 'client',
      firstName,
      lastName,
      patronymic: fallback.patronymic || '',
      region: fallback.region || '',
      city: fallback.city || '',
      email,
      phone: fallback.phone || '',
      displayName: name,
    };
  }, [googleProfile, user]);

  const [formData, setFormData] = useState(initialData);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth/login');
      return;
    }
    if (!needsProfileSetup) {
      navigate('/');
    }
  }, [isAuthenticated, needsProfileSetup, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'phone') {
      const phoneRegex = /^(\+?380|0)\d{0,9}$/;
      if (!phoneRegex.test(value)) {
        setPhoneError(t('errors.phone_format'));
      } else {
        setPhoneError('');
      }
    }

    if (name === 'region') {
      setFormData((prev) => ({
        ...prev,
        region: value,
        city: '',
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const cityOptions = formData.region ? getCitiesByRegion(formData.region) : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const isMaster = formData.role === 'master';
      const missingRequired =
        !formData.firstName?.trim() ||
        !formData.lastName?.trim() ||
        !formData.region?.trim() ||
        !formData.city?.trim() ||
        !formData.phone?.trim() ||
        (isMaster && !formData.patronymic?.trim());

      if (missingRequired) {
        throw new Error(t('auth.completeProfileRequired'));
      }

      let cleanedPhone = formData.phone.trim().replace(/\s+/g, '');
      if (!cleanedPhone.match(/^(\+?380|0)\d{9}$/)) {
        throw new Error(t('errors.phone_format'));
      }
      if (cleanedPhone.startsWith('0')) {
        cleanedPhone = '+380' + cleanedPhone.slice(1);
      } else if (cleanedPhone.startsWith('380')) {
        cleanedPhone = '+' + cleanedPhone;
      }

      await completeGoogleProfile({
        role: formData.role,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        patronymic: formData.patronymic.trim(),
        region: formData.region.trim(),
        city: formData.city.trim(),
        phone: cleanedPhone,
      });
      navigate('/');
    } catch (err) {
      setError(err.message || t('auth.completeProfileFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Paper elevation={3} sx={{ p: 4, mt: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography component="h1" variant="h5">
            {t('auth.completeProfileTitle')}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, textAlign: 'center', color: 'text.secondary' }}>
            {t('auth.completeProfileSubtitle')}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mt: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              select
              name="role"
              label={t('auth.role')}
              id="role"
              value={formData.role}
              onChange={handleChange}
              SelectProps={{ native: true }}
            >
              <option value="client">{t('auth.roleClient')}</option>
              <option value="master">{t('auth.roleMaster')}</option>
            </TextField>
            <TextField
              margin="normal"
              fullWidth
              label={t('auth.name')}
              value={formData.displayName}
              disabled
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="firstName"
              label={t('auth.name')}
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="lastName"
              label={t('auth.lastName')}
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
            />
            {formData.role === 'master' && (
              <TextField
                margin="normal"
                required
                fullWidth
                id="patronymic"
                label={t('auth.patronymic')}
                name="patronymic"
                value={formData.patronymic}
                onChange={handleChange}
              />
            )}
            <TextField
              margin="normal"
              required
              fullWidth
              id="region"
              label={t('auth.region')}
              name="region"
              select
              value={formData.region}
              onChange={handleChange}
            >
              {UA_REGION_NAMES.map((region) => (
                <MenuItem key={region} value={region}>
                  {region}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              margin="normal"
              required
              fullWidth
              id="city"
              label={t('auth.city')}
              name="city"
              select
              disabled={!formData.region}
              value={formData.city}
              onChange={handleChange}
            >
              {cityOptions.map((city) => (
                <MenuItem key={city} value={city}>
                  {city}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              margin="normal"
              fullWidth
              label={t('auth.email')}
              value={formData.email}
              disabled
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="phone"
              label={t('auth.phone')}
              name="phone"
              value={formData.phone}
              inputMode="tel"
              error={!!phoneError}
              helperText={phoneError}
              onChange={handleChange}
              placeholder="+380XXXXXXXXX"
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : t('auth.completeProfileAction')}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default CompleteGoogleProfile;
