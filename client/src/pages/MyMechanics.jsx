import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  IconButton,
  Chip,
  Box,
  CircularProgress,
  Alert,
  Divider,
  Checkbox,
  ListItemIcon
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import useAuth from '../context/useAuth';

// Mock API calls (replace with real ones later or move to dao)
const api = {
  getMyMechanics: async () => {
    const token = localStorage.getItem('auth_token');
    const res = await fetch('/api/relationships/mechanics', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  },
  searchMasters: async (city, name) => {
    const token = localStorage.getItem('auth_token');
    const params = new URLSearchParams();
    if (city) params.append('city', city);
    if (name) params.append('name', name);
    
    const res = await fetch(`/api/relationships/search-masters?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  },
  inviteMechanic: async (mechanicId) => {
    const token = localStorage.getItem('auth_token');
    const res = await fetch('/api/relationships/invite', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ mechanic_id: mechanicId })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to invite');
    }
    return res.json();
  }
};

const MyMechanics = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [mechanics, setMechanics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [searchCity, setSearchCity] = useState(user?.city || '');
  const [searchName, setSearchName] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedMechanics, setSelectedMechanics] = useState([]);

  const fetchMechanics = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getMyMechanics();
      // Ensure data is an array
      setMechanics(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError('Failed to load mechanics');
      setMechanics([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    try {
      setSearchLoading(true);
      const results = await api.searchMasters(searchCity, searchName);

      const currentMechanics = Array.isArray(mechanics) ? mechanics : [];
      const existingIds = new Set(currentMechanics.map((m) => m.mechanic_id));
      const resultsArray = Array.isArray(results) ? results : [];

      setSearchResults(resultsArray.filter((r) => !existingIds.has(r.id)));
    } catch (err) {
      console.error(err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [mechanics, searchCity, searchName]);

  useEffect(() => {
    fetchMechanics();
  }, [fetchMechanics]);

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
        if (openDialog) {
            handleSearch();
        }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchCity, searchName, openDialog, handleSearch]);

  const handleToggleSelect = (id) => {
    const currentIndex = selectedMechanics.indexOf(id);
    const newChecked = [...selectedMechanics];

    if (currentIndex === -1) {
      newChecked.push(id);
    } else {
      newChecked.splice(currentIndex, 1);
    }
    setSelectedMechanics(newChecked);
  };

  const handleInvite = async () => {
    try {
      await Promise.all(selectedMechanics.map(id => api.inviteMechanic(id)));
      setOpenDialog(false);
      setSelectedMechanics([]);
      fetchMechanics(); // Reload list
    } catch (err) {
      alert(err.message);
    }
  };

  const getStatusChip = (status) => {
    switch (status) {
      case 'accepted':
        return <Chip icon={<CheckCircleIcon />} label={t('status.accepted', 'Підтверджено')} color="success" size="small" />;
      case 'pending':
        return <Chip icon={<PendingIcon />} label={t('status.pending', 'Очікує')} color="warning" size="small" />;
      case 'rejected':
        return <Chip icon={<CancelIcon />} label={t('status.rejected', 'Відхилено')} color="error" size="small" />;
      default:
        return null;
    }
  };

  if (loading) return <Container sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Container>;

  return (
    <Container maxWidth="md" sx={{ mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5">{t('mechanics.title', 'Мої Механіки')}</Typography>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={() => {
                setOpenDialog(true);
                // Auto search on open if city is present
                if (user?.city) handleSearch();
            }}
          >
            {t('mechanics.add', 'Додати механіка')}
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {mechanics.length === 0 ? (
          <Typography color="text.secondary" align="center">
            {t('mechanics.empty', 'У вас ще немає доданих механіків')}
          </Typography>
        ) : (
          <List>
            {mechanics.map((item) => (
              <React.Fragment key={item.id}>
                <ListItem alignItems="flex-start">
                  <ListItemAvatar>
                    <Avatar src={item.avatar_url} alt={item.name}>
                      <PersonIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={item.name || item.email}
                    secondary={
                      <React.Fragment>
                        <Typography component="span" variant="body2" color="text.primary">
                          {item.city}
                        </Typography>
                        {item.phone && ` — ${item.phone}`}
                      </React.Fragment>
                    }
                  />
                  <Box>
                    {getStatusChip(item.status)}
                  </Box>
                </ListItem>
                <Divider variant="inset" component="li" />
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      {/* Add Mechanic Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('mechanics.find', 'Знайти механіка')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, mb: 3, mt: 1 }}>
            <TextField
              label={t('auth.city', 'Місто')}
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('common.name', "Ім'я")}
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              fullWidth
            />
            <IconButton onClick={handleSearch} color="primary">
              <SearchIcon />
            </IconButton>
          </Box>

          {searchLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}><CircularProgress /></Box>
          ) : (
            <List sx={{ maxHeight: 300, overflow: 'auto' }}>
              {searchResults.length > 0 ? searchResults.map((mechanic) => (
                <ListItem key={mechanic.id} button onClick={() => handleToggleSelect(mechanic.id)}>
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={selectedMechanics.indexOf(mechanic.id) !== -1}
                      tabIndex={-1}
                      disableRipple
                    />
                  </ListItemIcon>
                  <ListItemAvatar>
                    <Avatar src={mechanic.avatar_url}><PersonIcon /></Avatar>
                  </ListItemAvatar>
                  <ListItemText 
                    primary={mechanic.name} 
                    secondary={`${mechanic.city || ''} ${mechanic.phone ? `• ${mechanic.phone}` : ''}`} 
                  />
                </ListItem>
              )) : (
                <Typography align="center" color="text.secondary">
                  {t('mechanics.noResults', 'Нікого не знайдено')}
                </Typography>
              )}
            </List>
          )}
          
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
             <Button onClick={() => setOpenDialog(false)} sx={{ mr: 1 }}>{t('common.cancel')}</Button>
             <Button 
               variant="contained" 
               onClick={handleInvite}
               disabled={selectedMechanics.length === 0}
             >
               {t('mechanics.invite', 'Запросити')} ({selectedMechanics.length})
             </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default MyMechanics;
