import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Typography,
  Alert,
  Snackbar
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { listAll as listParts, create as createPart, updateById as updatePart, deleteById as deletePart } from '../../api/dao/partsDao';

const PartsManagement = () => {
  const { t } = useTranslation();
  const [parts, setParts] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedPart, setSelectedPart] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    article: '',
    manufacturer: '',
    price: '',
    warranty_period: ''
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const fetchParts = useCallback(async () => {
    try {
      const data = await listParts();
      setParts(data);
    } catch (error) {
      showSnackbar(t('parts.fetch_error'), 'error');
    }
  }, [t]);

  useEffect(() => {
    fetchParts();
  }, [t, fetchParts]);

  const handleOpenDialog = (part = null) => {
    setSelectedPart(part);
    setFormData(part || {
      name: '',
      article: '',
      manufacturer: '',
      price: '',
      warranty_period: ''
    });
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedPart(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    try {
      if (selectedPart) {
        await updatePart(selectedPart.id, formData);
      } else {
        await createPart(formData);
      }
      showSnackbar(t(selectedPart ? 'parts.updated' : 'parts.created'), 'success');
      handleCloseDialog();
      fetchParts();
    } catch (error) {
      showSnackbar(t('parts.save_error'), 'error');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('parts.confirm_delete'))) {
      try {
        await deletePart(id);
        showSnackbar(t('parts.deleted'), 'success');
        fetchParts();
      } catch (error) {
        showSnackbar(t('parts.delete_error'), 'error');
      }
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <Typography variant="h6">{t('parts.title')}</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          {t('parts.add_new')}
        </Button>
      </div>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>{t('parts.name')}</TableCell>
              <TableCell>{t('parts.article')}</TableCell>
              <TableCell>{t('parts.manufacturer')}</TableCell>
              <TableCell>{t('parts.price')}</TableCell>
              <TableCell>{t('parts.warranty_period')}</TableCell>
              <TableCell>{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {parts.map((part) => (
              <TableRow key={part.id}>
                <TableCell>{part.name}</TableCell>
                <TableCell>{part.article}</TableCell>
                <TableCell>{part.manufacturer}</TableCell>
                <TableCell>{part.price}</TableCell>
                <TableCell>{part.warranty_period}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpenDialog(part)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(part.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>
          {selectedPart ? t('parts.edit') : t('parts.add_new')}
        </DialogTitle>
        <DialogContent>
          <TextField
            name="name"
            label={t('parts.name')}
            value={formData.name}
            onChange={handleInputChange}
            fullWidth
            margin="normal"
          />
          <TextField
            name="article"
            label={t('parts.article')}
            value={formData.article}
            onChange={handleInputChange}
            fullWidth
            margin="normal"
          />
          <TextField
            name="manufacturer"
            label={t('parts.manufacturer')}
            value={formData.manufacturer}
            onChange={handleInputChange}
            fullWidth
            margin="normal"
          />
          <TextField
            name="price"
            label={t('parts.price')}
            type="number"
            value={formData.price}
            onChange={handleInputChange}
            fullWidth
            margin="normal"
          />
          <TextField
            name="warranty_period"
            label={t('parts.warranty_period')}
            type="number"
            value={formData.warranty_period}
            onChange={handleInputChange}
            fullWidth
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} variant="contained">
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default PartsManagement;
