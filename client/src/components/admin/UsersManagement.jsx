import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as usersDao from '../../api/dao/usersDao';
import {
  Typography,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Box,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip
} from '@mui/material';

const UsersManagement = () => {
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'client',
    password: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await usersDao.list();
      setUsers(data);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (user = null) => {
    if (user) {
      setSelectedUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        password: ''
      });
    } else {
      setSelectedUser(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        role: 'client',
        password: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async () => {
    try {
      if (selectedUser) {
        const updatePayload = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: formData.role
        };
        await usersDao.update(selectedUser.id, updatePayload);
      } else {
        if (!formData.password || String(formData.password).length < 6) {
          setError(t('auth.passwordMin', 'Пароль повинен містити щонайменше 6 символів'));
          return;
        }
        await usersDao.create({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          role: formData.role,
          password: formData.password
        });
      }
      fetchUsers();
      handleCloseDialog();
    } catch (err) {
      setError(err.message || 'Failed to save user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm(t('admin.confirmDelete'))) {
      try {
        await usersDao.remove(userId);
        fetchUsers();
      } catch (err) {
        setError(err.message || 'Failed to delete user');
      }
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" gutterBottom>
          {t('admin.users')}
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={() => handleOpenDialog()}
        >
          {t('admin.addUser')}
        </Button>
      </Box>
      <Divider sx={{ mb: 3 }} />
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {users.length === 0 ? (
        <Alert severity="info">{t('admin.noUsers')}</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('auth.name')}</TableCell>
                <TableCell>{t('auth.email')}</TableCell>
                <TableCell>{t('auth.phone')}</TableCell>
                <TableCell>{t('auth.role')}</TableCell>
                <TableCell align="right">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone}</TableCell>
                  <TableCell>
                    <Chip 
                      label={user.role === 'master' ? t('user.master') : t('user.client')}
                      color={user.role === 'master' ? 'primary' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button 
                      size="small" 
                      onClick={() => handleOpenDialog(user)}
                      sx={{ mr: 1 }}
                    >
                      {t('common.edit')}
                    </Button>
                    <Button 
                      size="small" 
                      color="error" 
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      {t('common.delete')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      
      {/* User Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>
          {selectedUser ? t('admin.editUser') : t('admin.addUser')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {selectedUser ? t('admin.editUserDesc') : t('admin.addUserDesc')}
          </DialogContentText>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('auth.name')}
                name="name"
                value={formData.name}
                onChange={handleChange}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('auth.email')}
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                margin="normal"
                disabled={!!selectedUser} // Email can't be changed for existing users
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={t('auth.phone')}
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                margin="normal"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth margin="normal">
                <InputLabel>{t('auth.role')}</InputLabel>
                <Select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  label={t('auth.role')}
                >
                  <MenuItem value="client">{t('user.client')}</MenuItem>
                  <MenuItem value="master">{t('user.master')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {!selectedUser && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label={t('auth.password')}
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  margin="normal"
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} variant="contained">
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default UsersManagement;
