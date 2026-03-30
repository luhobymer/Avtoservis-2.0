import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getById as getVehicleById,
  create as createVehicle,
  update as updateVehicle,
  remove as removeVehicle,
  getByLicensePlate,
  lookupRegistryByLicensePlate,
  uploadPhoto,
  listForUser as listVehiclesForUser,
  attachServicedVehicles,
  recognizeLicensePlateFromPhoto,
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
import { list as listUsers } from '../api/dao/usersDao';
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

  const ocrDebugEnabled =
    typeof window !== 'undefined' &&
    (window.location?.search?.includes('ocrDebug=1') ||
      window.location?.hash?.includes('ocrDebug=1') ||
      localStorage.getItem('ocr_debug_plate') === '1');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!ocrDebugEnabled) return;
    try {
      localStorage.setItem('ocr_debug_plate', '1');
    } catch (_) {
      void _;
    }
  }, [ocrDebugEnabled]);

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
  const [addClientDraft, setAddClientDraft] = useState({ firstName: '', lastName: '', phone: '' });

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
  const [initialMileage, setInitialMileage] = useState(null);

  const [loading, setLoading] = useState(!isNewVehicle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [plateOcrLoading, setPlateOcrLoading] = useState(false);
  const [plateOcrDebug, setPlateOcrDebug] = useState(null);
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
      setInitialMileage(
        v.mileage !== undefined && v.mileage !== null && v.mileage !== '' ? Number(v.mileage) : null
      );
      if (v.photoUrl) {
        setPhotoPreview(resolveUrl(v.photoUrl));
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
            .filter((c) => String(c?.status || '').toLowerCase() === 'accepted')
            .map((c) => c?.client_id)
            .filter(Boolean)
            .map((id) => String(id))
        );

        const clients = (list || [])
          .filter((u) => String(u?.role || '').toLowerCase() === 'client')
          .filter((u) => allowedByRelationship.has(String(u?.id)));

        const selfOption =
          user?.id
            ? { id: user.id, name: 'Я', email: user.email, role: 'client' }
            : null;
        const combined = selfOption
          ? [selfOption, ...clients].filter(
              (o, idx, arr) => arr.findIndex((x) => String(x.id) === String(o.id)) === idx
            )
          : clients;
        setOwners(combined);
        if (!ownerId && user?.id) {
          setOwnerId(user.id);
        }
      } catch (err) {
        void err;
        setOwners([]);
      } finally {
        setOwnersLoading(false);
      }
    };
    run();
  }, [isNewVehicle, isMasterUser, ownerId, user?.id, user?.email]);

  const pickContactForClient = async () => {
    try {
      const contactsApi = navigator?.contacts;
      const canSelect = typeof contactsApi?.select === 'function';
      if (!canSelect) {
        setSnackbar({
          open: true,
          message:
            'Вибір контактів не підтримується цим браузером. Введіть дані вручну або відкрийте сайт у Chrome на Android.'
        });
        return;
      }

      const picked = await contactsApi.select(['name', 'tel'], { multiple: false });
      const contact = Array.isArray(picked) ? picked[0] : null;
      if (!contact) return;

      const nameRaw =
        (Array.isArray(contact.name) ? contact.name[0] : contact.name) || '';
      const phoneRaw =
        (Array.isArray(contact.tel) ? contact.tel[0] : contact.tel) || '';

      const parts = String(nameRaw).trim().split(/\s+/).filter(Boolean);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ');
      const phone = String(phoneRaw).trim();

      setAddClientDraft((prev) => ({
        ...prev,
        firstName,
        lastName,
        phone
      }));
    } catch (err) {
      void err;
      setSnackbar({ open: true, message: t('common.error', 'Помилка') });
    }
  };

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
    const firstName = String(addClientDraft.firstName || '').trim();
    const lastName = String(addClientDraft.lastName || '').trim();
    const name = `${firstName} ${lastName}`.trim();
    const phone = String(addClientDraft.phone || '').trim();

    if (!firstName || !lastName || !phone) {
      setAddClientError(t('validation.please_fill_all_fields', 'Заповніть усі поля'));
      return;
    }
    const phoneRegex = /^(\+?380|0)\d{9}$/;

    const cleanedPhone = phone.replace(/[^\d+]/g, '');
    if (!phoneRegex.test(cleanedPhone)) {
      setAddClientError(t('validation.invalid_phone', 'Невірний формат телефону'));
      return;
    }

    let normalizedPhone = cleanedPhone;
    if (normalizedPhone.startsWith('0')) {
      normalizedPhone = `+380${normalizedPhone.slice(1)}`;
    } else if (normalizedPhone.startsWith('380')) {
      normalizedPhone = `+${normalizedPhone}`;
    }

    setAddClientSaving(true);
    setAddClientError('');
    try {
      const token = localStorage.getItem('auth_token');

      const registerRes = await fetch(resolveUrl('/api/auth/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          name,
          firstName,
          lastName,
          phone: normalizedPhone,
          password: '12345678',
          role: 'client'
        })
      });

      if (!registerRes.ok) {
        let msg = `Request failed with status ${registerRes.status}`;
        try {
          const body = await registerRes.json();
          if (body && typeof body.message === 'string') msg = body.message;
          if (!msg && body && typeof body.msg === 'string') msg = body.msg;
        } catch (e) {
          void e;
        }
        throw new Error(msg);
      }

      const registerData = await registerRes.json();
      if (registerData?.requiresEmailConfirmation) {
        throw new Error(t('auth.emailVerificationRequired', 'Потрібно підтвердити email для цього користувача'));
      }
      const created = registerData?.user || registerData;
      if (!created?.id) {
        throw new Error('Invalid user response');
      }

      const relResp = await fetch(resolveUrl('/api/relationships/clients'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ client_id: created.id })
      });
      if (!relResp.ok) {
        let msg = 'Failed to create relationship';
        try {
          const body = await relResp.json();
          if (body && typeof body.message === 'string') msg = body.message;
        } catch (e) {
          void e;
        }
        throw new Error(msg);
      }

      setOwners((prev) => [{ ...created }, ...(prev || [])]);
      setOwnerId(created.id);
      setOwnerVehicles([]);
      setSelectedOwnerVehicleIds([]);
      setImportDialogOpen(false);
      setOwnerVehiclesChecked(true);
      setSnackbar({ open: true, message: t('common.saved', 'Збережено') });
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

      (async () => {
        setPlateOcrLoading(true);
        setLookupError(null);
        if (ocrDebugEnabled) setPlateOcrDebug(null);
        try {
          const plate = await recognizeLicensePlateFromPhoto(file);
          if (ocrDebugEnabled && typeof window !== 'undefined') {
            try {
              setPlateOcrDebug(window.__OCR_DEBUG_PLATE__ || null);
            } catch (err) {
              void err;
            }
          }
          const normalizedPlate = String(plate || '').trim().toUpperCase();
          if (!normalizedPlate) {
            setLookupError(t('vehicle.plateNotRecognized', 'Не вдалося розпізнати номер на фото'));
            return;
          }

          setFormData((prev) => ({
            ...prev,
            licensePlate: prev.licensePlate ? prev.licensePlate : normalizedPlate,
          }));

          try {
            let filledFromDb = false;
            try {
              const lookupUserId = isMasterUser && ownerId ? String(ownerId) : '';
              const local = await getByLicensePlate(
                normalizedPlate,
                lookupUserId ? { userId: lookupUserId } : undefined
              );
              if (local && (local.brand || local.make || local.model || local.vin)) {
                filledFromDb = true;
                setFormData((prev) => {
                  const next = { ...prev };

                  const isEmpty = (value) => value === '' || value === null || value === undefined;

                  if (isEmpty(next.brand) && (local.brand || local.make)) next.brand = local.brand || local.make;
                  if (isEmpty(next.model) && local.model) next.model = local.model;
                  if (isEmpty(next.year) && local.year) next.year = String(local.year);
                  if (isEmpty(next.vin) && local.vin) next.vin = local.vin;
                  if (isEmpty(next.engineType) && local.engineType) next.engineType = local.engineType;
                  if (isEmpty(next.transmission) && local.transmission) next.transmission = local.transmission;
                  if (isEmpty(next.engineVolume) && local.engineVolume) next.engineVolume = String(local.engineVolume);
                  if (isEmpty(next.color) && local.color) next.color = local.color;
                  if (isEmpty(next.mileage) && local.mileage != null) next.mileage = String(local.mileage);
                  if (isEmpty(next.photoUrl) && local.photoUrl) next.photoUrl = local.photoUrl;
                  if (isEmpty(next.licensePlate) && local.licensePlate) next.licensePlate = local.licensePlate;

                  return next;
                });
              }
            } catch (dbErr) {
              void dbErr;
            }

            if (!filledFromDb) {
              const registry = await lookupRegistryByLicensePlate(normalizedPlate);
              const rawBrand = registry?.brand || registry?.make || '';
              const rawModel = registry?.model || '';
              const registryYear = registry?.make_year || registry?.year || null;

              const brandKey = rawBrand
                ? Object.keys(brandModelYears).find(
                    (b) => String(b).toLowerCase() === String(rawBrand).toLowerCase()
                  ) || ''
                : '';
              const modelKey =
                brandKey && rawModel && brandModelYears[brandKey]
                  ? Object.keys(brandModelYears[brandKey]).find(
                      (m) => String(m).toLowerCase() === String(rawModel).toLowerCase()
                    ) || ''
                  : '';

              setFormData((prev) => {
                const next = { ...prev };

                const isEmpty = (value) => value === '' || value === null || value === undefined;

                const licenseValue =
                  registry?.n_reg_new ||
                  registry?.license_plate_normalized ||
                  registry?.license_plate ||
                  registry?.licensePlate ||
                  '';

                let engineType = '';
                const fuelRaw = String(registry?.fuel_type || registry?.fuel || '').toUpperCase();
                if (fuelRaw.includes('BENZINE') || fuelRaw.includes('PETROL') || fuelRaw.includes('БЕНЗИН')) engineType = 'petrol';
                else if (fuelRaw.includes('DIESEL') || fuelRaw.includes('ДИЗЕЛ')) engineType = 'diesel';
                else if (fuelRaw.includes('GAS') || fuelRaw.includes('ГАЗ')) engineType = 'gas';
                else if (fuelRaw.includes('ELECTRO') || fuelRaw.includes('ELECTRIC') || fuelRaw.includes('ЕЛЕКТРО')) engineType = 'electric';
                else if (fuelRaw.includes('HYBRID') || fuelRaw.includes('ГІБРИД')) engineType = 'hybrid';

                if (isEmpty(next.brand) && brandKey) next.brand = brandKey;
                if (isEmpty(next.model) && modelKey) next.model = modelKey;
                if (isEmpty(next.year) && registryYear) next.year = String(registryYear);
                if (isEmpty(next.vin) && registry?.vin) next.vin = registry.vin;
                if (isEmpty(next.color) && registry?.color) next.color = String(registry.color);
                if (isEmpty(next.licensePlate) && licenseValue) next.licensePlate = String(licenseValue);
                if (isEmpty(next.engineType) && engineType) next.engineType = engineType;
                if (isEmpty(next.engineVolume) && registry?.engine_volume != null && registry?.engine_volume !== '') {
                  next.engineVolume = String(registry.engine_volume);
                }
                return next;
              });
            }
          } catch (err) {
            void err;
          }
        } catch (err) {
          const rawMessage = String(err?.message || '');
          if (ocrDebugEnabled && typeof window !== 'undefined') {
            try {
              setPlateOcrDebug(window.__OCR_DEBUG_PLATE__ || null);
            } catch (debugErr) {
              void debugErr;
            }
          }
          if (rawMessage.toLowerCase().includes('ocr timeout') || rawMessage.toLowerCase().includes('timeout')) {
            setLookupError(t('errors.ocrTimeout', 'Розпізнавання займає забагато часу. Спробуйте інше фото.'));
          } else {
            setLookupError(rawMessage || t('errors.ocrFailed', 'Не вдалося розпізнати зображення'));
          }
        } finally {
          setPlateOcrLoading(false);
        }
      })();
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

      const mileageValue =
        formData.mileage !== undefined && formData.mileage !== null && formData.mileage !== ''
          ? Number(formData.mileage)
          : null;
      const currentMileage =
        initialMileage !== undefined && initialMileage !== null && initialMileage !== ''
          ? Number(initialMileage)
          : null;
      if (
        !isNewVehicle &&
        mileageValue !== null &&
        !Number.isNaN(mileageValue) &&
        currentMileage !== null &&
        !Number.isNaN(currentMileage) &&
        mileageValue < currentMileage
      ) {
        setError(
          t('validation.mileage_lower_than_current', 'Пробіг не може бути меншим за поточний')
        );
        setSaving(false);
        return;
      }

      let uploadedPhotoUrl = formData.photoUrl;
      
      if (photoFile) {
        try {
          const uploadResult = await uploadPhoto(photoFile);
          if (!uploadResult?.url) {
            setError(t('vehicle.photoUploadFailed', uploadResult?.message || 'Не вдалося завантажити фото'));
            setSaving(false);
            return;
          }
          uploadedPhotoUrl = uploadResult.url;
          setFormData((prev) => ({ ...prev, photoUrl: uploadedPhotoUrl }));
          setPhotoPreview(resolveUrl(uploadedPhotoUrl));
        } catch (uploadErr) {
          const details = uploadErr?.message ? String(uploadErr.message) : '';
          setError(t('vehicle.photoUploadFailed', details || 'Не вдалося завантажити фото'));
          setSaving(false);
          return;
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
          licensePlate: formData.licensePlate,
          mileage: formData.mileage,
          engineType: formData.engineType,
          transmission: formData.transmission,
          engineVolume: formData.engineVolume,
          color: formData.color,
          photoUrl: uploadedPhotoUrl,
          UserId: isMasterUser && ownerId ? ownerId : undefined
        };
        await updateVehicle(id, payload);
      }
      navigate('/vehicles');
    } catch (err) {
      setError(err?.message || t('errors.saveFailed', 'Помилка збереження даних'));
      setSaving(false);
    }
  };

  const handleLookupByPlate = async () => {
    if (!formData.licensePlate) return;
    setLookupLoading(true);
    setLookupError(null);

    try {
      const normalizedPlate = String(formData.licensePlate || '').trim().toUpperCase();

      try {
        const lookupUserId = isMasterUser && ownerId ? String(ownerId) : '';
        const local = await getByLicensePlate(
          normalizedPlate,
          lookupUserId ? { userId: lookupUserId } : undefined
        );
        if (local && (local.brand || local.make || local.model || local.vin)) {
          setFormData((prev) => {
            const next = { ...prev };
            const isEmpty = (value) => value === '' || value === null || value === undefined;
            if (isEmpty(next.brand) && (local.brand || local.make)) next.brand = local.brand || local.make;
            if (isEmpty(next.model) && local.model) next.model = local.model;
            if (isEmpty(next.year) && local.year) next.year = String(local.year);
            if (isEmpty(next.vin) && local.vin) next.vin = local.vin;
            if (isEmpty(next.engineType) && local.engineType) next.engineType = local.engineType;
            if (isEmpty(next.transmission) && local.transmission) next.transmission = local.transmission;
            if (isEmpty(next.engineVolume) && local.engineVolume) next.engineVolume = String(local.engineVolume);
            if (isEmpty(next.color) && local.color) next.color = local.color;
            if (isEmpty(next.mileage) && local.mileage != null) next.mileage = String(local.mileage);
            if (isEmpty(next.photoUrl) && local.photoUrl) next.photoUrl = local.photoUrl;
            if (local.licensePlate) next.licensePlate = local.licensePlate;
            return next;
          });
          return;
        }
      } catch (dbErr) {
        void dbErr;
      }

      const registry = await lookupRegistryByLicensePlate(normalizedPlate);
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
        normalizedPlate;
      
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
                    setAddClientDraft({ firstName: '', lastName: '', phone: '' });
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
                  label={t('auth.firstName', "Ім'я")}
                  value={addClientDraft.firstName}
                  onChange={(e) =>
                    setAddClientDraft((d) => ({ ...d, firstName: e.target.value }))
                  }
                />
                <TextField
                  fullWidth
                  sx={{ mt: 2 }}
                  label={t('auth.lastName', 'Прізвище')}
                  value={addClientDraft.lastName}
                  onChange={(e) =>
                    setAddClientDraft((d) => ({ ...d, lastName: e.target.value }))
                  }
                />
                <TextField
                  fullWidth
                  sx={{ mt: 2 }}
                  label={t('auth.phone', 'Телефон')}
                  value={addClientDraft.phone}
                  onChange={(e) => setAddClientDraft((d) => ({ ...d, phone: e.target.value }))}
                />
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setAddClientOpen(false)} disabled={addClientSaving}>
                  {t('common.cancel', 'Скасувати')}
                </Button>
                <Button onClick={pickContactForClient} disabled={addClientSaving}>
                  {t('contacts.from_phone', 'З контактів')}
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
              plateOcrLoading={plateOcrLoading}
              plateOcrDebugEnabled={ocrDebugEnabled}
              plateOcrDebug={plateOcrDebug}
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
