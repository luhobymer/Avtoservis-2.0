import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { list as listVehicles, listForUser as listVehiclesForUser } from '../api/dao/vehiclesDao';
import useAuth from '../context/useAuth';
import {
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Alert,
  Box,
  Skeleton
} from '@mui/material';
import { format } from 'date-fns';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const resolveUrl = (url) => (url.startsWith('http') ? url : `${API_BASE_URL}${url}`);

const Vehicles = () => {
  const { t } = useTranslation();
  const { isAdmin, isMaster, user } = useAuth();
  const navigate = useNavigate();

  const isMasterUser =
    typeof isMaster === 'function'
      ? isMaster()
      : typeof isAdmin === 'function'
        ? isAdmin()
        : false;
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(isMasterUser ? 'serviced' : 'owned'); // 'serviced' | 'owned'

  const withRetry = useCallback(async (fn, options = {}) => {
    const retries = typeof options.retries === 'number' ? options.retries : 2;
    const baseDelayMs = typeof options.baseDelayMs === 'number' ? options.baseDelayMs : 500;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        const message = String(err?.message || '');
        const maybeTransient =
          message.includes('NetworkError') ||
          message.includes('Failed to fetch') ||
          message.includes('timeout') ||
          message.includes('502') ||
          message.includes('503') ||
          message.includes('504');
        const shouldRetry = attempt < retries && maybeTransient;
        if (!shouldRetry) throw err;
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    return undefined;
  }, []);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await withRetry(async () => {
        if (isMasterUser) {
          return mode === 'serviced'
            ? await listVehicles({ serviced: true })
            : await listVehiclesForUser(user?.id || '');
        }
        return await listVehiclesForUser(user?.id || '');
      });
      setVehicles(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setVehicles([]);
      setError(error?.message || t('errors.unknownError', 'Виникла невідома помилка. Спробуйте пізніше.'));
    } finally {
      setLoading(false);
    }
  }, [isMasterUser, mode, t, user?.id, withRetry]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const skeletonCards = useMemo(() => Array.from({ length: 6 }, (_, i) => i), []);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">{t('vehicle.title')}</Typography>
          <Button variant="contained" color="primary" disabled>
            {t('vehicle.add')}
          </Button>
        </Box>
        <Grid container spacing={3}>
          {skeletonCards.map((key) => (
            <Grid item key={key} xs={12} sm={6} md={4}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Skeleton variant="rectangular" height={180} />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Skeleton variant="text" height={32} />
                  <Skeleton variant="text" />
                  <Skeleton variant="text" />
                  <Skeleton variant="text" />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={fetchVehicles}>
              {t('common.retry', 'Повторити')}
            </Button>
          }
        >
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {t('vehicle.title')}
        </Typography>
        {isMasterUser && (
          <Box sx={{ display: 'flex', gap: 1, mr: 2 }}>
            <Button
              variant={mode === 'serviced' ? 'contained' : 'outlined'}
              onClick={() => setMode('serviced')}
            >
              {t('vehicles.serviced') || 'Обслуговувані'}
            </Button>
            <Button
              variant={mode === 'owned' ? 'contained' : 'outlined'}
              onClick={() => setMode('owned')}
            >
              {t('vehicles.owned') || 'Мої'}
            </Button>
          </Box>
        )}
        <Button 
          component={Link} 
          to="/vehicles/add" 
          variant="contained" 
          color="primary"
        >
          {t('vehicle.add')}
        </Button>
      </Box>

      {vehicles.length === 0 ? (
        <Alert severity="info">{t('vehicle.noVehicles')}</Alert>
      ) : (
        <Grid container spacing={3}>
          
          {vehicles.map((vehicle, index) => (
            <Grid item key={vehicle.id || `vehicle-${index}`} xs={12} sm={6} md={4}>
                <Card 
                  sx={{ height: '100%', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
                  onClick={() => navigate(`/vehicles/${vehicle.vin}`)}
                >
                  <CardMedia
                    component="div"
                    sx={{
                      pt: '56.25%',
                      bgcolor: 'rgba(0, 0, 0, 0.1)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                    image={vehicle.photoUrl ? resolveUrl(vehicle.photoUrl) : "/placeholder-car.svg"}
                  />
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography gutterBottom variant="h5" component="h2">
                      {vehicle.make && vehicle.model ? 
                        `${vehicle.make} ${vehicle.model}` : 
                        t('common.notAvailable')
                      }
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {t('vehicle.year')}: {vehicle.year || t('common.notAvailable')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      VIN: {vehicle.vin || t('common.notAvailable')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t('vehicle.licensePlate')}: {vehicle.licensePlate || t('common.notAvailable')}
                    </Typography>
                    {vehicle.engineType && (
                      <Typography variant="body2" color="text.secondary">
                        {t('vehicle.engineType')}: {t(`vehicle.engineTypes.${vehicle.engineType}`) || vehicle.engineType} {vehicle.engineVolume ? `(${vehicle.engineVolume}L)` : ''}
                      </Typography>
                    )}
                    {vehicle.transmission && (
                      <Typography variant="body2" color="text.secondary">
                        {t('vehicle.transmission')}: {t(`vehicle.transmissionTypes.${vehicle.transmission}`) || vehicle.transmission}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      {t('vehicle.mileage')}: {vehicle.mileage ? `${vehicle.mileage} ${t('common.km')}` : t('common.notAvailable')}
                    </Typography>
                    {vehicle.color && (
                      <Typography variant="body2" color="text.secondary">
                        {t('vehicle.color')}: {t(`vehicle.colors.${vehicle.color}`) || vehicle.color}
                      </Typography>
                    )}
                    {vehicle.lastService && (
                      <Typography variant="body2" color="text.secondary">
                        {t('vehicle.lastService')}: {format(new Date(vehicle.lastService), 'dd.MM.yyyy')}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
        </Grid>
      )}
    </Container>
  );
};

export default Vehicles;
