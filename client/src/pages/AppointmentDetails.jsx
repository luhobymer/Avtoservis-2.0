import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Alert } from '@mui/material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import {
  getById as getAppointmentById,
  create as createAppointment,
  update as updateAppointment,
  updateStatus,
  remove as removeAppointment,
} from '../api/dao/appointmentsDao';
import { list as listVehicles, listForUser as listVehiclesForUser, getById as getVehicleById } from '../api/dao/vehiclesDao';
import { getCurrent as getCurrentMechanic, list as listMechanics } from '../api/dao/mechanicsDao';
import { listMechanicServices } from '../api/dao/mechanicServicesDao';
import { listForAppointment as listVehiclePartsForAppointment } from '../api/dao/vehiclePartsDao';
import { createMechanicService } from '../api/dao/mechanicServicesDao';
import { listServiceCategories } from '../api/dao/serviceCategoriesDao';
import {
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  CircularProgress,
  Box,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stepper,
  Step,
  StepLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  LinearProgress,
  Autocomplete,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { uk } from 'date-fns/locale';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

import Snackbar from '@mui/material/Snackbar';
import AppointmentChat from '../components/chat/AppointmentChat';
import { compressImageFile } from '../utils/imageUtils';

const DEFAULT_API_BASE_URL = 'https://avtoservis-server.onrender.com';
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
)
  .trim()
  .replace(/\/+$/, '');
const resolveUrl = (url) => (url.startsWith('http') ? url : `${API_BASE_URL}${url}`);

