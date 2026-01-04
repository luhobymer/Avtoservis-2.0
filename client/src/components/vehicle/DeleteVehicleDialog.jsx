import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button
} from '@mui/material';

const DeleteVehicleDialog = ({ open, onClose, onConfirm }) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{t('common.confirm')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('vehicle.deleteConfirmation', 'Ви впевнені, що хочете видалити цей автомобіль? Це також видалить всі записи про обслуговування, пов\'язані з цим автомобілем.')}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button onClick={onConfirm} color="error" autoFocus>
          {t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteVehicleDialog;
