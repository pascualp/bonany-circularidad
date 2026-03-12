import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { HotelReport, MonthlyData } from '../types';

export const generateHotelPDF = async (report: HotelReport): Promise<Blob> => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // --- Logo ---
  // Using the actual logo image provided by the user via localStorage
  const logoWidth = 60;
  const logoHeight = 25;
  const customLogo = localStorage.getItem('bonany_custom_logo');
  
  if (customLogo) {
    try {
      doc.addImage(customLogo, 'PNG', margin, 10, logoWidth, logoHeight);
    } catch (e) {
      console.error('Error adding custom logo to PDF:', e);
      doc.setFontSize(24);
      doc.setTextColor(12, 110, 180);
      doc.text('Circularidad', margin, 25);
    }
  } else {
    // Fallback if no logo is uploaded
    doc.setFontSize(24);
    doc.setTextColor(12, 110, 180);
    doc.text('Circularidad', margin, 25);
    doc.setFontSize(9);
    doc.setTextColor(235, 100, 20);
    doc.text('(Sube tu logo en la app)', margin, 32);
  }

  // --- Header ---
  let currentY = 20;
  doc.setFontSize(20);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  const titleText = `Informe Circularidad 2025 – ${report.hotelName.toUpperCase()}`;
  
  // Calculate dynamic height for title to prevent overlap
  const titleMaxWidth = pageWidth - 85 - margin;
  const titleLines = doc.splitTextToSize(titleText, titleMaxWidth);
  doc.text(titleLines, 85, currentY);
  
  currentY += (titleLines.length * 8) + 2;
  
  doc.setFontSize(14);
  doc.text(`HOTEL ${report.hotelName.toUpperCase()}`, 85, currentY);

  currentY += 12;

  // --- Annual Summary (Two Columns) ---
  const summaryY = currentY;
  const col1X = 85;
  const col2X = 160; // Moved slightly left to accommodate combined text
  const s = report.total;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumen anual', col1X, summaryY);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  // Row 1
  doc.text(`Total: ${s.total.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`, col1X, summaryY + 7);
  doc.text(`Retornables: ${s.envasesRetornable.toLocaleString('de-DE')} u   |   No retornables: ${s.noRetornable.toLocaleString('de-DE')} u`, col2X, summaryY + 7);
  
  // Row 2
  doc.text(`Producto local: ${s.productoLocal.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`, col1X, summaryY + 14);
  doc.text(`% retornable: ${(s.porcentajeRetornable * 100).toFixed(1).replace('.', ',')}%`, col2X, summaryY + 14);
  
  // Row 3
  doc.text(`% producto local: ${(s.porcentajeLocal * 100).toFixed(1).replace('.', ',')}%`, col1X, summaryY + 21);
  doc.text(`Art. envases no retorno: ${s.articulosNoRetorno.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €  |  %: ${(s.porcentajeArtNoRetorno * 100).toFixed(1).replace('.', ',')}%`, col2X, summaryY + 21);

  currentY = summaryY + 30;

  // Source text
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Fuente: hoja de cálculo (Total / Producto local / % / Envases retornable / No retornable / % / Artículos envases no retorno / %).', 85, currentY);

  currentY += 10;

  // --- Chart Area (Left) ---
  const chartX = margin;
  const chartY = currentY;
  const chartWidth = 75;
  const chartHeight = 65;

  // Find max value for dynamic scaling
  const monthData = report.monthlyData.filter(m => m.mes.toLowerCase() !== 'total');
  const maxValInData = Math.max(...monthData.map(d => Math.max(d.envasesRetornable, d.noRetornable)));
  const maxLocalInData = Math.max(...monthData.map(d => d.productoLocal));
  
  // Round up to nearest 100 or 500 for a clean scale
  const chartScaleMax = maxValInData > 400 ? Math.ceil(maxValInData / 500) * 500 : 400;
  // Round up to nearest 1000 for local product
  const chartScaleMaxLocal = maxLocalInData > 1000 ? Math.ceil(maxLocalInData / 1000) * 1000 : 1000;

  // Chart Title
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('Evolución mensual: Envases y Producto Local', chartX + 15, chartY - 5);

  // Draw Axes
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.line(chartX + 10, chartY, chartX + 10, chartY + chartHeight); // Left Y axis
  doc.line(chartX + chartWidth, chartY, chartX + chartWidth, chartY + chartHeight); // Right Y axis
  doc.line(chartX + 10, chartY + chartHeight, chartX + chartWidth, chartY + chartHeight); // X axis

  // Y Axis Labels (Left - Units)
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  const steps = 8;
  for (let i = 0; i <= chartScaleMax; i += chartScaleMax / steps) {
    const y = chartY + chartHeight - (i / chartScaleMax) * chartHeight;
    doc.text(Math.round(i).toString(), chartX + 8, y + 2, { align: 'right' });
    doc.setDrawColor(220, 220, 220);
    doc.line(chartX + 10, y, chartX + chartWidth, y);
  }
  
  // Y Axis Labels (Right - Euros)
  for (let i = 0; i <= chartScaleMaxLocal; i += chartScaleMaxLocal / steps) {
    const y = chartY + chartHeight - (i / chartScaleMaxLocal) * chartHeight;
    doc.text(Math.round(i).toString() + ' €', chartX + chartWidth + 2, y + 2, { align: 'left' });
  }

  // Y Axis Titles
  doc.saveGraphicsState();
  doc.setFontSize(7);
  doc.text('Unidades', chartX + 2, chartY + chartHeight / 2 + 5, { angle: 90 });
  doc.text('Euros (€)', chartX + chartWidth + 12, chartY + chartHeight / 2 - 5, { angle: 270 });
  doc.restoreGraphicsState();

  // Bars and Lines
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const barGroupWidth = (chartWidth - 15) / 12;
  const singleBarWidth = barGroupWidth * 0.4;
  
  let prevLineX: number | null = null;
  let prevLineY: number | null = null;

  months.forEach((mName, i) => {
    const x = chartX + 12 + i * barGroupWidth;
    const data = monthData.find(d => d.mes.toLowerCase().startsWith(mName.toLowerCase()));
    
    if (data) {
      // Draw Bars
      const hRet = (data.envasesRetornable / chartScaleMax) * chartHeight;
      const hNoRet = (data.noRetornable / chartScaleMax) * chartHeight;

      doc.setFillColor(12, 110, 180); // Blue
      doc.rect(x, chartY + chartHeight - hRet, singleBarWidth, hRet, 'F');
      
      doc.setFillColor(255, 153, 51); // Orange
      doc.rect(x + singleBarWidth, chartY + chartHeight - hNoRet, singleBarWidth, hNoRet, 'F');
      
      // Calculate Line Coordinates
      const lineX = x + singleBarWidth; // Center of the bar group
      const lineY = chartY + chartHeight - (data.productoLocal / chartScaleMaxLocal) * chartHeight;
      
      if (prevLineX !== null && prevLineY !== null) {
        doc.setDrawColor(46, 204, 113); // Emerald green
        doc.setLineWidth(0.5);
        doc.line(prevLineX, prevLineY, lineX, lineY);
      }
      
      // Draw point
      doc.setFillColor(46, 204, 113);
      doc.circle(lineX, lineY, 1, 'F');
      
      prevLineX = lineX;
      prevLineY = lineY;
    }

    doc.setFontSize(6);
    doc.setTextColor(0, 0, 0);
    doc.text(mName, x + singleBarWidth, chartY + chartHeight + 4, { align: 'center' });
  });

  // Legend
  doc.setFillColor(12, 110, 180); doc.rect(chartX + 55, chartY + 2, 3, 2, 'F');
  doc.setFontSize(5); doc.text('Envases Retornable', chartX + 59, chartY + 3.5);
  
  doc.setFillColor(255, 153, 51); doc.rect(chartX + 55, chartY + 5, 3, 2, 'F');
  doc.text('No Retornable', chartX + 59, chartY + 6.5);
  
  doc.setDrawColor(46, 204, 113); doc.setLineWidth(0.5); doc.line(chartX + 55, chartY + 9, chartX + 58, chartY + 9);
  doc.setFillColor(46, 204, 113); doc.circle(chartX + 56.5, chartY + 9, 0.5, 'F');
  doc.text('Producto Local (€)', chartX + 59, chartY + 9.5);

  // --- Table Area (Right) ---
  const tableX = 110;
  const tableY = currentY; // Aligned with chartY

  autoTable(doc, {
    startY: tableY,
    margin: { left: tableX, bottom: 5 },
    tableWidth: pageWidth - tableX - margin,
    head: [['Mes', 'Total', 'Prod. Loc.', '%', 'Ret.', 'No Ret.', '%', 'Art. No Ret.', '%']],
    body: report.monthlyData.map(m => [
      m.mes,
      m.total > 0 ? m.total.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €' : '',
      m.productoLocal > 0 ? m.productoLocal.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €' : '',
      m.porcentajeLocal > 0 ? (m.porcentajeLocal * 100).toFixed(1).replace('.', ',') + '%' : '',
      m.envasesRetornable > 0 ? m.envasesRetornable.toLocaleString('de-DE') : '',
      m.noRetornable > 0 ? m.noRetornable.toLocaleString('de-DE') : '',
      m.porcentajeRetornable > 0 ? (m.porcentajeRetornable * 100).toFixed(1).replace('.', ',') + '%' : '',
      m.articulosNoRetorno > 0 ? m.articulosNoRetorno.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €' : '',
      m.porcentajeArtNoRetorno > 0 ? (m.porcentajeArtNoRetorno * 100).toFixed(1).replace('.', ',') + '%' : ''
    ]),
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 0.8, lineColor: [200, 200, 200], lineWidth: 0.1, overflow: 'linebreak' },
    headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    bodyStyles: { halign: 'right', textColor: [0, 0, 0] },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.row.index === report.monthlyData.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 240];
      }
    }
  });

  // --- Footer ---
  const today = new Date();
  const dateStr = today.toLocaleDateString('es-ES');
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`Circularidad — Informe generado el ${dateStr}`, pageWidth - margin, pageHeight - 10, { align: 'right' });

  return doc.output('blob');
};
