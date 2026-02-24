import React, { useState, useEffect } from 'react';
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
  CircularProgress,
  Alert,
  Box
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

  useEffect(() => {
    const fetchVehicles = async () => {
      setLoading(true);
      setError(null);
      try {
        let rows = [];
        if (isMasterUser) {
          rows =
            mode === 'serviced'
              ? await listVehicles({ serviced: true })
              : await listVehiclesForUser(user?.id || '');
        } else {
          rows = await listVehiclesForUser(user?.id || '');
        }
        setVehicles(rows);
        console.log('[Vehicles] Дані про автомобілі (Supabase):', rows);
      } catch (error) {
        console.error('Error fetching vehicles:', error);
        
        // Очищаємо дані при будь-якій помилці
        setVehicles([]);
        
        // Обробка різних типів помилок з локалізованими повідомленнями
        setError(error.message || t('errors.unknownError', 'Виникла невідома помилка. Спробуйте пізніше.'));
      } finally {
        setLoading(false);
      }
    };

    fetchVehicles();
  }, [t, isMasterUser, mode, user]);

  if (loading) {
    return (
      <Container sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
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
