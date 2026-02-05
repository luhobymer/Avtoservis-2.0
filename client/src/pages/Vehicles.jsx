import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { list as listVehicles } from '../api/dao/vehiclesDao';
import useAuth from '../context/useAuth';
import {
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  CardMedia,
  CircularProgress,
  Alert,
  Box,
  Divider
} from '@mui/material';
import { format } from 'date-fns';

const Vehicles = () => {
  const { t } = useTranslation();
  const { isAdmin, isMaster } = useAuth();

  const isMasterUser =
    typeof isMaster === 'function'
      ? isMaster()
      : typeof isAdmin === 'function'
        ? isAdmin()
        : false;
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVehicles = async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await listVehicles(isMasterUser ? { serviced: true } : undefined);
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
  }, [t, isMasterUser]);

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
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardMedia
                    component="div"
                    sx={{
                      pt: '56.25%',
                      bgcolor: 'rgba(0, 0, 0, 0.1)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                    image={vehicle.photoUrl || "/placeholder-car.svg"}
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
                  <Divider />
                  <CardActions>
                    <Button 
                      size="small" 
                      component={Link} 
                      to={`/vehicles/${vehicle.vin}`}
                    >
                      {t('common.edit')}
                    </Button>
                    <Button 
                      size="small" 
                      component={Link} 
                      to={`/vehicles/${vehicle.vin}?tab=1`}
                    >
                      {t('maintenance.title', 'Регламент')}
                    </Button>
                    <Button 
                      size="small" 
                      component={Link} 
                      to={`/service-records?vehicleId=${vehicle.id || index}`}
                    >
                      {t('serviceRecord.title')}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
        </Grid>
      )}
    </Container>
  );
};

export default Vehicles;