const AppointmentDetails = ({ isNew }) => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isNewAppointment = isNew || id === 'new';
  const { user, isMaster } = useAuth();
  const isMasterUser = typeof isMaster === 'function' ? isMaster() : false;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const chatAnchorRef = useRef(null);

  useEffect(() => {
    if (isNewAppointment) return;

    const hash = String(location.hash || '').toLowerCase();
    const params = new URLSearchParams(location.search || '');
    const tab = String(params.get('tab') || '').toLowerCase();
    const wantsChat = hash === '#chat' || tab === 'chat';

    if (!wantsChat) return;
    if (!chatAnchorRef.current) return;

    const timer = setTimeout(() => {
      try {
        chatAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (_) {
        void _;
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [isNewAppointment, location.hash, location.search]);
  
  const [hideMechanicSelection, setHideMechanicSelection] = useState(false);
  const [loading, setLoading] = useState(!isNewAppointment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Completion Dialog States
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [completionData, setCompletionData] = useState({
    completion_mileage: '',
    completion_notes: '',
    parts: []
  });
  const [newPart, setNewPart] = useState({
    name: '',
    part_number: '',
    price: '',
    quantity: 1,
    purchased_by: 'owner', // or 'service'
    notes: ''
  });
  
  // OCR State for Completion
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState('');

  // Client Manual Parts State (Create Appointment)
  const [clientParts, setClientParts] = useState([]);
  const [clientNewPart, setClientNewPart] = useState({ name: '', quantity: 1, notes: '' });

  const [appointmentParts, setAppointmentParts] = useState([]);

  const [vehicles, setVehicles] = useState([]);
  const [fetchedVehicle, setFetchedVehicle] = useState(null);
  const [services, setServices] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [success, setSuccess] = useState(false);
  const [appointmentUserId, setAppointmentUserId] = useState('');

  const [servicesConfirmed, setServicesConfirmed] = useState(false);
  const [addServiceDialogOpen, setAddServiceDialogOpen] = useState(false);
  const [addServiceSaving, setAddServiceSaving] = useState(false);
  const [addServiceError, setAddServiceError] = useState('');
  const [addServiceForm, setAddServiceForm] = useState({
    name: '',
    price: '',
    duration: '',
    category_id: '',
  });
  const [addServiceCategories, setAddServiceCategories] = useState([]);

  const [mechanicCity, setMechanicCity] = useState('');
  const [serviceCategoryId, setServiceCategoryId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clients, setClients] = useState([]);
  
  const [formData, setFormData] = useState({
    vehicle_vin: '',
    service_id: null,
    service_ids: [],
    mechanic_id: null,
    serviceType: '',
    description: '',
    status: 'pending',
    scheduledDate: new Date(new Date().setHours(new Date().getHours() + 1)),
    estimatedCompletionDate: new Date(new Date().setDate(new Date().getDate() + 1)),
    actualCompletionDate: null,
    notes: '',
    appointment_price: '',
    appointment_duration: ''
  });
  const [serviceSelectOpen, setServiceSelectOpen] = useState(false);

  // ... (Keep existing fetch effects and helper functions)
  // Re-implementing them briefly to ensure file integrity

  const formatServicePrice = (service) => {
    if (service?.price_text) return String(service.price_text);
    if (service?.price != null) return `${service.price} грн`;
    return '';
  };

  const normalizeCategoryLabel = useCallback((value) =>
    String(value || '')
      .toLowerCase()
      .replace(/[^a-zа-яіїєґ0-9\s]+/giu, ' ')
      .replace(/\s+/g, ' ')
      .trim(), []);

  const canonicalCategoryLabel = useCallback((value) => {
    const normalized = normalizeCategoryLabel(value);
    if (!normalized) return t('services.noCategory', 'Без категорії');
    if (normalized.includes('діагност')) return 'Діагностика';
    if (normalized.includes('двигун')) return 'Двигун';
    if (normalized.includes('зчеп')) return 'Зчеплення';
    if (normalized.includes('гальм')) return 'Гальмівна система';
    if (normalized.includes('охолод')) return 'Система охолодження';
    if (normalized.includes('запал')) return 'Система запалювання';
    if (normalized.includes('вихлоп') || normalized.includes('глуш')) return 'Вихлопна система';
    if (normalized.includes('електр')) return 'Автоелектрика';
    if (normalized.includes('підвіск') || normalized.includes('рульов')) return 'Підвіска та рульове';
    if (normalized.includes('трансм')) return 'Трансмісія';
    if (normalized.includes('клімат') || normalized.includes('кондиц')) return 'Кліматична система';
    if (normalized.includes('то') || normalized.includes('обслугов')) return 'Планове ТО';
    return String(value || '').trim();
  }, [normalizeCategoryLabel, t]);

  const normalizeServiceLabel = useCallback((value) =>
    String(value || '')
      .toLowerCase()
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\b(v6|v8|8кл|16кл|4\s*цил|6\s*цил|8\s*цил|бенз|дизель)\b/giu, ' ')
      .replace(/[^a-zа-яіїєґ0-9\s]+/giu, ' ')
      .replace(/\s+/g, ' ')
      .trim(), []);

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const isClientUser = String(user?.role || '').toLowerCase() === 'client';
        const rows =
          isNewAppointment && !isClientUser
            ? clientId
              ? await listVehiclesForUser(clientId)
              : []
            : await listVehicles();
        setVehicles(rows);
        if (isNewAppointment) {
          const urlParams = new URLSearchParams(window.location.search);
          const vehicleVin = urlParams.get('vehicle_vin') || urlParams.get('vehicleId');
          if (vehicleVin) {
            const found = rows.find(
              (v) =>
                v.vin === vehicleVin ||
                v.licensePlate === vehicleVin ||
                v.license_plate === vehicleVin
            );
            if (found) {
                setFormData((prev) => ({ ...prev, vehicle_vin: found.vin }));
            }
          } else if (rows.length > 0) {
             setFormData((prev) => ({ ...prev, vehicle_vin: rows[0].vin }));
          }
        }
      } catch (err) {
        setError(err.message || t('errors.failedToLoadVehicles'));
      }
    };

    const fetchClients = async () => {
      try {
        const isClientUser = String(user?.role || '').toLowerCase() === 'client';
        if (!isNewAppointment || isClientUser) return;
        const token = localStorage.getItem('auth_token');
        if (!token) return;
        const res = await fetch(resolveUrl('/api/relationships/clients'), {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        const mapped = (data || [])
          .filter((c) => String(c?.status || '') !== 'rejected')
          .map((c) => ({
            id: c.client_id,
            name: c.name,
            email: c.email
          }))
          .filter((c) => c.id);
        setClients(mapped);
        if (!clientId && mapped.length > 0) {
          setClientId(String(mapped[0].id));
        }
      } catch (err) {
        void err;
        setClients([]);
      }
    };

    const fetchMechanics = async () => {
      try {
        const role = String(user?.role || '').toLowerCase();
        if (role === 'client') {
             setHideMechanicSelection(false);
             const token = localStorage.getItem('auth_token');
             const res = await fetch(resolveUrl('/api/relationships/mechanics'), {
               headers: { Authorization: `Bearer ${token}` }
             });
             const data = await res.json();
             const accepted = data.filter(m => m.status === 'accepted').map(m => ({
                 id: m.mechanic_id,
                 fullName: m.name,
                 ...m
             }));
             setMechanics(accepted);
        } else if (role === 'master' || role === 'mechanic' || role === 'admin') {
          setHideMechanicSelection(true);
          try {
            const current = await getCurrentMechanic();
            if (current?.id) {
              setMechanics([current]);
              setFormData((prev) => ({
                ...prev,
                mechanic_id: prev.mechanic_id ? String(prev.mechanic_id) : String(current.id),
                ...(isNewAppointment ? { service_id: null } : {})
              }));
              return;
            }
          } catch (_) {
            void _;
          }
          setMechanics([]);
          setError(t('errors.mechanicProfileNotFound'));
        } else {
          const city = mechanicCity || (isNewAppointment ? user?.city : '') || '';
          const rows = await listMechanics(city ? { city } : undefined);
          setMechanics(rows);
          setHideMechanicSelection(false);
        }
      } catch (err) {
        console.error(err);
        setMechanics([]);
      }
    };

    const fetchAppointment = async () => {
      if (isNewAppointment) {
        setLoading(false);
        return;
      }
      try {
        const appointment = await getAppointmentById(id);
        console.log('[fetchAppointment] Raw appointment data:', appointment);
        console.log('[fetchAppointment] scheduled_time:', appointment?.scheduled_time);
        console.log('[fetchAppointment] appointment_price:', appointment?.appointment_price);
        console.log('[fetchAppointment] appointment_duration:', appointment?.appointment_duration);
        setAppointmentUserId(appointment?.UserId || appointment?.user_id || '');
        const serviceIdsFromAppointment = Array.isArray(appointment?.service_ids)
          ? appointment.service_ids
          : Array.isArray(appointment?.service_ids_list)
            ? appointment.service_ids_list
            : [];
        const normalizedServiceIds = serviceIdsFromAppointment
          .map((sid) => (sid == null ? '' : String(sid).trim()))
          .filter(Boolean);
        const fallbackServiceId = normalizedServiceIds[0] || null;
        setFormData((prev) => ({
          ...prev,
          vehicle_vin: appointment.vehicle_vin || prev.vehicle_vin || '',
          service_id: appointment.service_id || appointment.serviceId || fallbackServiceId || prev.service_id || null,
          service_ids: normalizedServiceIds.length > 0
            ? normalizedServiceIds
            : (appointment.service_id || appointment.serviceId ? [String(appointment.service_id || appointment.serviceId)] : prev.service_ids || []),
          mechanic_id: appointment.mechanic_id || prev.mechanic_id || null,
          serviceType: appointment.serviceType || appointment.service_type || prev.serviceType || '',
          description: appointment.description || '',
          status: appointment.status || 'pending',
          scheduledDate: appointment.scheduled_time
            ? new Date(appointment.scheduled_time)
            : (appointment.scheduledDate ? new Date(appointment.scheduledDate) : prev.scheduledDate || new Date()),
          estimatedCompletionDate: appointment.appointment_date
            ? new Date(appointment.appointment_date)
            : (appointment.estimated_completion_date
                ? new Date(appointment.estimated_completion_date)
                : (appointment.estimatedCompletionDate
                    ? new Date(appointment.estimatedCompletionDate)
                    : prev.estimatedCompletionDate || new Date(new Date().setDate(new Date().getDate() + 1)))),
          actualCompletionDate: appointment.actual_completion_date
            ? new Date(appointment.actual_completion_date)
            : (appointment.actualCompletionDate ? new Date(appointment.actualCompletionDate) : prev.actualCompletionDate || null),
          notes: appointment.notes || '',
          appointment_price:
            appointment.appointment_price != null
              ? String(appointment.appointment_price)
              : (appointment.appointmentPrice != null ? String(appointment.appointmentPrice) : ''),
          appointment_duration:
            appointment.appointment_duration != null
              ? String(appointment.appointment_duration)
              : (appointment.appointmentDuration != null ? String(appointment.appointmentDuration) : ''),
        }));
        console.log('[fetchAppointment] Form data after update:', {
          scheduledDate: appointment.scheduled_time,
          appointment_price: appointment.appointment_price,
          appointment_duration: appointment.appointment_duration,
        });
      } catch (err) {
        setError(err.message || t('errors.failedToLoadAppointment'));
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
    fetchVehicles();
    fetchMechanics();
    fetchAppointment();
  }, [id, isNewAppointment, t, mechanicCity, user?.city, user?.role, clientId]);

  useEffect(() => {
    const run = async () => {
      if (isNewAppointment || !id) {
        setAppointmentParts([]);
        return;
      }
      try {
        const rows = await listVehiclePartsForAppointment(id);
        setAppointmentParts(Array.isArray(rows) ? rows : []);
      } catch (_) {
        setAppointmentParts([]);
      }
    };
    run();
  }, [id, isNewAppointment]);

  useEffect(() => {
    const fetchVehicleDetails = async () => {
        if (!formData.vehicle_vin || isNewAppointment) return;
        const found = vehicles.find(v => v.vin === formData.vehicle_vin);
        if (found) {
            setFetchedVehicle(found);
            return;
        }
        try {
            const v = await getVehicleById(formData.vehicle_vin);
            setFetchedVehicle(v);
        } catch (err) {
            console.error('Failed to fetch vehicle details', err);
        }
    };
    fetchVehicleDetails();
  }, [formData.vehicle_vin, vehicles, isNewAppointment]);

  useEffect(() => {
    const run = async () => {
      const mechanicId = formData.mechanic_id;
      if (!mechanicId) {
        setServices([]);
        setServicesConfirmed(false);
        return;
      }
      try {
        // If editing, fetch all services (including disabled) to ensure current service is found.
        // If creating new, only fetch enabled services.
        const rows = await listMechanicServices(mechanicId, { enabled: isNewAppointment });
        
        // Ensure we handle case where rows might be undefined or not array
        const safeRows = Array.isArray(rows) ? rows : [];
        setServices(safeRows);
      } catch (err) {
        console.error('Failed to load mechanic services', err);
        setServices([]);
        setError(err?.message || t('errors.failedToLoadServices'));
      }
    };
    run();
  }, [formData.mechanic_id, t, isNewAppointment]);

  const serviceOptions = useMemo(() => {
    const grouped = new Map();
    for (const s of services || []) {
      const rawCategoryName =
        (s?.category && s.category.name) || s?.category_name || s?.categoryName || t('services.noCategory', 'Без категорії');
      const categoryName = canonicalCategoryLabel(rawCategoryName);
      const categoryKey = normalizeCategoryLabel(categoryName) || '__none__';
      const serviceName = String(s?.name || '').trim();
      if (!serviceName) continue;
      if (!grouped.has(categoryKey)) grouped.set(categoryKey, []);
      grouped.get(categoryKey).push({
        ...s,
        category_key: categoryKey,
        category_name: categoryName,
        display_name: serviceName,
      });
    }

    const result = [];
    for (const [categoryKey, rows] of grouped.entries()) {
      const sortedRows = [...rows].sort((a, b) =>
        String(a.display_name || '').length - String(b.display_name || '').length
      );
      const seen = [];
      for (const row of sortedRows) {
        const normalized = normalizeServiceLabel(row.display_name);
        if (!normalized) continue;
        const alreadySeen = seen.some((saved) => {
          if (saved === normalized) return true;
          if (saved.includes(normalized) && saved.length - normalized.length <= 8) return true;
          if (normalized.includes(saved) && normalized.length - saved.length <= 8) return true;
          return false;
        });
        if (alreadySeen) continue;
        seen.push(normalized);
        result.push({ ...row, category_key: categoryKey });
      }
    }
    return result;
  }, [canonicalCategoryLabel, normalizeCategoryLabel, normalizeServiceLabel, services, t]);

  const serviceCategories = useMemo(() => {
    const map = new Map();
    for (const option of serviceOptions) {
      if (!map.has(option.category_key)) {
        map.set(option.category_key, {
          id: option.category_key,
          name: option.category_name || t('services.noCategory', 'Без категорії'),
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [serviceOptions, t]);

  useEffect(() => {
    if (!services || services.length === 0) {
      setServiceCategoryId('');
      return;
    }
    const selectedServiceId = (formData.service_ids && formData.service_ids.length > 0)
      ? formData.service_ids[0]
      : formData.service_id;
    const selectedService = selectedServiceId
      ? (serviceOptions || []).find((s) => String(s.id) === String(selectedServiceId))
      : null;

    if (selectedService) {
      const selectedCategory = selectedService?.category_key || '__none__';
      
      // Force update category ID if it doesn't match
      if (serviceCategoryId !== String(selectedCategory)) {
          setServiceCategoryId(String(selectedCategory));
      }
      return;
    } else if (formData.service_id && serviceOptions.length > 0) {
        // Service ID exists but not found in services list? 
        // Try to find if it's because of type mismatch or something.
        // Or maybe services list is incomplete?
        // But we load ALL services now.
        console.warn('Service ID exists but not found in list:', formData.service_id);
    }
    
    // Fallback: if we have service_id but couldn't find it in the list (shouldn't happen due to previous fix, but just in case)
    // we might need to wait for services to load.
    
    // If no service selected, or service has no category, don't auto-select first category if we are editing
    if (!isNewAppointment && !serviceCategoryId) {
       // Do nothing, let user select
    }
    
    if (!serviceCategoryId && serviceCategories.length > 0 && isNewAppointment) {
      setServiceCategoryId(String(serviceCategories[0].id));
    }
  }, [serviceOptions, formData.service_id, formData.service_ids, serviceCategories, serviceCategoryId, isNewAppointment, services]);

  useEffect(() => {
    if (!mechanics || mechanics.length === 0) return;
    const list = mechanics || [];
    const current = String(formData.mechanic_id || '');
    const hasCurrent = current && list.some((m) => String(m?.id || '') === current);
    if (hasCurrent) return;
    
    // Don't auto-select mechanic if we are editing an existing appointment (unless it's invalid)
    // But if mechanic_id is null (e.g. not loaded yet or cleared), maybe we should wait.
    // If isNewAppointment, we can auto-select first.
    if (!isNewAppointment && current) return; 

    const firstId = list[0]?.id ? String(list[0].id) : '';
    if (!firstId) return;
    
    if (isNewAppointment) {
        setFormData((prev) => ({
          ...prev,
          mechanic_id: firstId,
          service_id: null
        }));
    }
  }, [mechanics, formData.mechanic_id, isNewAppointment]);

  useEffect(() => {
    if (!isNewAppointment) return;
    if (mechanicCity) return;
    const nextCity = (user?.city || '').trim();
    if (nextCity) {
      setMechanicCity(nextCity);
    }
  }, [isNewAppointment, mechanicCity, user?.city]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleDateChange = (name, date) => {
    setFormData({ ...formData, [name]: date });
  };

  const handleServiceChange = (value) => {
    const selectedIds = Array.isArray(value)
      ? value.map((v) => String(v)).filter(Boolean)
      : (value ? [String(value)] : []);
    const selectedServices = (serviceOptions || []).filter((s) =>
      selectedIds.includes(String(s.id))
    );
    const selectedPrice = selectedServices
      .map((s) => Number(s.price ?? s.base_price ?? s.basePrice ?? 0))
      .filter((n) => Number.isFinite(n))
      .reduce((a, b) => a + b, 0);
    const selectedDuration = selectedServices
      .map((s) => Number(s.duration ?? s.base_duration ?? s.baseDuration ?? 0))
      .filter((n) => Number.isFinite(n))
      .reduce((a, b) => a + b, 0);
    const serviceType = selectedServices.map((s) => s.name).filter(Boolean).join(', ');
    setFormData((prev) => ({
      ...prev,
      service_ids: selectedIds,
      service_id: selectedIds[0] || null,
      serviceType: serviceType || prev.serviceType,
      appointment_price: selectedIds.length > 0 ? String(selectedPrice || '') : '',
      appointment_duration: selectedIds.length > 0 ? String(selectedDuration || '') : '',
    }));
    if (isNewAppointment) {
      setServicesConfirmed(false);
    }
  };

  const handleClearServices = () => {
    handleServiceChange([]);
  };

  const handleDoneServices = () => {
    setServiceSelectOpen(false);
  };

  const handleConfirmServices = () => {
    const hasSelection =
      (formData.service_ids && formData.service_ids.length > 0) || Boolean(formData.service_id);
    if (!hasSelection) return;
    setServicesConfirmed(true);
  };

  const handleOpenAddService = () => {
    setAddServiceError('');
    setAddServiceForm({ name: '', price: '', duration: '', category_id: '' });
    setAddServiceDialogOpen(true);
  };

  const handleCreateService = async () => {
    const mechanicId = formData.mechanic_id ? String(formData.mechanic_id) : '';
    if (!mechanicId) {
      setAddServiceError(t('appointment.mechanicRequired', 'Оберіть майстра'));
      return;
    }
    const name = String(addServiceForm.name || '').trim();
    if (!name) {
      setAddServiceError(t('services.nameRequired', "Назва послуги обов'язкова"));
      return;
    }
    setAddServiceSaving(true);
    setAddServiceError('');
    try {
      const payload = {
        name,
        price: addServiceForm.price !== '' ? Number(addServiceForm.price) : null,
        duration: addServiceForm.duration !== '' ? Number(addServiceForm.duration) : null,
        category_id: addServiceForm.category_id || null,
      };
      const created = await createMechanicService(mechanicId, payload);
      const createdId = created?.service_id || created?.serviceId || created?.id;

      const rows = await listMechanicServices(mechanicId, { enabled: isNewAppointment });
      const safeRows = Array.isArray(rows) ? rows : [];
      setServices(safeRows);

      if (createdId) {
        const nextId = String(createdId);
        handleServiceChange([nextId]);
      }
      setAddServiceDialogOpen(false);
    } catch (err) {
      setAddServiceError(err?.message || t('common.error', 'Помилка'));
    } finally {
      setAddServiceSaving(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        const rows = await listServiceCategories();
        setAddServiceCategories(Array.isArray(rows) ? rows : []);
      } catch (_) {
        setAddServiceCategories([]);
      }
    };
    run();
  }, []);

  const handleMechanicChange = (e) => {
    const { value } = e.target;
    setFormData((prev) => ({
      ...prev,
      mechanic_id: value || null,
      service_id: null,
      service_ids: [],
      appointment_price: '',
      appointment_duration: ''
    }));
    if (isNewAppointment) {
      setServicesConfirmed(false);
    }
  };

  const handleMechanicCityChange = (e) => {
    setMechanicCity(e.target.value);
    setFormData((prev) => ({ ...prev, mechanic_id: null }));
  };

  const handleClientChange = (e) => {
    const next = e.target.value;
    setClientId(next);
    setFormData((prev) => ({ ...prev, vehicle_vin: '' }));
  };

  // --- Client Parts Logic ---
  const handleAddClientPart = () => {
    if (!clientNewPart.name) return;
    setClientParts(prev => [...prev, { ...clientNewPart, id: Date.now() }]);
    setClientNewPart({ name: '', quantity: 1, notes: '' });
  };
  const handleRemoveClientPart = (id) => {
    setClientParts(prev => prev.filter(p => p.id !== id));
  };

  // --- Completion Logic ---
  const handleAddPart = () => {
    if (!newPart.name) return;
    setCompletionData(prev => ({
      ...prev,
      parts: [...prev.parts, { ...newPart, id: Date.now() }]
    }));
    setNewPart({
      name: '',
      part_number: '',
      price: '',
      quantity: 1,
      purchased_by: 'owner',
      notes: ''
    });
  };

  const handleRemovePart = (partId) => {
    setCompletionData(prev => ({
      ...prev,
      parts: prev.parts.filter(p => p.id !== partId)
    }));
  };

  const handleStatusAction = async (newStatus) => {
    if (newStatus === 'completed') {
      const vehicle = vehicles.find(v => v.vin === formData.vehicle_vin);
      setCompletionData(prev => ({
        ...prev,
        completion_mileage: vehicle ? vehicle.mileage : '',
        completion_notes: formData.notes
      }));
      setCompletionDialogOpen(true);
      return;
    }
    try {
      const pricingPayload = {};
      if (formData.appointment_price !== '') {
        pricingPayload.appointment_price = Number(formData.appointment_price);
      }
      if (formData.appointment_duration !== '') {
        pricingPayload.appointment_duration = Number(formData.appointment_duration);
      }
      await updateStatus(id, newStatus, pricingPayload);
      setFormData(prev => ({ ...prev, status: newStatus }));
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Помилка оновлення статусу');
    }
  };

  const handleConfirmCompletion = async () => {
    if (!completionData.completion_mileage) {
        alert(t('errors.mileageRequired', 'Будь ласка, вкажіть пробіг'));
        return;
    }
    try {
      setSaving(true);
      const payload = { ...completionData };
      if (formData.appointment_price !== '') {
        payload.appointment_price = Number(formData.appointment_price);
      }
      if (formData.appointment_duration !== '') {
        payload.appointment_duration = Number(formData.appointment_duration);
      }
      payload.actual_completion_date = new Date().toISOString();
      await updateStatus(id, 'completed', payload);
      setFormData(prev => ({ ...prev, status: 'completed' }));
      setSuccess(true);
      setCompletionDialogOpen(false);
      setTimeout(() => navigate('/appointments'), 1500);
    } catch (err) {
      setError(err.message || 'Помилка завершення запису');
    } finally {
      setSaving(false);
    }
  };

  const handleOcrUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setOcrLoading(true);
    if (ocrPreviewUrl) {
      URL.revokeObjectURL(ocrPreviewUrl);
    }
    const preview = URL.createObjectURL(file);
    setOcrPreviewUrl(preview);

    const compressed = await compressImageFile(file);
    const formData = new FormData();
    formData.append('image', compressed);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(resolveUrl('/api/ocr/parse'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (!response.ok) throw new Error('Failed to parse image');
      const data = await response.json();
      
      // Merge parsed parts into completionData.parts
      // Assuming purchased_by default 'service' or 'owner'? Usually if master adds it, it might be service or owner provided.
      // Let's assume 'service' provided if master adds from invoice, but let's default to 'owner' as in OCR logic or let user edit.
      // The OCR controller sets purchased_by to 'owner' by default.
      
      const newParts = data.map(p => ({
          ...p,
          id: Date.now() + Math.random(),
          purchased_by: 'service' // Usually master scanning invoice = service bought it
      }));
      
      setCompletionData(prev => ({
          ...prev,
          parts: [...prev.parts, ...newParts]
      }));
      
    } catch (err) {
      alert(t('errors.ocrFailed', 'Не вдалося розпізнати зображення'));
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const focusField = (fieldId) => {
      const el = document.getElementById(fieldId);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      if (el && typeof el.focus === 'function') {
        el.focus();
      }
    };
    try {
      if (!formData.scheduledDate) {
        focusField('scheduledDate');
        throw new Error(t('errors.invalidScheduledDate', 'Некоректна дата'));
      }

      if (!formData.vehicle_vin) {
        focusField('vehicle_vin');
        throw new Error(t('errors.vehicleRequired', 'Оберіть авто'));
      }

      if (!formData.mechanic_id) {
        focusField('mechanic_id');
        throw new Error(t('errors.mechanicRequired', 'Оберіть майстра'));
      }

      if (!formData.service_id && (!formData.service_ids || formData.service_ids.length === 0)) {
        focusField('service_ids');
        throw new Error(t('errors.serviceRequired', 'Оберіть послугу'));
      }

      if (isNewAppointment && !servicesConfirmed) {
        focusField('service_ids');
        throw new Error(t('errors.confirmServices', 'Підтвердіть вибір послуг'));
      }

      const isClientUser = String(user?.role || '').toLowerCase() === 'client';
      const effectiveServiceIds =
        formData.service_ids && formData.service_ids.length > 0
          ? formData.service_ids
          : (formData.service_id ? [String(formData.service_id)] : []);

      const payload = {
        user_id: isClientUser ? (user?.id || null) : (clientId || null),
        service_id: formData.service_id || effectiveServiceIds[0] || null,
        service_ids: effectiveServiceIds,
        mechanic_id: formData.mechanic_id || null,
        service_type: formData.serviceType,
        scheduled_time: formData.scheduledDate.toISOString(),
        vehicle_vin: formData.vehicle_vin,
        status: formData.status,
        description: formData.description || '',
        notes: formData.notes || '',
        estimated_completion_date: formData.estimatedCompletionDate
          ? new Date(formData.estimatedCompletionDate).toISOString()
          : null,
      };

      console.log('[handleSubmit] Form data:', {
        formData_service_id: formData.service_id,
        formData_service_ids: formData.service_ids,
        effectiveServiceIds,
        payload_service_id: payload.service_id,
        payload_service_ids: payload.service_ids,
        isNewAppointment,
      });

      if (formData.appointment_price !== '' && formData.appointment_price != null) {
        payload.appointment_price = Number(formData.appointment_price);
      }
      if (formData.appointment_duration !== '' && formData.appointment_duration != null) {
        payload.appointment_duration = Number(formData.appointment_duration);
      }

      if (isNewAppointment && clientParts.length > 0) {
        payload.parts = clientParts.map((p) => ({
          name: p.name,
          quantity: p.quantity,
          notes: p.notes,
          purchased_by: 'owner',
        }));
      }

      if (isNewAppointment) {
        if (!payload.user_id) {
          focusField('client_id');
          throw new Error(t('errors.clientRequired', 'Оберіть клієнта'));
        }
        await createAppointment(payload);
      } else {
        await updateAppointment(id, payload);
      }
      setSuccess(true);
      setTimeout(() => navigate('/appointments'), 1500);
    } catch (err) {
      setError(err?.message || t('errors.failedToSaveAppointment'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      if (isMasterUser) {
        await removeAppointment(id);
      } else {
        await updateStatus(id, 'cancelled');
      }
      navigate('/appointments');
    } catch (err) {
      setError(err.message || 'Не вдалося виконати дію');
      setDeleteDialogOpen(false);
    }
  };

  const getStatusStep = (status) => {
    switch (status) {
      case 'pending':
        return 0;
      case 'confirmed':
        return 1;
      case 'in_progress':
        return 2;
      case 'completed':
        return 3;
      case 'cancelled':
        return 0;
      default: return 0;
    }
  };
  const steps = [
    t('appointment.statuses.pending'),
    t('appointment.statuses.confirmed'),
    t('appointment.statuses.in_progress'),
    t('appointment.statuses.completed')
  ];

  const filteredServices = useMemo(() => {
    if (!serviceCategoryId) return [];
    return (serviceOptions || []).filter(
      (s) => String(s?.category_key || '__none__') === String(serviceCategoryId)
    );
  }, [serviceOptions, serviceCategoryId]);

  const selectedCategory = useMemo(
    () => serviceCategories.find((cat) => String(cat.id) === String(serviceCategoryId)) || null,
    [serviceCategories, serviceCategoryId]
  );

  const selectedServices = useMemo(() => {
    const ids = new Set((formData.service_ids || []).map((sid) => String(sid)));
    return (serviceOptions || []).filter((service) => ids.has(String(service.id)));
  }, [serviceOptions, formData.service_ids]);

  if (loading) {
    return <Container sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Container>;
  }

  return (
    <>
      <Snackbar open={success} autoHideDuration={1500} onClose={() => setSuccess(false)} message={t('appointment.success')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} />
      <Paper elevation={3} sx={{ p: 3, mt: 4, mb: 4 }}>
          {/* Header & Stepper ... (same as before) */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
             <Typography variant={isMobile ? 'h5' : 'h4'}>{isNewAppointment ? t('appointment.schedule') : t('common.edit')}</Typography>
             {!isNewAppointment && isMasterUser && formData.status !== 'completed' && formData.status !== 'cancelled' && (
               <Box>
                 {formData.status === 'pending' && (
                   <Button variant="contained" color="primary" onClick={() => handleStatusAction('confirmed')}>
                     {t('appointment.confirm', 'Підтвердити')}
                   </Button>
                 )}
                 {formData.status === 'confirmed' && <Button variant="contained" color="primary" onClick={() => handleStatusAction('in_progress')}>{t('appointment.startWork')}</Button>}
                 {formData.status === 'in_progress' && <Button variant="contained" color="success" onClick={() => handleStatusAction('completed')}>{t('appointment.completeWork')}</Button>}
               </Box>
             )}
          </Box>
          {!isNewAppointment && formData.status !== 'cancelled' && (
            <Box sx={{ width: '100%', mb: 4 }}>
              <Stepper activeStep={getStatusStep(formData.status)} alternativeLabel>
                {steps.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
              </Stepper>
            </Box>
          )}
          <Divider sx={{ mb: 3 }} />
          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
          
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              {/* Fields ... (same as before) */}
              {isNewAppointment && String(user?.role || '').toLowerCase() !== 'client' && (
                <Grid item xs={12}>
                  <FormControl fullWidth required>
                    <InputLabel>{t('clients.title')}</InputLabel>
                    <Select id="client_id" value={clientId} onChange={handleClientChange} label={t('clients.title')}>
                      {clients.map((c) => <MenuItem key={c.id} value={c.id}>{c.name || c.email}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12}>
                {isNewAppointment ? (
                  <FormControl fullWidth required>
                    <InputLabel>{t('vehicle.title')}</InputLabel>
                    <Select id="vehicle_vin" name="vehicle_vin" value={formData.vehicle_vin} onChange={handleChange} label={t('vehicle.title')}>
                      {vehicles.map((vehicle) => <MenuItem key={vehicle.vin} value={vehicle.vin}>{vehicle.brand} {vehicle.model} ({vehicle.licensePlate || vehicle.license_plate || vehicle.vin})</MenuItem>)}
                    </Select>
                  </FormControl>
                ) : (
                  <TextField
                    fullWidth
                    label={t('vehicle.title')}
                    value={fetchedVehicle ? `${fetchedVehicle.make || fetchedVehicle.brand} ${fetchedVehicle.model} (${fetchedVehicle.licensePlate || fetchedVehicle.vin})` : formData.vehicle_vin}
                    disabled
                  />
                )}
              </Grid>
              {!hideMechanicSelection && (
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label={t('auth.city')} value={mechanicCity} onChange={handleMechanicCityChange} autoComplete="address-level2" />
                </Grid>
              )}
              {(!hideMechanicSelection || (hideMechanicSelection && mechanics.length > 1)) && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth required>
                    <InputLabel>{t('appointment.mechanic')}</InputLabel>
                    <Select id="mechanic_id" name="mechanic_id" value={formData.mechanic_id || ''} onChange={handleMechanicChange} label={t('appointment.mechanic')}>
                      {mechanics.map((mechanic) => <MenuItem key={mechanic.id} value={mechanic.id}>{mechanic.fullName || mechanic.email}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              {hideMechanicSelection && mechanics.length === 1 && (
                 /* Hidden input for single mechanic (current user) to ensure form submission works if needed, 
                    but we already set it in state. We can just hide the UI. */
                 null
              )}
                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    id="service_category"
                    disabled={!formData.mechanic_id || services.length === 0}
                    options={serviceCategories}
                    value={selectedCategory}
                    noOptionsText={t('common.noResults', 'Нічого не знайдено')}
                    onChange={(_, nextCategory) => {
                      setServiceCategoryId(nextCategory ? String(nextCategory.id) : '');
                      setFormData((prev) => ({ ...prev, service_id: null, service_ids: [] }));
                      setServiceSelectOpen(false);
                    }}
                    isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
                    getOptionLabel={(option) => String(option?.name || '')}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={t('services.category')}
                        required
                        placeholder={t('common.search', 'Пошук')}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    id="service_ids"
                    multiple
                    open={serviceSelectOpen}
                    disableCloseOnSelect
                    options={filteredServices}
                    value={selectedServices}
                    disabled={!serviceCategoryId}
                    noOptionsText={t('common.noResults', 'Нічого не знайдено')}
                    onOpen={() => setServiceSelectOpen(true)}
                    onClose={() => setServiceSelectOpen(false)}
                    onChange={(_, values) => handleServiceChange(values.map((service) => String(service.id)))}
                    isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
                    PaperComponent={(props) => (
                      <Paper {...props}>
                        {props.children}
                        <Box
                          sx={{
                            display: 'flex',
                            gap: 1,
                            flexWrap: 'wrap',
                            p: 1,
                            borderTop: (theme) => `1px solid ${theme.palette.divider}`,
                            position: 'sticky',
                            bottom: 0,
                            backgroundColor: 'background.paper',
                            zIndex: 1,
                          }}
                        >
                          <Button
                            size="small"
                            variant="outlined"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleClearServices}
                            disabled={(formData.service_ids || []).length === 0}
                          >
                            {t('common.clear', 'Очистити')}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleDoneServices}
                          >
                            {t('common.done', 'Готово')}
                          </Button>
                          {isNewAppointment && (
                            <Button
                              size="small"
                              variant="contained"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={handleConfirmServices}
                              disabled={(formData.service_ids || []).length === 0}
                            >
                              {servicesConfirmed
                                ? t('appointment.servicesConfirmed', 'Послуги підтверджено')
                                : t('appointment.confirmServices', 'Підтвердити вибір послуг')}
                            </Button>
                          )}
                        </Box>
                      </Paper>
                    )}
                    getOptionLabel={(option) =>
                      `${option?.name || ''}${formatServicePrice(option) ? ` ${formatServicePrice(option)}` : ''}`
                    }
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          label={option?.name || option?.id}
                          size="small"
                          {...getTagProps({ index })}
                          key={option?.id || index}
                        />
                      ))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={t('appointment.serviceType')}
                        placeholder={t('common.search', 'Пошук')}
                        helperText={t('appointment.selectedServicesCount', {
                          defaultValue: 'Обрано: {{count}}',
                          count: (formData.service_ids || []).length,
                        })}
                      />
                    )}
                  />
                </Grid>
                {isMasterUser ? (
                  <Grid item xs={12}>
                    <Button
                      variant="text"
                      size="small"
                      onClick={handleOpenAddService}
                      disabled={!formData.mechanic_id}
                    >
                      {t('services.add', 'Додати послугу')}
                    </Button>
                  </Grid>
                ) : null}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 0, step: 1 }}
                  label={t('services.price', 'Ціна')}
                  name="appointment_price"
                  value={formData.appointment_price}
                  onChange={handleChange}
                  disabled={!isMasterUser}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="number"
                  inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 0, step: 1 }}
                  label={t('services.duration', 'Час (хв)')}
                  name="appointment_duration"
                  value={formData.appointment_duration}
                  onChange={handleChange}
                  disabled={!isMasterUser}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={uk}>
                  <DateTimePicker
                    label={t('appointment.scheduledDate')}
                    value={formData.scheduledDate}
                    onChange={(date) => handleDateChange('scheduledDate', date)}
                    ampm={false}
                    format="dd.MM.yyyy HH:mm"
                    slotProps={{
                      textField: {
                        id: 'scheduledDate',
                        fullWidth: true,
                        required: true,
                      },
                    }}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label={t('appointment.notes')} name="notes" value={formData.notes} onChange={handleChange} multiline rows={3} />
              </Grid>

              {/* Client Parts Section (Only for new appointment) */}
              {isNewAppointment && (
                  <Grid item xs={12}>
                      <Typography variant="h6" gutterBottom>{t('parts.addParts', 'Додати свої запчастини')}</Typography>
                      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: isMobile ? 'stretch' : 'center', flexDirection: isMobile ? 'column' : 'row' }}>
                          <TextField label={t('parts.name')} size={isMobile ? 'medium' : 'small'} value={clientNewPart.name} onChange={(e) => setClientNewPart({...clientNewPart, name: e.target.value})} sx={{ flexGrow: 1 }} fullWidth />
                          <TextField label={t('parts.qty')} size={isMobile ? 'medium' : 'small'} type="number" inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 1, step: 1 }} value={clientNewPart.quantity} onChange={(e) => setClientNewPart({...clientNewPart, quantity: e.target.value})} sx={isMobile ? undefined : { width: 80 }} fullWidth={isMobile} />
                          <TextField label={t('parts.notes')} size={isMobile ? 'medium' : 'small'} value={clientNewPart.notes} onChange={(e) => setClientNewPart({...clientNewPart, notes: e.target.value})} fullWidth />
                          {isMobile ? (
                            <Button variant="contained" onClick={handleAddClientPart} disabled={!clientNewPart.name} startIcon={<AddIcon />} size="large">
                              {t('common.add', 'Додати')}
                            </Button>
                          ) : (
                            <IconButton color="primary" onClick={handleAddClientPart} disabled={!clientNewPart.name}><AddIcon /></IconButton>
                          )}
                      </Box>
                      {clientParts.map(p => (
                          <Chip key={p.id} label={`${p.name} (${p.quantity})`} onDelete={() => handleRemoveClientPart(p.id)} sx={{ mr: 1, mb: 1 }} />
                      ))}
                  </Grid>
              )}

              {!isNewAppointment && appointmentParts.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>{t('parts.usedParts', 'Запчастини')}</Typography>
                  {appointmentParts.map((p) => (
                    <Chip
                      key={p.id}
                      label={`${p.name}${p.quantity ? ` (${p.quantity})` : ''}`}
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </Grid>
              )}

              {!isNewAppointment && formData.status !== 'cancelled' && (
                <Grid item xs={12} ref={chatAnchorRef}>
                  <AppointmentChat
                    appointmentId={id}
                    recipientId={
                      user?.role === 'client'
                        ? formData.mechanic_id
                        : appointmentUserId
                    }
                  />
                </Grid>
              )}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, flexDirection: isMobile ? 'column' : 'row' }}>
                  <Button type="submit" variant="contained" color="primary" disabled={saving || (isNewAppointment && !servicesConfirmed)} size="large" fullWidth={isMobile}>{isNewAppointment ? t('appointment.schedule') : t('common.save')}</Button>
                  {!isNewAppointment && <Button type="button" variant="outlined" color="error" onClick={() => setDeleteDialogOpen(true)} size="large" fullWidth={isMobile}>{t('appointment.cancelAppointment')}</Button>}
                </Box>
              </Grid>
            </Grid>
          </Box>
      </Paper>

      <Dialog open={addServiceDialogOpen} onClose={() => setAddServiceDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('services.add', 'Додати послугу')}</DialogTitle>
        <DialogContent>
          {addServiceError ? <Alert severity="error" sx={{ mb: 2 }}>{addServiceError}</Alert> : null}
          <TextField
            fullWidth
            label={t('services.name', 'Назва')}
            value={addServiceForm.name}
            onChange={(e) => setAddServiceForm((prev) => ({ ...prev, name: e.target.value }))}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            type="number"
            inputProps={{ inputMode: 'decimal' }}
            label={t('services.price', 'Ціна')}
            value={addServiceForm.price}
            onChange={(e) => setAddServiceForm((prev) => ({ ...prev, price: e.target.value }))}
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel id="add-service-category-label">
              {t('services.category', 'Категорія')}
            </InputLabel>
            <Select
              labelId="add-service-category-label"
              value={addServiceForm.category_id}
              label={t('services.category', 'Категорія')}
              onChange={(e) =>
                setAddServiceForm((prev) => ({ ...prev, category_id: e.target.value }))
              }
            >
              <MenuItem value="">
                {t('services.noCategory', 'Без категорії')}
              </MenuItem>
              {addServiceCategories.map((category) => (
                <MenuItem key={category.id} value={String(category.id)}>
                  {category.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            type="number"
            inputProps={{ inputMode: 'numeric', min: 0, step: 1 }}
            label={t('services.duration', 'Час (хв)')}
            value={addServiceForm.duration}
            onChange={(e) => setAddServiceForm((prev) => ({ ...prev, duration: e.target.value }))}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddServiceDialogOpen(false)} disabled={addServiceSaving}>
            {t('common.cancel', 'Скасувати')}
          </Button>
          <Button onClick={handleCreateService} variant="contained" disabled={addServiceSaving}>
            {t('common.add', 'Додати')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Completion Dialog with OCR */}
      <Dialog open={completionDialogOpen} onClose={() => setCompletionDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('appointment.completeWork')}</DialogTitle>
        <DialogContent>
           <DialogContentText sx={{ mb: 2 }}>{t('appointment.completePrompt')}</DialogContentText>
           <TextField fullWidth label={t('vehicle.mileage')} type="number" inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 0, step: 1 }} value={completionData.completion_mileage} onChange={(e) => setCompletionData({...completionData, completion_mileage: e.target.value})} required margin="normal" />
           <TextField fullWidth label={t('appointment.completionNotes')} multiline rows={2} value={completionData.completion_notes} onChange={(e) => setCompletionData({...completionData, completion_notes: e.target.value})} margin="normal" />
           
           <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, mb: 1 }}>
               <Typography variant="h6">{t('parts.usedParts')}</Typography>
               <Button component="label" startIcon={<CloudUploadIcon />} size="small">
                   {t('parts.importFromImage')}
                   <input type="file" hidden accept="image/*" capture="environment" onChange={handleOcrUpload} />
               </Button>
           </Box>
           {ocrLoading && <LinearProgress sx={{ mb: 1 }} />}
           {ocrPreviewUrl && (
             <Box sx={{ mb: 2, textAlign: 'center' }}>
               <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                 {t('common.preview', 'Попередній перегляд')}
               </Typography>
               <Box
                 component="img"
                 src={ocrPreviewUrl}
                 alt="Preview"
                 sx={{ maxWidth: '100%', maxHeight: 240, borderRadius: 1, objectFit: 'contain' }}
               />
             </Box>
           )}
           
           <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
             <TextField label={t('parts.name')} size="small" value={newPart.name} onChange={(e) => setNewPart({...newPart, name: e.target.value})} sx={{ flexGrow: 1 }} />
             <TextField label={t('parts.price')} size="small" type="number" inputProps={{ inputMode: 'decimal' }} value={newPart.price} onChange={(e) => setNewPart({...newPart, price: e.target.value})} sx={{ width: 100 }} />
             <TextField label={t('parts.qty')} size="small" type="number" inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 1, step: 1 }} value={newPart.quantity} onChange={(e) => setNewPart({...newPart, quantity: e.target.value})} sx={{ width: 80 }} />
             <FormControl size="small" sx={{ width: 150 }}>
               <InputLabel>{t('parts.buyer')}</InputLabel>
               <Select value={newPart.purchased_by} label={t('parts.buyer')} onChange={(e) => setNewPart({...newPart, purchased_by: e.target.value})}>
                 <MenuItem value="owner">{t('parts.owner')}</MenuItem>
                 <MenuItem value="service">{t('parts.service')}</MenuItem>
               </Select>
             </FormControl>
             <IconButton color="primary" onClick={handleAddPart} disabled={!newPart.name}><AddIcon /></IconButton>
           </Box>
           
           {completionData.parts.length > 0 ? (
             <TableContainer component={Paper} variant="outlined">
               <Table size="small">
                 <TableHead><TableRow><TableCell>{t('parts.name')}</TableCell><TableCell>{t('parts.price')}</TableCell><TableCell>{t('parts.qty')}</TableCell><TableCell>{t('parts.buyer')}</TableCell><TableCell></TableCell></TableRow></TableHead>
                 <TableBody>
                   {completionData.parts.map((part) => (
                     <TableRow key={part.id}>
                       <TableCell>{part.name}</TableCell><TableCell>{part.price}</TableCell><TableCell>{part.quantity}</TableCell><TableCell>{part.purchased_by === 'owner' ? t('parts.owner') : t('parts.service')}</TableCell>
                       <TableCell><IconButton size="small" color="error" onClick={() => handleRemovePart(part.id)}><DeleteIcon /></IconButton></TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
             </TableContainer>
           ) : <Typography variant="body2" color="text.secondary">{t('parts.noPartsAdded')}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCompletionDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleConfirmCompletion} variant="contained" color="success">{t('common.complete')}</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('common.confirm')}</DialogTitle>
        <DialogContent><DialogContentText>{t('appointment.confirmDelete')}</DialogContentText></DialogContent>
        <DialogActions><Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button><Button onClick={handleDelete} color="error">{t('common.delete')}</Button></DialogActions>
      </Dialog>
    </>
  );
}

export default AppointmentDetails;
