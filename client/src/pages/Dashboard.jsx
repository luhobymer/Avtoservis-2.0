import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import * as vehiclesDao from '../api/dao/vehiclesDao';
import * as appointmentsDao from '../api/dao/appointmentsDao';
import * as serviceRecordsDao from '../api/dao/serviceRecordsDao';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Button,
  Divider,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  CardActions,
  Chip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  DirectionsCar as CarIcon,
  EventNote as AppointmentIcon,
  Build as ServiceIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  ArrowForward as ArrowForwardIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { format } from 'date-fns';

const StatCard = ({ title, value, icon, color, to }) => (
  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'visible' }}>
    <CardContent sx={{ flexGrow: 1, pb: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography color="text.secondary" gutterBottom variant="overline" sx={{ fontWeight: 'bold' }}>
            {title}
          </Typography>
          <Typography variant="h3" component="div" sx={{ fontWeight: 'medium' }}>
            {value}
          </Typography>
        </Box>
        <Box 
          sx={{ 
            bgcolor: `${color}.light`, 
            color: `${color}.main`,
            p: 1.5, 
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {icon}
        </Box>
      </Box>
    </CardContent>
    <CardActions sx={{ pt: 0, px: 2, pb: 2 }}>
      <Button 
        component={Link} 
        to={to} 
        size="small" 
        endIcon={<ArrowForwardIcon fontSize="small" />}
        sx={{ color: `${color}.main` }}
      >
        Переглянути
      </Button>
    </CardActions>
  </Card>
);

const AppointmentItem = ({ appointment, showClient = false }) => {
  const { t } = useTranslation();
  
  return (
    <Paper 
      variant="outlined" 
      sx={{ 
        p: 2, 
        mb: 2, 
        borderLeft: '4px solid',
        borderLeftColor: appointment.status === 'confirmed' ? 'success.main' : 
                         appointment.status === 'pending' ? 'warning.main' : 'primary.main',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 2
        }
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Typography variant="subtitle1" fontWeight="bold">
          {appointment.serviceName || appointment.serviceType || t('common.notAvailable')}
        </Typography>
        <Chip 
          label={t(`appointment.statuses.${appointment.status}`, appointment.status)} 
          size="small" 
          color={
            appointment.status === 'confirmed' ? 'success' : 
            appointment.status === 'pending' ? 'warning' : 'default'
          }
          variant="outlined"
        />
      </Box>
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, color: 'text.secondary' }}>
        <ScheduleIcon fontSize="small" sx={{ mr: 1 }} />
        <Typography variant="body2">
          {appointment.scheduledTime ? format(new Date(appointment.scheduledTime), 'PPpp') : t('common.notAvailable')}
        </Typography>
      </Box>
      
      {showClient && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, color: 'text.secondary' }}>
          <PersonIcon fontSize="small" sx={{ mr: 1 }} />
          <Typography variant="body2">
             {/* Add client name if available in the API response */}
             {appointment.clientName || 'Клієнт'}
          </Typography>
        </Box>
      )}

      {appointment.vehicleVin && (
        <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
          <CarIcon fontSize="small" sx={{ mr: 1 }} />
          <Typography variant="body2">
             VIN: {appointment.vehicleVin}
          </Typography>
        </Box>
      )}
      
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button 
          component={Link} 
          to={`/appointments/${appointment.id}`}
          size="small" 
          variant="outlined"
        >
          {t('common.details', 'Деталі')}
        </Button>
      </Box>
    </Paper>
  );
};

