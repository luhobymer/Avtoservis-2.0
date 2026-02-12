import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getById as getVehicleById,
  create as createVehicle,
  update as updateVehicle,
  remove as removeVehicle,
  lookupRegistryByLicensePlate,
  uploadPhoto,
  listForUser as listVehiclesForUser,
  attachServicedVehicles,
} from '../api/dao/vehiclesDao';
import useAuth from '../context/useAuth';
import { brandModelYears } from '../data/vehicleData';
import {
  Container,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Checkbox,
  FormControlLabel,
  Box,
  Snackbar,
  TextField,
} from '@mui/material';
import VehicleForm from '../components/vehicle/VehicleForm';
import DeleteVehicleDialog from '../components/vehicle/DeleteVehicleDialog';
import MaintenanceTab from '../components/vehicle/MaintenanceTab';
import ErrorBoundary from '../components/ErrorBoundary';
import { list as listUsers, create as createUser } from '../api/dao/usersDao';
import { Tabs, Tab } from '@mui/material';

import ServiceRecords from './ServiceRecords';
import MyParts from './MyParts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const resolveUrl = (url) => (url.startsWith('http') ? url : `${API_BASE_URL}${url}`);

const VehicleDetailsContent = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isMaster, isAdmin } = useAuth();
  const isNewVehicle = !id;

  const isMasterUser =
    typeof isMaster === 'function'
      ? isMaster()
      : typeof isAdmin === 'function'
        ? isAdmin()
        : false;

  const [owners, setOwners] = useState([]);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [ownerId, setOwnerId] = useState('');
  const [ownerError, setOwnerError] = useState('');

  const [ownerVehicles, setOwnerVehicles] = useState([]);
  const [ownerVehiclesLoading, setOwnerVehiclesLoading] = useState(false);
  const [ownerVehiclesChecked, setOwnerVehiclesChecked] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedOwnerVehicleIds, setSelectedOwnerVehicleIds] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  const [addClientOpen, setAddClientOpen] = useState(false);
  const [addClientSaving, setAddClientSaving] = useState(false);
  const [addClientError, setAddClientError] = useState('');
  const [addClientDraft, setAddClientDraft] = useState({ name: '', email: '', phone: '', password: '' });

  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    year: '',
    vin: '',
    licensePlate: '',
    engineType: '',
    transmission: '',
    engineVolume: '',
    color: '',
    mileage: '',
    photoUrl: ''
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [vehicleMeta, setVehicleMeta] = useState({ id: null, userId: null, vin: '' });

  const [loading, setLoading] = useState(!isNewVehicle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [tabValue, setTabValue] = useState(0);

  // Initialize tab from URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam) {
      setTabValue(Number(tabParam));
    }
  }, []);

  const loadVehicleData = useCallback(async () => {
    try {
      const v = await getVehicleById(id);
      setFormData({
        brand: v.brand || v.make || '',
        model: v.model || '',
        year: v.year || '',
        vin: v.vin || '',
        licensePlate: v.licensePlate || '',
        engineType: v.engineType || '',
        transmission: v.transmission || '',
        engineVolume: v.engineVolume || v.engine_capacity || '',
        color: v.color || '',
        mileage: v.mileage || '',
        photoUrl: v.photoUrl || ''
      });
      setVehicleMeta({
        id: v.id || null,
        userId: v.UserId || v.user_id || null,
        vin: v.vin || ''
      });
      if (v.photoUrl) {
        setPhotoPreview(v.photoUrl);
      }
      setLoading(false);
    } catch (err) {
      setError(t('errors.loadFailed', 'Помилка завантаження даних'));
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    if (!isNewVehicle) {
      loadVehicleData();
    }
  }, [id, isNewVehicle, loadVehicleData]);

  useEffect(() => {
    const run = async () => {
      if (!isNewVehicle || !isMasterUser) return;
      setOwnersLoading(true);
      try {
        const token = localStorage.getItem('auth_token');
        const [list, myClients] = await Promise.all([
          listUsers(),
          token
            ? fetch(resolveUrl('/api/relationships/clients'), {
                headers: { Authorization: `Bearer ${token}` }
              })
                .then((r) => (r.ok ? r.json() : []))
                .catch(() => [])
            : Promise.resolve([])
        ]);

        const allowedByRelationship = new Set(
          (myClients || [])
            .filter((c) => String(c?.status || '') !== 'rejected')
            .map((c) => c?.client_id)
            .filter(Boolean)
            .map((id) => String(id))
        );

        const clients = (list || [])
          .filter((u) => String(u?.role || '').toLowerCase() === 'client')
          .filter((u) => Number(u?.email_verified || 0) === 1 || allowedByRelationship.has(String(u?.id)));

        setOwners(clients);
      } catch (err) {
        void err;
        setOwners([]);
      } finally {
        setOwnersLoading(false);
      }
    };
    run();
  }, [isNewVehicle, isMasterUser]);

  const handleOwnerChange = async (e) => {
    const nextOwnerId = e.target.value;
    setOwnerId(nextOwnerId);
    setOwnerError('');
    setOwnerVehicles([]);
    setSelectedOwnerVehicleIds([]);
    setImportDialogOpen(false);
    setOwnerVehiclesChecked(false);

    if (!nextOwnerId) return;

    setOwnerVehiclesLoading(true);
    try {
      const list = await listVehiclesForUser(nextOwnerId);
      setOwnerVehicles(list);
      if (Array.isArray(list) && list.length > 0) {
        setSelectedOwnerVehicleIds(list.map((v) => v.id).filter(Boolean));
        setImportDialogOpen(true);
      }
    } catch (err) {
      setSnackbar({ open: true, message: err?.message || t('common.error', 'Помилка') });
    } finally {
      setOwnerVehiclesLoading(false);
      setOwnerVehiclesChecked(true);
    }
  };

  const submitCreateClient = async () => {
    const name = String(addClientDraft.name || '').trim();
    const email = String(addClientDraft.email || '').trim();
    const phone = String(addClientDraft.phone || '').trim();
    const password = String(addClientDraft.password || '').trim();

    if (!name || !email || !phone || !password) {
      setAddClientError(t('errors.required_field', 'Обов\'язкове поле'));
      return;
    }

    setAddClientSaving(true);
    setAddClientError('');
    try {
      const created = await createUser({ name, email, phone, password, role: 'client' });
      if (created?.id) {
        setOwners((prev) => [{ ...created, email_verified: 1 }, ...(prev || [])]);
        setOwnerId(created.id);
        setOwnerVehicles([]);
        setSelectedOwnerVehicleIds([]);
        setImportDialogOpen(false);
        setOwnerVehiclesChecked(true);
        setSnackbar({ open: true, message: t('common.saved', 'Збережено') });
      }
      setAddClientOpen(false);
    } catch (err) {
      setAddClientError(err?.message || t('common.error', 'Помилка'));
    } finally {
      setAddClientSaving(false);
    }
  };

  const toggleVehicleSelection = (vehicleId) => {
    const id = String(vehicleId || '');
    if (!id) return;
    setSelectedOwnerVehicleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleImportSelectedVehicles = async () => {
    if (selectedOwnerVehicleIds.length === 0) return;
    setSaving(true);
    try {
      await attachServicedVehicles(selectedOwnerVehicleIds);
      setSnackbar({ open: true, message: t('vehicle.addedToServiced', 'Додано до обслуговуємих') });
      setImportDialogOpen(false);
      setTimeout(() => navigate('/vehicles'), 600);
    } catch (err) {
      setError(err?.message || t('errors.saveFailed', 'Помилка збереження даних'));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePhotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setOwnerError('');

    try {
      if (isNewVehicle && isMasterUser && !ownerId) {
        setOwnerError(t('vehicle.ownerRequired', 'Оберіть власника авто'));
        setSaving(false);
        return;
      }

      let uploadedPhotoUrl = formData.photoUrl;
      
      if (photoFile) {
        try {
          const uploadResult = await uploadPhoto(photoFile);
          uploadedPhotoUrl = uploadResult.url;
        } catch (uploadErr) {
          console.error('Photo upload error:', uploadErr);
        }
      }

      if (isNewVehicle) {
        const payload = {
          make: formData.brand,
          model: formData.model,
          year: formData.year,
          vin: formData.vin,
          licensePlate: formData.licensePlate,
          engineType: formData.engineType,
          transmission: formData.transmission,
          engineVolume: formData.engineVolume,
          mileage: formData.mileage,
          color: formData.color,
          photoUrl: uploadedPhotoUrl
        };
        const targetUserId = isMasterUser ? ownerId : user?.id || null;
        await createVehicle(payload, targetUserId);
      } else {
        const payload = {
          make: formData.brand,
          model: formData.model,
          year: formData.year,
          vin: formData.vin,
          license_plate: formData.licensePlate,
          engineType: formData.engineType,
          transmission: formData.transmission,
          engineVolume: formData.engineVolume,
          mileage: formData.mileage,
          color: formData.color,
          photoUrl: uploadedPhotoUrl
        };
        await updateVehicle(id, payload);
      }
      navigate('/vehicles');
    } catch (err) {
      setError(t('errors.saveFailed', 'Помилка збереження даних'));
      setSaving(false);
    }
  };

  const handleLookupByPlate = async () => {
    if (!formData.licensePlate) return;
    setLookupLoading(true);
    setLookupError(null);

    try {
      const registry = await lookupRegistryByLicensePlate(formData.licensePlate);
      const rawBrand = registry?.brand || registry?.make || '';
      const rawModel = registry?.model || '';
      const brandKey = rawBrand
        ? Object.keys(brandModelYears).find(
            (key) => key.toLowerCase() === String(rawBrand).toLowerCase()
          )
        : null;
      const modelKey =
        brandKey && rawModel
          ? Object.keys(brandModelYears[brandKey]).find(
              (key) => key.toLowerCase() === String(rawModel).toLowerCase()
            )
          : null;
      const registryYear = registry?.make_year || registry?.year || null;
      const licenseValue =
        registry?.n_reg_new ||
        registry?.license_plate_normalized ||
        formData.licensePlate;
      
      let engineType = '';
      const fuelRaw = String(registry?.fuel_type || '').toUpperCase();
      if (fuelRaw.includes('BENZINE') || fuelRaw.includes('PETROL') || fuelRaw.includes('БЕНЗИН')) engineType = 'petrol';
      else if (fuelRaw.includes('DIESEL') || fuelRaw.includes('ДИЗЕЛЬ')) engineType = 'diesel';
      else if (fuelRaw.includes('GAS') || fuelRaw.includes('ГАЗ')) engineType = 'gas';
      else if (fuelRaw.includes('ELECTRO') || fuelRaw.includes('ELECTRIC') || fuelRaw.includes('ЕЛЕКТРО')) engineType = 'electric';
      else if (fuelRaw.includes('HYBRID') || fuelRaw.includes('ГІБРИД')) engineType = 'hybrid';

      let colorKey = '';
      const colorRaw = String(registry?.color || '').toLowerCase();
      const validColors = ['black', 'white', 'gray', 'silver', 'red', 'blue', 'green', 'yellow', 'brown', 'orange', 'purple', 'beige'];
      
      const colorMap = {
        'чорний': 'black', 'black': 'black',
        'білий': 'white', 'white': 'white',
        'сірий': 'gray', 'gray': 'gray',
        'срібний': 'silver', 'сріблястий': 'silver', 'silver': 'silver',
        'червоний': 'red', 'red': 'red',
        'синій': 'blue', 'blue': 'blue',
        'зелений': 'green', 'green': 'green',
        'жовтий': 'yellow', 'yellow': 'yellow',
        'коричневий': 'brown', 'brown': 'brown',
        'оранжевий': 'orange', 'помаранчевий': 'orange', 'orange': 'orange',
        'фіолетовий': 'purple', 'purple': 'purple',
        'бежевий': 'beige', 'beige': 'beige'
      };

      if (validColors.includes(colorRaw)) {
        colorKey = colorRaw;
      } else if (colorMap[colorRaw]) {
        colorKey = colorMap[colorRaw];
      }

      setFormData((prev) => {
        const next = { ...prev };
        if (brandKey) next.brand = brandKey;
        if (modelKey) next.model = modelKey;
        if (
          brandKey &&
          modelKey &&
          registryYear &&
          brandModelYears[brandKey][modelKey].includes(Number(registryYear))
        ) {
          next.year = Number(registryYear);
        }
        if (registry?.vin) next.vin = registry.vin;
        if (colorKey) next.color = colorKey;
        if (licenseValue) next.licensePlate = licenseValue;
        if (engineType) next.engineType = engineType;
        if (registry?.engine_volume) next.engineVolume = registry.engine_volume;
        
        return next;
      });
    } catch (err) {
      setLookupError(t('vehicle.lookupFailed', 'Не вдалося знайти дані за номером'));
    } finally {
      setLookupLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await removeVehicle(id);
      navigate('/vehicles');
    } catch (err) {
      setError(t('errors.deleteFailed', 'Помилка видалення'));
      setDeleteDialogOpen(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading...</Typography>
      </Container>
    );
  }

  if (error && !isNewVehicle) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">
            {isNewVehicle ? t('vehicle.new', 'Новий автомобіль') : `${formData.brand} ${formData.model} (${formData.licensePlate})`}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!isNewVehicle && (
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)}>
              <Tab label={t('vehicle.info', 'Інформація')} />
              <Tab label={t('vehicle.maintenance', 'Регламент ТО')} />
              <Tab label={t('serviceRecord.title', 'Сервісна книга')} />
              <Tab label={t('parts.title', 'Запчастини')} />
            </Tabs>
          </Box>
        )}

        {tabValue === 0 && (
          <>
            {isNewVehicle && isMasterUser && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 2 }}>
                <FormControl fullWidth error={Boolean(ownerError)}>
                  <InputLabel>{t('vehicle.owner', 'Власник')}</InputLabel>
                  <Select
                    value={ownerId}
                    label={t('vehicle.owner', 'Власник')}
                    onChange={handleOwnerChange}
                    disabled={ownersLoading || ownerVehiclesLoading || addClientSaving}
                  >
                    <MenuItem value="">
                      <em>{t('common.select', 'Оберіть')}</em>
                    </MenuItem>
                    {(owners || []).map((o) => (
                      <MenuItem key={o.id} value={o.id}>
                        {o.name || o.email || o.phone || o.id}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    {ownerError || t('vehicle.ownerHint', 'Для майстра: виберіть клієнта-власника')}
                  </FormHelperText>
                </FormControl>
                <Button
                  variant="outlined"
                  sx={{ mt: '6px', whiteSpace: 'nowrap' }}
                  disabled={ownersLoading || addClientSaving}
                  onClick={() => {
                    setAddClientError('');
                    setAddClientDraft({ name: '', email: '', phone: '', password: '' });
                    setAddClientOpen(true);
                  }}
                >
                  {t('clients.add', 'Додати клієнта')}
                </Button>
              </Box>
            )}

            {isNewVehicle && isMasterUser && ownerId && ownerVehiclesChecked && !ownerVehiclesLoading && !importDialogOpen && ownerVehicles.length === 0 ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                {t('vehicle.ownerNoVehicles', 'У цього власника ще немає авто. Заповніть форму нижче.')}
              </Alert>
            ) : null}

            <Dialog open={addClientOpen} onClose={() => setAddClientOpen(false)} fullWidth maxWidth="sm">
              <DialogTitle>{t('clients.add', 'Додати клієнта')}</DialogTitle>
              <DialogContent sx={{ pt: 1 }}>
                {addClientError ? (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {addClientError}
                  </Alert>
                ) : null}
                <TextField
                  fullWidth
                  sx={{ mt: 1 }}
                  label={t('auth.name', "Ім'я")}
                  value={addClientDraft.name}
                  onChange={(e) => setAddClientDraft((d) => ({ ...d, name: e.target.value }))}
                />
                <TextField
                  fullWidth
                  sx={{ mt: 2 }}
                  label={t('auth.email', 'Електронна пошта')}
                  value={addClientDraft.email}
                  onChange={(e) => setAddClientDraft((d) => ({ ...d, email: e.target.value }))}
                />
                <TextField
                  fullWidth
                  sx={{ mt: 2 }}
                  label={t('auth.phone', 'Телефон')}
                  value={addClientDraft.phone}
                  onChange={(e) => setAddClientDraft((d) => ({ ...d, phone: e.target.value }))}
                />
                <TextField
                  fullWidth
                  sx={{ mt: 2 }}
                  label={t('auth.password', 'Пароль')}
                  type="password"
                  value={addClientDraft.password}
                  onChange={(e) => setAddClientDraft((d) => ({ ...d, password: e.target.value }))}
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setAddClientOpen(false)} disabled={addClientSaving}>
                  {t('common.cancel', 'Скасувати')}
                </Button>
                <Button onClick={submitCreateClient} variant="contained" disabled={addClientSaving}>
                  {t('common.save', 'Зберегти')}
                </Button>
              </DialogActions>
            </Dialog>

            <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} fullWidth maxWidth="sm">
              <DialogTitle>
                {t('vehicle.ownerVehiclesFound', 'У цього власника вже є авто')}
              </DialogTitle>
              <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t(
                    'vehicle.importHint',
                    'Оберіть авто, які додати до моїх обслуговуємих, або продовжіть створення нового авто.'
                  )}
                </Typography>

                {(ownerVehicles || []).length <= 1 ? (
                  <Typography variant="body1">
                    {(() => {
                      const v = (ownerVehicles || [])[0];
                      if (!v) return '';
                      return `${v.make || v.brand || ''} ${v.model || ''} (${v.licensePlate || v.vin || ''})`;
                    })()}
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {(ownerVehicles || []).map((v) => (
                      <FormControlLabel
                        key={v.id}
                        control={
                          <Checkbox
                            checked={selectedOwnerVehicleIds.includes(String(v.id))}
                            onChange={() => toggleVehicleSelection(v.id)}
                          />
                        }
                        label={`${v.make || v.brand || ''} ${v.model || ''} (${v.licensePlate || v.vin || ''})`}
                      />
                    ))}
                  </Box>
                )}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setImportDialogOpen(false)} disabled={saving}>
                  {t('vehicle.addNewInstead', 'Додати нове авто')}
                </Button>
                <Button
                  variant="contained"
                  onClick={handleImportSelectedVehicles}
                  disabled={saving || selectedOwnerVehicleIds.length === 0}
                >
                  {(ownerVehicles || []).length <= 1
                    ? t('vehicle.addThis', 'Додати це авто')
                    : t('vehicle.addSelected', 'Додати вибрані')}
                </Button>
              </DialogActions>
            </Dialog>

            <VehicleForm
              formData={formData}
              handleChange={handleChange}
              handleSubmit={handleSubmit}
              saving={saving}
              isNewVehicle={isNewVehicle}
              onDeleteClick={() => setDeleteDialogOpen(true)}
              onLookupByPlate={handleLookupByPlate}
              lookupLoading={lookupLoading}
              lookupError={lookupError}
              handlePhotoChange={handlePhotoChange}
              photoPreview={photoPreview}
            />
          </>
        )}

        {tabValue === 1 && !isNewVehicle && (
          <MaintenanceTab vin={formData.vin} />
        )}

        {tabValue === 2 && !isNewVehicle && (
          <ServiceRecords
            vehicleId={vehicleMeta.id}
            ownerId={vehicleMeta.userId}
            vehicleVin={vehicleMeta.vin || formData.vin}
          />
        )}

        {tabValue === 3 && !isNewVehicle && (
          <MyParts />
        )}
      </Paper>

      <DeleteVehicleDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={2500}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        message={snackbar.message}
      />
    </Container>
  );
};

const VehicleDetails = () => {
  return (
    <ErrorBoundary>
      <VehicleDetailsContent />
    </ErrorBoundary>
  );
};

export default VehicleDetails;
