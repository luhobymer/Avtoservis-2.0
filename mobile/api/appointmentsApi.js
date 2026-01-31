import {
  getAllAppointments,
  getAppointmentById,
  createAppointment as serviceCreateAppointment,
  updateAppointment as serviceUpdateAppointment,
  cancelAppointment as serviceCancelAppointment,
} from './appointmentsService';

export const getUserAppointments = async (token) => {
  return getAllAppointments(token);
};

export const getAppointmentDetails = async (appointmentId, token) => {
  return getAppointmentById(appointmentId, token);
};

export const createAppointment = async (appointmentData, token) => {
  return serviceCreateAppointment(appointmentData, token);
};

export const updateAppointment = async (appointmentId, appointmentData, token) => {
  return serviceUpdateAppointment(appointmentId, appointmentData, token);
};

export const cancelAppointment = async (appointmentId, token) => {
  return serviceCancelAppointment(appointmentId, null, token);
};