const Dashboard = () => {
  const { t } = useTranslation();
  const { user, isMaster } = useAuth();
  const isMasterUser = typeof isMaster === 'function' ? isMaster() : false;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [serviceRecords, setServiceRecords] = useState([]);
  const [masterTodayAppointments, setMasterTodayAppointments] = useState([]);
  const [masterUpcomingAppointments, setMasterUpcomingAppointments] = useState([]);
  const [masterError, setMasterError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      setMasterError(null);
      try {
        if (!user || !user.id) {
          setLoading(false);
          setError(t('errors.unauthorized', 'Будь ласка, увійдіть в систему для перегляду даних.'));
          return;
        }

        // Fetch user data
        const [vehiclesList, appointmentsList, serviceRecordsList] = await Promise.all([
          vehiclesDao.listForUser(user.id),
          appointmentsDao.listForUser(user.id),
          serviceRecordsDao.listForUser(user.id)
        ]);

        setVehicles(Array.isArray(vehiclesList) ? vehiclesList : []);
        
        const normalizedAppointments = (appointmentsList || []).map(a => ({
          id: a.id,
          vehicleVin: a.vehicle_vin,
          serviceId: a.serviceId || null,
          serviceType: a.serviceType,
          serviceName: a.serviceName || null,
          scheduledTime: a.scheduledDate,
          status: a.status,
          notes: a.notes || ''
        }));
        
        const upcomingAppointments = normalizedAppointments
          .filter(app => app.status !== 'completed' && app.status !== 'cancelled')
          .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime))
          .slice(0, 3);
        setAppointments(upcomingAppointments);
        
        setServiceRecords(Array.isArray(serviceRecordsList) ? serviceRecordsList : []);

        // Fetch master data if applicable
        if (isMasterUser) {
          try {
            const adminAppointments = await appointmentsDao.listAdmin();
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            
            const today = (adminAppointments || []).filter((a) => {
              if (!a.scheduledDate) return false;
              const d = new Date(a.scheduledDate);
              return d >= startOfToday && d < endOfToday;
            });
            
            const upcoming = (adminAppointments || [])
              .filter((a) => {
                if (!a.scheduledDate) return false;
                const d = new Date(a.scheduledDate);
                return d >= endOfToday && a.status !== 'completed' && a.status !== 'cancelled';
              })
              .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
              .slice(0, 5);
              
            setMasterTodayAppointments(today);
            setMasterUpcomingAppointments(upcoming);
          } catch (err) {
            console.error("Failed to fetch master data", err);
            setMasterError(t('dashboard.masterDataError', 'Не вдалося завантажити дані майстра'));
          }
        }
      } catch (error) {
        console.error("Dashboard error", error);
        setError(error?.message || t('errors.unknownError', 'Виникла невідома помилка'));
      } finally {
        setLoading(false);
      }
    };
    
    if (user && user.id) fetchDashboardData();
  }, [user, t, isMasterUser]);

  if (loading) {
    return (
      <Container sx={{ mt: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
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
    <Container maxWidth="xl" sx={{ mt: 4, mb: 6 }}>
      {/* Header Section */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight="bold" gutterBottom>
            {t('dashboard.title', 'Головна панель')}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {t('dashboard.greeting', 'Вітаємо,')} {user?.name || user?.email}
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          component={Link} 
          to="/appointments/schedule"
          sx={{ borderRadius: 2 }}
        >
          {t('appointment.schedule', 'Записатись')}
        </Button>
      </Box>

      {/* Stats Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard 
            title={t('dashboard.vehicleStatus', 'Мої авто')} 
            value={vehicles.length} 
            icon={<CarIcon />} 
            color="primary"
            to="/vehicles"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard 
            title={t('dashboard.upcomingAppointments', 'Активні записи')} 
            value={appointments.length} 
            icon={<AppointmentIcon />} 
            color="warning"
            to="/appointments"
          />
        </Grid>
        {isMasterUser && (
          <Grid item xs={12} sm={6} md={4}>
            <StatCard 
              title={t('dashboard.recentServiceRecords', 'Історія')} 
              value={serviceRecords.length} 
              icon={<ServiceIcon />} 
              color="info"
              to="/service-records"
            />
          </Grid>
        )}
      </Grid>

      {/* Master Section */}
      {isMasterUser && (
        <Box sx={{ mb: 5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
             <Typography variant="h5" fontWeight="bold">
               {t('dashboard.masterPanelTitle', 'Робочий простір')}
             </Typography>
             <Button component={Link} to="/admin" variant="text">
               {t('common.viewAll', 'Всі записи')}
             </Button>
          </Box>

          {masterError && <Alert severity="warning" sx={{ mb: 2 }}>{masterError}</Alert>}
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, height: '100%', borderRadius: 2 }} elevation={2}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <ScheduleIcon sx={{ mr: 1, color: 'primary.main' }} />
                  {t('dashboard.masterTodayAppointments', 'Сьогодні')}
                  <Chip label={masterTodayAppointments.length} size="small" sx={{ ml: 1 }} color="primary" />
                </Typography>
                <Divider sx={{ my: 2 }} />
                
                {masterTodayAppointments.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      {t('dashboard.noAppointmentsToday', 'На сьогодні записів немає')}
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    {masterTodayAppointments.map(app => (
                      <AppointmentItem key={app.id} appointment={app} showClient />
                    ))}
                  </Box>
                )}
              </Paper>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, height: '100%', borderRadius: 2 }} elevation={2}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <EventNoteIcon sx={{ mr: 1, color: 'info.main' }} />
                  {t('dashboard.masterUpcomingAppointments', 'Найближчі записи')}
                </Typography>
                <Divider sx={{ my: 2 }} />
                
                {masterUpcomingAppointments.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                      {t('dashboard.noUpcomingAppointments', 'Запланованих записів немає')}
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    {masterUpcomingAppointments.map(app => (
                      <AppointmentItem key={app.id} appointment={app} showClient />
                    ))}
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* User Section - My Appointments */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          {t('dashboard.myAppointments', 'Найближчі записи')}
        </Typography>
        
        {appointments.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, bgcolor: 'background.default' }} variant="outlined">
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {t('appointment.noAppointments', 'У вас немає активних записів')}
            </Typography>
            <Button variant="outlined" component={Link} to="/appointments/schedule" sx={{ mt: 1 }}>
              {t('appointment.schedule', 'Записатись на сервіс')}
            </Button>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {appointments.map(app => (
              <Grid item xs={12} md={6} lg={4} key={app.id}>
                <AppointmentItem appointment={app} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

    </Container>
  );
};

// Helper component for Icon
const EventNoteIcon = (props) => (
  <AppointmentIcon {...props} />
);

export default Dashboard;
