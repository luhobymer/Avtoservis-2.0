import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

/**
 * Component for exporting service records to PDF
 * @param {Object} props
 * @param {Array} props.records - Array of service records to export
 * @param {Object} props.vehicle - Vehicle object (optional)
 */
const ServiceBookExport = ({ records, vehicle }) => {
  const { t, i18n } = useTranslation();
  
  const generatePDF = () => {
    // Create new PDF document
    const doc = new jsPDF();
    const currentLang = i18n.language;
    
    // Set font for non-latin characters (for Ukrainian and Russian)
    if (currentLang === 'uk' || currentLang === 'ru') {
      doc.addFont('https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf', 'DejaVuSans', 'normal');
      doc.setFont('DejaVuSans');
    }
    
    // Add title
    const title = t('serviceRecord.exportTitle');
    doc.setFontSize(20);
    doc.text(title, 14, 22);
    
    // Add vehicle info if available
    if (vehicle) {
      doc.setFontSize(12);
      doc.text(`${t('vehicle.make')}: ${vehicle.make}`, 14, 32);
      doc.text(`${t('vehicle.model')}: ${vehicle.model}`, 14, 38);
      doc.text(`${t('vehicle.year')}: ${vehicle.year}`, 14, 44);
      doc.text(`${t('vehicle.licensePlate')}: ${vehicle.licensePlate}`, 14, 50);
      doc.text(`${t('vehicle.vin')}: ${vehicle.vin}`, 14, 56);
    }
    
    // Prepare table data
    const tableColumn = [
      t('serviceRecord.serviceDate'),
      t('serviceRecord.serviceType'),
      t('serviceRecord.mileage'),
      t('serviceRecord.performedBy'),
      t('serviceRecord.cost')
    ];
    
    const tableRows = records.map(record => [
      format(new Date(record.serviceDate), 'dd.MM.yyyy'),
      record.serviceType,
      `${record.mileage} km`,
      record.performedBy,
      record.cost.toString()
    ]);
    
    // Generate the table
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: vehicle ? 65 : 30,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 3,
        overflow: 'linebreak',
        halign: 'left'
      },
      headStyles: {
        fillColor: [198, 40, 40], // #c62828 - primary color
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      }
    });
    
    // Add footer with date
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `${t('serviceRecord.exportedOn')} ${format(new Date(), 'dd.MM.yyyy HH:mm')}`,
        14,
        doc.internal.pageSize.height - 10
      );
      doc.text(
        `${t('app.name')} - ${t('serviceRecord.servicebook')}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
      doc.text(
        `${t('common.page')} ${i} / ${pageCount}`,
        doc.internal.pageSize.width - 14,
        doc.internal.pageSize.height - 10,
        { align: 'right' }
      );
    }
    
    // Generate filename
    let filename = 'service-book';
    if (vehicle) {
      filename = `service-book-${vehicle.make}-${vehicle.model}-${vehicle.licensePlate}`.replace(/\s+/g, '-').toLowerCase();
    }
    
    // Save the PDF
    doc.save(`${filename}.pdf`);
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