import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import { UA_REGION_NAMES, getCitiesByRegion } from '../data/uaRegionsCities';
import {
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Box,
  Divider,
  MenuItem
} from '@mui/material';

const Profile = () => {
  const { t } = useTranslation();
  const { user, updateProfile } = useAuth();
  
  const [loading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    patronymic: '',
    region: '',
    city: '',
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  

  useEffect(() => {
    if (user) {
      console.log('[Profile] User data from context:', user);
      
      // Додаємо підтримку різних форматів даних
      const userName = user.firstName || user.first_name || user.name || user.full_name || user.username || '';
      const userLastName = user.lastName || user.last_name || '';
      const userPatronymic = user.patronymic || '';
      const userRegion = user.region || '';
      const userCity = user.city || '';
      const userEmail = user.email || '';
      const userPhone = user.phone || user.phone_number || '';
      
      setFormData(prev => ({
        ...prev,
        name: userName,
        lastName: userLastName,
        patronymic: userPatronymic,
        region: userRegion,
        city: userCity,
        email: userEmail,
        phone: userPhone
      }));
      
      console.log('[Profile] Form data set:', {
        name: userName,
        lastName: userLastName,
        patronymic: userPatronymic,
        region: userRegion,
        city: userCity,
        email: userEmail,
        phone: userPhone
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'region') {
      setFormData({
        ...formData,
        region: value,
        city: ''
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
    // Clear success message when form is changed
    if (success) setSuccess(false);
  };

  const regionOptions = formData.region
    ? Array.from(new Set([...UA_REGION_NAMES, formData.region]))
    : UA_REGION_NAMES;

  const derivedCities = formData.region ? getCitiesByRegion(formData.region) : [];
  const cityOptions = formData.city
    ? Array.from(new Set([...derivedCities, formData.city]))
    : derivedCities;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    // Validate passwords if trying to change password
    if (formData.newPassword) {
      if (!formData.currentPassword) {
        setError(t('errors.currentPasswordRequired'));
        setSaving(false);
        return;
      }
      if (formData.newPassword !== formData.confirmPassword) {
        setError(t('errors.passwordsDoNotMatch'));
        setSaving(false);
        return;
      }
    }

    try {
      const fullName = [formData.name, formData.lastName, formData.patronymic]
        .filter(Boolean)
        .join(' ')
        .trim();
      const payload = {
        name: fullName || formData.name,
        phone: formData.phone,
        firstName: formData.name,
        lastName: formData.lastName,
        patronymic: formData.patronymic,
        region: formData.region,
        city: formData.city
      };
      if (formData.newPassword) {
        payload.newPassword = formData.newPassword;
      }
      if (updateProfile) {
        await updateProfile(payload);
      }
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
      setSuccess(true);
    } catch (err) {
      setError(err.message || t('errors.failedToUpdateProfile'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          {t('nav.profile')}
        </Typography>
        <Divider sx={{ mb: 3 }} />
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {t('common.success')}: {t('nav.profile')} {t('common.save').toLowerCase()}
          </Alert>
        )}
        
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                {t('auth.name')}
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label={t('auth.name')}
                name="name"
                value={formData.name}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label={t('auth.lastName')}
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
              />
            </Grid>

            {(user?.role || '').toLowerCase() === 'master' && (
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  label={t('auth.patronymic')}
                  name="patronymic"
                  value={formData.patronymic}
                  onChange={handleChange}
                />
              </Grid>
            )}

            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label={t('auth.region')}
                name="region"
                select
                value={formData.region}
                onChange={handleChange}
              >
                {regionOptions.map((region) => (
                  <MenuItem key={region} value={region}>
                    {region}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
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
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label={t('auth.phone')}
                name="phone"
                value={formData.phone}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('auth.email')}
                name="email"
                value={formData.email || t('common.notAvailable')}
                disabled
                helperText={formData.email ? t('auth.emailCannotBeChanged') : t('common.notAvailable')}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                {t('auth.password')}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t('auth.leaveBlankPassword')}
              </Typography>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('auth.currentPassword')}
                name="currentPassword"
                type="password"
                value={formData.currentPassword}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('auth.newPassword')}
                name="newPassword"
                type="password"
                value={formData.newPassword}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label={t('auth.confirmPassword')}
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
            </Grid>
            
            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={saving}
              >
                {saving ? <CircularProgress size={24} /> : t('common.save')}
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Paper>
      
      
    </Container>
  );
};

export default Profile;
