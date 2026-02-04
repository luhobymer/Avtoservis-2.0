import { lazy } from 'react';

// Адмін панель
export const AdminPanel = lazy(() => import('../pages/AdminPanel'));
export const UsersManagement = lazy(() => import('../components/admin/UsersManagement'));
export const ServiceRecordsManagement = lazy(() => import('../components/admin/ServiceRecordsManagement'));
export const AppointmentsManagement = lazy(() => import('../components/admin/AppointmentsManagement'));

// Експорт документів
export const ServiceBookExport = lazy(() => import('../components/ServiceBookExport'));

// Статистика та графіки
export const DashboardStats = lazy(() => import('../components/admin/DashboardStats'));

// Важкі компоненти
export const VehicleDetails = lazy(() => import('../pages/VehicleDetails'));
export const ServiceRecordDetails = lazy(() => import('../pages/ServiceRecordDetails'));
export const AppointmentDetails = lazy(() => import('../pages/AppointmentDetails'));
export const MyParts = lazy(() => import('../pages/MyParts'));
