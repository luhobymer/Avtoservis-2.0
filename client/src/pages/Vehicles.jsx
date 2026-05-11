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
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TableSortLabel
} from '@mui/material';
import { format } from 'date-fns';

const DEFAULT_API_BASE_URL = 'https://avtoservis-server.onrender.com';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL)
  .trim()
  .replace(/\/+$/, '');
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
  const [viewMode, setViewMode] = useState(() => {
    try {
      const stored = localStorage.getItem('vehicles_view_mode');
      return stored === 'table' ? 'table' : 'cards';
    } catch (e) {
      void e;
      return 'cards';
    }
  });

  const [sortKey, setSortKey] = useState(() => {
    try {
      return localStorage.getItem('vehicles_sort_key') || 'make_model';
    } catch (e) {
      void e;
      return 'make_model';
    }
  });
  const [sortDir, setSortDir] = useState(() => {
    try {
      return localStorage.getItem('vehicles_sort_dir') || 'asc';
    } catch (e) {
      void e;
      return 'asc';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('vehicles_view_mode', viewMode);
    } catch (e) {
      void e;
    }
  }, [viewMode]);

  useEffect(() => {
    try {
      localStorage.setItem('vehicles_sort_key', sortKey);
      localStorage.setItem('vehicles_sort_dir', sortDir);
    } catch (e) {
      void e;
    }
  }, [sortDir, sortKey]);

  const requestSort = useCallback(
    (nextKey, options = {}) => {
      const defaultDir = options?.defaultDir || 'asc';
      if (sortKey === nextKey) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        return;
      }
      setSortKey(nextKey);
      setSortDir(defaultDir);
    },
    [sortKey]
  );

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

  const sortedVehicles = useMemo(() => {
    const rows = Array.isArray(vehicles) ? vehicles : [];
    const dir = sortDir === 'desc' ? -1 : 1;

    const getString = (v) => String(v ?? '').trim().toLowerCase();
    const getNumber = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const getLicense = (vehicle) =>
      vehicle?.licensePlate || vehicle?.license_plate || vehicle?.registrationNumber || '';
    const getCreatedAt = (vehicle) => vehicle?.created_at || vehicle?.createdAt || null;

    const keyFn = (vehicle) => {
      switch (sortKey) {
        case 'year':
          return getNumber(vehicle?.year);
        case 'mileage':
          return getNumber(vehicle?.mileage);
        case 'license_plate':
          return getString(getLicense(vehicle));
        case 'created_at':
          return getCreatedAt(vehicle) ? new Date(getCreatedAt(vehicle)).getTime() : null;
        case 'make_model':
        default:
          return getString(`${vehicle?.make || vehicle?.brand || ''} ${vehicle?.model || ''}`);
      }
    };

    const compare = (a, b) => {
      const va = keyFn(a.vehicle);
      const vb = keyFn(b.vehicle);

      if (va == null && vb == null) return a.idx - b.idx;
      if (va == null) return 1;
      if (vb == null) return -1;

      if (typeof va === 'number' && typeof vb === 'number') {
        if (va === vb) return a.idx - b.idx;
        return (va - vb) * dir;
      }

      const sa = String(va);
      const sb = String(vb);
      const result = sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
      if (result === 0) return a.idx - b.idx;
      return result * dir;
    };

    return rows
      .map((vehicle, idx) => ({ vehicle, idx }))
      .sort(compare)
      .map((entry) => entry.vehicle);
  }, [sortDir, sortKey, vehicles]);

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
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 2, sm: 0 },
          mb: 3,
        }}
      >
        <Typography variant="h4" sx={{ lineHeight: 1.2 }}>
          {t('vehicle.title')}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: { xs: 'flex-start', sm: 'flex-end' },
            flexWrap: 'wrap',
            gap: 1,
            width: { xs: '100%', sm: 'auto' },
          }}
        >
          {isMasterUser && (
            <Box sx={{ display: 'flex', gap: 1, mr: { xs: 0, sm: 1 }, flexWrap: 'wrap' }}>
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
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, next) => {
              if (next) setViewMode(next);
            }}
            size="small"
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            <ToggleButton value="cards">{t('common.cards', 'Картки')}</ToggleButton>
            <ToggleButton value="table">{t('common.table', 'Таблиця')}</ToggleButton>
          </ToggleButtonGroup>
          <Button
            component={Link}
            to="/vehicles/add"
            variant="contained"
            color="primary"
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            {t('vehicle.add')}
          </Button>
        </Box>
      </Box>

      {sortedVehicles.length === 0 ? (
        <Alert severity="info">{t('vehicle.noVehicles')}</Alert>
      ) : (
        viewMode === 'table' ? (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sortDirection={sortKey === 'make_model' ? sortDir : false}>
                    <TableSortLabel
                      active={sortKey === 'make_model'}
                      direction={sortKey === 'make_model' ? sortDir : 'asc'}
                      onClick={() => requestSort('make_model')}
                    >
                      {t('vehicle.make')}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortKey === 'make_model' ? sortDir : false}>
                    <TableSortLabel
                      active={sortKey === 'make_model'}
                      direction={sortKey === 'make_model' ? sortDir : 'asc'}
                      onClick={() => requestSort('make_model')}
                    >
                      {t('vehicle.model')}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortKey === 'year' ? sortDir : false}>
                    <TableSortLabel
                      active={sortKey === 'year'}
                      direction={sortKey === 'year' ? sortDir : 'asc'}
                      onClick={() => requestSort('year')}
                    >
                      {t('vehicle.year')}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sortDirection={sortKey === 'license_plate' ? sortDir : false}>
                    <TableSortLabel
                      active={sortKey === 'license_plate'}
                      direction={sortKey === 'license_plate' ? sortDir : 'asc'}
                      onClick={() => requestSort('license_plate')}
                    >
                      {t('vehicle.licensePlate')}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>VIN</TableCell>
                  <TableCell sortDirection={sortKey === 'mileage' ? sortDir : false}>
                    <TableSortLabel
                      active={sortKey === 'mileage'}
                      direction={sortKey === 'mileage' ? sortDir : 'asc'}
                      onClick={() => requestSort('mileage')}
                    >
                      {t('vehicle.mileage')}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>{t('vehicle.lastService')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedVehicles.map((vehicle, index) => (
                  <TableRow
                    key={vehicle.id || `vehicle-${index}`}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/vehicles/${vehicle.vin}`)}
                  >
                    <TableCell>{vehicle.make || t('common.notAvailable')}</TableCell>
                    <TableCell>{vehicle.model || t('common.notAvailable')}</TableCell>
                    <TableCell>{vehicle.year || t('common.notAvailable')}</TableCell>
                    <TableCell>{vehicle.licensePlate || t('common.notAvailable')}</TableCell>
                    <TableCell>{vehicle.vin || t('common.notAvailable')}</TableCell>
                    <TableCell>
                      {vehicle.mileage ? `${vehicle.mileage} ${t('common.km')}` : t('common.notAvailable')}
                    </TableCell>
                    <TableCell>
                      {vehicle.lastService
                        ? format(new Date(vehicle.lastService), 'dd.MM.yyyy')
                        : t('common.notAvailable')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Grid container spacing={3}>
            {sortedVehicles.map((vehicle, index) => (
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
                      {vehicle.make && vehicle.model ? `${vehicle.make} ${vehicle.model}` : t('common.notAvailable')}
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
                        {t('vehicle.engineType')}: {t(`vehicle.engineTypes.${vehicle.engineType}`) || vehicle.engineType}{' '}
                        {vehicle.engineVolume ? `(${vehicle.engineVolume}L)` : ''}
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
        )
      )}
    </Container>
  );
};

export default Vehicles;
