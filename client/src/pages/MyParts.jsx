import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import * as vehiclePartsDao from '../api/dao/vehiclePartsDao';
import * as vehiclesDao from '../api/dao/vehiclesDao';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { format } from 'date-fns';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const resolveUrl = (url) => (url.startsWith('http') ? url : `${API_BASE_URL}${url}`);

const MyParts = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const routeParams = useParams();
  const [parts, setParts] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [ocrDialogOpen, setOcrDialogOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [parsedParts, setParsedParts] = useState([]);
  const [selectedVehicleVin, setSelectedVehicleVin] = useState('');
  const [savingParts, setSavingParts] = useState(false);

  const fetchParts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!user || !user.id) return;
      const data = await vehiclePartsDao.listForUser();
      setParts(data || []);
      
      const vehiclesData = await vehiclesDao.listForUser(user.id);
      setVehicles(vehiclesData || []);
    } catch (err) {
      setError(err.message || 'Не вдалося завантажити список запчастин');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  const queryParams = new URLSearchParams(window.location.search);
  const vehicleIdParam = queryParams.get('vehicleId') || routeParams?.id;
  const isTabMode = window.location.pathname.includes('/vehicles/');

  useEffect(() => {
    if (!isTabMode || !vehicleIdParam || vehicles.length === 0) return;
    const match = vehicles.find(
      (v) => String(v.id) === String(vehicleIdParam) || String(v.vin) === String(vehicleIdParam)
    );
    if (match?.vin && match.vin !== selectedVehicleVin) {
      setSelectedVehicleVin(match.vin);
    }
  }, [isTabMode, vehicleIdParam, vehicles, selectedVehicleVin]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setOcrLoading(true);
    setParsedParts([]);
    
    const formData = new FormData();
    formData.append('image', file);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(resolveUrl('/api/ocr/parse'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) throw new Error('Failed to parse image');
      
      const data = await response.json();
      setParsedParts(data);
    } catch (err) {
      setError(t('errors.ocrFailed', 'Не вдалося розпізнати зображення'));
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSaveParsedParts = async () => {
    if (!selectedVehicleVin) {
      alert(t('parts.selectVehicleRequired', 'Будь ласка, оберіть автомобіль'));
      return;
    }

    setSavingParts(true);
    try {
      for (const part of parsedParts) {
        await vehiclePartsDao.createPart({
          vehicle_vin: selectedVehicleVin,
          name: part.name || t('parts.unnamed_part'),
          part_number: part.part_number || part.partNumber || '',
          price: parseFloat(part.price) || 0,
          quantity: parseFloat(part.quantity) || 1,
          purchased_by: 'owner', // Default to owner since user is adding it
          notes: 'Added via OCR'
        });
      }
      
      setOcrDialogOpen(false);
      setParsedParts([]);
      setSelectedVehicleVin('');
      fetchParts(); // Refresh list
      alert(t('common.saved', 'Збережено успішно'));
    } catch (err) {
      console.error('Failed to save parts:', err);
      alert(t('errors.saveFailed', 'Не вдалося зберегти запчастини: ' + err.message));
    } finally {
      setSavingParts(false);
    }
  };

  if (loading) {
    return (
      <Container sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (isTabMode) {
    const match = vehicles.find(
      (v) => String(v.id) === String(vehicleIdParam) || String(v.vin) === String(vehicleIdParam)
    );
    const targetVin = match?.vin || selectedVehicleVin;
    const vehicleParts = targetVin
      ? parts.filter((p) => p.vehicle_vin === targetVin)
      : parts;

    return (
      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button 
              variant="contained" 
              startIcon={<AddPhotoAlternateIcon />}
              onClick={() => setOcrDialogOpen(true)}
            >
              {t('parts.addFromImage', 'Додати з фото')}
            </Button>
        </Box>

        {vehicleParts.length === 0 ? (
          <Alert severity="info">
            {t('parts.noParts', 'У вас ще немає історії заміни запчастин')}
          </Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{t('parts.name', 'Назва')}</TableCell>
                  <TableCell>{t('parts.partNumber', 'Номер')}</TableCell>
                  <TableCell>{t('parts.installedAt', 'Дата')}</TableCell>
                  <TableCell>{t('parts.price', 'Ціна')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {vehicleParts.map((part) => (
                  <TableRow key={part.id}>
                    <TableCell>{part.name}</TableCell>
                    <TableCell>{part.part_number || '-'}</TableCell>
                    <TableCell>
                      {part.installed_date ? format(new Date(part.installed_date), 'dd.MM.yyyy') : '-'}
                    </TableCell>
                    <TableCell>{part.price ? `${part.price} грн` : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        
        {/* OCR Dialog reused */}
        <Dialog open={ocrDialogOpen} onClose={() => setOcrDialogOpen(false)} maxWidth="md" fullWidth>
           {/* ... (keep existing OCR dialog content but simplified for single vehicle context if needed) ... */}
           <DialogTitle>{t('parts.importFromImage', 'Імпорт з зображення')}</DialogTitle>
            <DialogContent>
            <Box sx={{ mb: 2, mt: 1 }}>
                {/* Auto-select current vehicle if in tab mode */}
                {!isTabMode && (
                    <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel id="vehicle-select-label">{t('vehicle.title', 'Автомобіль')}</InputLabel>
                    <Select
                        labelId="vehicle-select-label"
                        value={selectedVehicleVin}
                        label={t('vehicle.title', 'Автомобіль')}
                        onChange={(e) => setSelectedVehicleVin(e.target.value)}
                    >
                        {vehicles.map((v) => (
                        <MenuItem key={v.vin} value={v.vin}>
                            {v.make} {v.model} ({v.year}) - {v.licensePlate}
                        </MenuItem>
                        ))}
                    </Select>
                    </FormControl>
                )}

                <Button
                variant="outlined"
                component="label"
                startIcon={<CloudUploadIcon />}
                fullWidth
                sx={{ height: 100, borderStyle: 'dashed' }}
                >
                {t('common.uploadImage', 'Завантажити зображення')}
                <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
                </Button>
            </Box>

            {ocrLoading && <LinearProgress sx={{ mb: 2 }} />}

            {parsedParts.length > 0 && (
                <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead>
                    <TableRow>
                        <TableCell>{t('parts.name')}</TableCell>
                        <TableCell>{t('parts.price')}</TableCell>
                        <TableCell>{t('parts.qty')}</TableCell>
                    </TableRow>
                    </TableHead>
                    <TableBody>
                    {parsedParts.map((p, index) => (
                        <TableRow key={index}>
                        <TableCell>{p.name}</TableCell>
                        <TableCell>{p.price}</TableCell>
                        <TableCell>{p.quantity}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </TableContainer>
            )}
            </DialogContent>
            <DialogActions>
            <Button onClick={() => setOcrDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button 
                onClick={handleSaveParsedParts} 
                variant="contained" 
                disabled={parsedParts.length === 0 || savingParts}
            >
                {savingParts ? <CircularProgress size={24} /> : t('common.save')}
            </Button>
            </DialogActions>
        </Dialog>
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {t('parts.myParts', 'Мої запчастини')}
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddPhotoAlternateIcon />}
          onClick={() => setOcrDialogOpen(true)}
        >
          {t('parts.addFromImage', 'Додати з фото')}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {parts.length === 0 ? (
        <Alert severity="info">
          {t('parts.noParts', 'У вас ще немає історії заміни запчастин')}
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell>{t('parts.name', 'Назва')}</TableCell>
                <TableCell>{t('parts.partNumber', 'Номер запчастини')}</TableCell>
                <TableCell>{t('vehicle.title', 'Автомобіль')}</TableCell>
                <TableCell>{t('parts.installedAt', 'Встановлено (дата)')}</TableCell>
                <TableCell>{t('parts.mileage', 'Пробіг')}</TableCell>
                <TableCell>{t('parts.price', 'Ціна')}</TableCell>
                <TableCell>{t('parts.purchasedBy', 'Ким куплено')}</TableCell>
                <TableCell>{t('parts.notes', 'Примітки')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {parts.map((part) => (
                <TableRow key={part.id}>
                  <TableCell component="th" scope="row">
                    {part.name}
                  </TableCell>
                  <TableCell>{part.part_number || '-'}</TableCell>
                  <TableCell>
                    {part.make} {part.model} ({part.year})
                  </TableCell>
                  <TableCell>
                    {part.installed_date ? format(new Date(part.installed_date), 'dd.MM.yyyy') : '-'}
                  </TableCell>
                  <TableCell>{part.installed_at_mileage ? `${part.installed_at_mileage} км` : '-'}</TableCell>
                  <TableCell>{part.price ? `${part.price} грн` : '-'}</TableCell>
                  <TableCell>
                    <Chip 
                      label={part.purchased_by === 'owner' ? t('parts.owner', 'Власник') : t('parts.service', 'Сервіс')} 
                      size="small"
                      color={part.purchased_by === 'owner' ? 'info' : 'warning'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{part.notes || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* OCR Dialog */}
      <Dialog open={ocrDialogOpen} onClose={() => setOcrDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('parts.importFromImage', 'Імпорт з зображення')}</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2, mt: 1 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="vehicle-select-label">{t('vehicle.title', 'Автомобіль')}</InputLabel>
              <Select
                labelId="vehicle-select-label"
                value={selectedVehicleVin}
                label={t('vehicle.title', 'Автомобіль')}
                onChange={(e) => setSelectedVehicleVin(e.target.value)}
              >
                {vehicles.map((v) => (
                  <MenuItem key={v.vin} value={v.vin}>
                    {v.make} {v.model} ({v.year}) - {v.licensePlate}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUploadIcon />}
              fullWidth
              sx={{ height: 100, borderStyle: 'dashed' }}
            >
              {t('common.uploadImage', 'Завантажити зображення')}
              <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
            </Button>
          </Box>

          {ocrLoading && <LinearProgress sx={{ mb: 2 }} />}

          {parsedParts.length > 0 && (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('parts.name')}</TableCell>
                    <TableCell>{t('parts.price')}</TableCell>
                    <TableCell>{t('parts.qty')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parsedParts.map((p, index) => (
                    <TableRow key={index}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.price}</TableCell>
                      <TableCell>{p.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOcrDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button 
            onClick={handleSaveParsedParts} 
            variant="contained" 
            disabled={parsedParts.length === 0 || savingParts}
          >
            {savingParts ? <CircularProgress size={24} /> : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default MyParts;
