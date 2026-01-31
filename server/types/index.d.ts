declare namespace Express {
  export interface Request {
    user?: {
      id: string;
      email: string;
      role: 'admin' | 'mechanic' | 'client' | 'master';
    };
  }
}

interface ServiceStation {
  id: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  working_hours?: {
    [key: string]: {
      open: string;
      close: string;
    } | null;
  };
  description?: string;
  created_at: string;
  updated_at: string;
}

interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  duration: number;
  station_id: string;
  created_at: string;
  updated_at: string;
}

interface Mechanic {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  specialization?: string;
  station_id: string;
  created_at: string;
  updated_at: string;
}

interface Vehicle {
  id: string;
  user_id: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  color?: string;
  license_plate?: string;
  mileage?: number;
  created_at: string;
  updated_at: string;
}

interface Appointment {
  id: string;
  user_id: string;
  vehicle_id: string;
  service_id: string;
  mechanic_id?: string;
  station_id: string;
  scheduled_time: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
  completion_notes?: string;
  created_at: string;
  updated_at: string;
}

interface ServiceHistory {
  id: string;
  vehicle_id: string;
  appointment_id?: string;
  service_type: string;
  mileage?: number;
  service_date: string;
  description?: string;
  cost?: number;
  mechanic_id?: string;
  created_at: string;
  updated_at: string;
}

export {
  ServiceStation,
  Service,
  Mechanic,
  Vehicle,
  Appointment,
  ServiceHistory
};
