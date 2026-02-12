import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import { Navigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
  Box,
  Divider,
  Tabs,
  Tab
} from '@mui/material';

// Admin components
import DashboardStats from '../components/admin/DashboardStats';
import UsersManagement from '../components/admin/UsersManagement';
import VehiclesManagement from '../components/admin/VehiclesManagement';
import ServiceRecordsManagement from '../components/admin/ServiceRecordsManagement';
import AppointmentsManagement from '../components/admin/AppointmentsManagement';
import PartsManagement from '../components/admin/PartsManagement';

const AdminPanel = () => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState(0);

  // Redirect if not master-mechanic (єдиний "адмін")
  if (!isAdmin()) {
    return <Navigate to="/" />;
  }

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          {t('admin.title')}
        </Typography>
        <Divider sx={{ mb: 3 }} />
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="admin tabs">
            <Tab label={t('admin.dashboard')} id="tab-0" />
            <Tab label={t('admin.users')} id="tab-1" />
            <Tab label={t('admin.vehicles')} id="tab-2" />
            <Tab label={t('admin.appointments')} id="tab-3" />
            <Tab label={t('admin.serviceRecords')} id="tab-4" />
            <Tab label={t('admin.parts')} id="tab-5" />
          </Tabs>
        </Box>
        
        {/* Tab Panels */}
        <div role="tabpanel" hidden={activeTab !== 0}>
          {activeTab === 0 && <DashboardStats />}
        </div>
        
        <div role="tabpanel" hidden={activeTab !== 1}>
          {activeTab === 1 && <UsersManagement />}
        </div>
        
        <div role="tabpanel" hidden={activeTab !== 2}>
          {activeTab === 2 && <VehiclesManagement />}
        </div>
        
        <div role="tabpanel" hidden={activeTab !== 3}>
          {activeTab === 3 && <AppointmentsManagement />}
        </div>
        
        <div role="tabpanel" hidden={activeTab !== 4}>
          {activeTab === 4 && <ServiceRecordsManagement />}
        </div>
        
        <div role="tabpanel" hidden={activeTab !== 5}>
          {activeTab === 5 && <PartsManagement />}
        </div>
      </Paper>
    </Container>
  );
};

export default AdminPanel;
