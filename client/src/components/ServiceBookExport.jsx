import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
const baseUrl = import.meta.env.VITE_API_BASE_URL || '';

const resolveUrl = (url) => (url.startsWith('http') ? url : `${baseUrl}${url}`);

/**
 * Component for exporting service records to PDF
 * @param {Object} props
 * @param {Array} props.records - Array of service records to export
 * @param {Object} props.vehicle - Vehicle object (optional)
 */
const ServiceBookExport = ({ records, vehicle }) => {
  const { t } = useTranslation();

  const extractFilename = (disposition, fallback) => {
    if (!disposition) return fallback;
    const match = disposition.match(/filename="([^"]+)"/) || disposition.match(/filename=([^;]+)/);
    if (match && match[1]) return match[1];
    return fallback;
  };

  const generatePDF = async () => {
    const vehicleVin =
      vehicle?.vin ||
      vehicle?.vehicle_vin ||
      records?.[0]?.vehicleVin ||
      records?.[0]?.vehicle_vin ||
      records?.[0]?.vin ||
      '';
    if (!vehicleVin) {
      window.alert(t('serviceRecord.exportError', 'Не вдалося сформувати PDF'));
      return;
    }

    const token = localStorage.getItem('auth_token');
    const response = await fetch(
      resolveUrl(`/api/reports/service-history/${encodeURIComponent(vehicleVin)}`),
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      }
    );

    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;
      try {
        const errorBody = await response.json();
        if (errorBody && typeof errorBody.message === 'string') {
          message = errorBody.message;
        }
      } catch (error) {
        void error;
      }
      window.alert(message);
      return;
    }

    const blob = await response.blob();
    const fallbackName = `service-book-${vehicleVin}.pdf`;
    const filename = extractFilename(response.headers.get('content-disposition'), fallbackName);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };
  
  return (
    <Button
      variant="outlined"
      color="primary"
      startIcon={<PictureAsPdfIcon />}
      onClick={generatePDF}
      sx={{ ml: 1 }}
    >
      {t('serviceRecord.exportPdf')}
    </Button>
  );
};

export default ServiceBookExport;
