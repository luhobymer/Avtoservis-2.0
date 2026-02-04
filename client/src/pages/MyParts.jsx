import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import * as vehiclePartsDao from '../api/dao/vehiclePartsDao';
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
  Box
} from '@mui/material';
import { format } from 'date-fns';

const MyParts = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchParts = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!user || !user.id) return;
        const data = await vehiclePartsDao.listForUser();
        setParts(data || []);
      } catch (err) {
        setError(err.message || 'Не вдалося завантажити список запчастин');
      } finally {
        setLoading(false);
      }
    };

    fetchParts();
  }, [user]);

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
      <Typography variant="h4" gutterBottom>
        {t('parts.myParts', 'Мої запчастини')}
      </Typography>

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
    </Container>
  );
};

export default MyParts;
