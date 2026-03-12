import * as XLSX from 'xlsx';
import { HotelReport, MonthlyData } from '../types';

export const parseExcelFile = async (file: File): Promise<HotelReport[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const reports: HotelReport[] = [];

        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          // Use defval to ensure empty cells are represented as empty strings
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

          if (!jsonData || jsonData.length === 0) return;

          // Strategy 1: Find header row by keywords
          let headerRowIndex = -1;
          const keywords = ['mes', 'month', 'total', 'importe', 'local', 'retornable', 'envases', 'hotel', 'periodo'];
          
          for (let i = 0; i < Math.min(jsonData.length, 50); i++) {
            const row = jsonData[i];
            if (!Array.isArray(row)) continue;
            const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
            if (keywords.some(k => rowStr.includes(k))) {
              headerRowIndex = i;
              break;
            }
          }

          // Strategy 2: If no header found, look for a row that contains a month name
          if (headerRowIndex === -1) {
            const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
            for (let i = 0; i < Math.min(jsonData.length, 50); i++) {
              const row = jsonData[i];
              if (!Array.isArray(row)) continue;
              if (row.some(c => monthNames.includes(String(c || '').toLowerCase().trim()))) {
                headerRowIndex = Math.max(0, i - 1); // Header is likely the row above
                break;
              }
            }
          }

          // Strategy 3: Fallback to first non-empty row with multiple columns
          if (headerRowIndex === -1) {
            headerRowIndex = jsonData.findIndex(row => Array.isArray(row) && row.filter(c => String(c || '').trim() !== '').length >= 2);
          }

          if (headerRowIndex === -1) return;

          const headers = jsonData[headerRowIndex].map(h => String(h || '').toLowerCase().trim());
          
          const findCol = (keys: string[]) => {
            // Try exact match
            let idx = headers.findIndex(h => keys.some(k => h === k.toLowerCase()));
            if (idx !== -1) return idx;
            // Try partial match
            return headers.findIndex(h => keys.some(k => h.includes(k.toLowerCase())));
          };

          const colMes = findCol(['mes', 'month', 'periodo', 'fecha', 'date', 'hotel', 'periodo']);
          const colTotal = findCol(['total', 'importe', 'suma', 'base', 'monto', 'eur', '€', 'total (€)']);
          const colLocal = findCol(['local', 'proximidad', 'km 0', 'km0', 'proximitat', 'producto local']);
          const colRet = findCol(['retornable', 'envases ret', 'ret (u)', 'retornables', 'vidrio ret', 'ret']);
          const colNoRet = findCol(['no retornable', 'envases no ret', 'no ret (u)', 'no retornables', 'no ret', 'no-ret']);
          const colArtNoRet = findCol(['articulos', 'art. no retorno', 'art no retorno', 'art no ret', 'articulos no retorno', 'art. no ret', 'art no-ret']);

          // Guessing logic for columns if not found
          let finalColMes = colMes !== -1 ? colMes : 0;
          let finalColTotal = colTotal !== -1 ? colTotal : (headers.length > 1 ? 1 : -1);

          const cleanNum = (val: any): number => {
            if (val === undefined || val === null || val === '') return 0;
            if (typeof val === 'number') return val;
            // Remove currency symbols, spaces, and handle european decimals
            const s = String(val)
              .replace(/[€$%\s]/g, '')
              .replace(/\./g, '') // Remove thousands separator (assuming it's dot)
              .replace(',', '.'); // Replace decimal separator
            const n = parseFloat(s);
            return isNaN(n) ? 0 : n;
          };

          const monthlyData: MonthlyData[] = [];

          for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || !Array.isArray(row) || row.length === 0) continue;

            const mesRaw = String(row[finalColMes] || '').trim();
            if (!mesRaw) continue;

            const total = cleanNum(row[finalColTotal]);
            const productoLocal = cleanNum(row[colLocal]);
            const envasesRetornable = Math.round(cleanNum(row[colRet]));
            const noRetornable = Math.round(cleanNum(row[colNoRet]));
            const articulosNoRetorno = cleanNum(row[colArtNoRet]);

            // Skip if it looks like a repeated header or clearly empty data
            if (total === 0 && productoLocal === 0 && envasesRetornable === 0 && noRetornable === 0) {
               const isMonth = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre', 'total', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'].some(m => mesRaw.toLowerCase().includes(m));
               if (!isMonth) continue;
            }

            monthlyData.push({
              mes: mesRaw,
              total,
              productoLocal,
              porcentajeLocal: total > 0 ? productoLocal / total : 0,
              envasesRetornable,
              noRetornable,
              porcentajeRetornable: (envasesRetornable + noRetornable) > 0 ? envasesRetornable / (envasesRetornable + noRetornable) : 0,
              articulosNoRetorno,
              porcentajeArtNoRetorno: total > 0 ? articulosNoRetorno / total : 0
            });
          }

          if (monthlyData.length > 0) {
            // Find or calculate total row
            const existingTotalRow = monthlyData.find(m => m.mes.toLowerCase().includes('total'));
            let totalRow: MonthlyData;

            if (existingTotalRow) {
              totalRow = { ...existingTotalRow };
            } else {
              const monthsOnly = monthlyData.filter(m => !m.mes.toLowerCase().includes('total'));
              totalRow = {
                mes: 'TOTAL',
                total: monthsOnly.reduce((a, b) => a + b.total, 0),
                productoLocal: monthsOnly.reduce((a, b) => a + b.productoLocal, 0),
                porcentajeLocal: 0,
                envasesRetornable: monthsOnly.reduce((a, b) => a + b.envasesRetornable, 0),
                noRetornable: monthsOnly.reduce((a, b) => a + b.noRetornable, 0),
                porcentajeRetornable: 0,
                articulosNoRetorno: monthsOnly.reduce((a, b) => a + b.articulosNoRetorno, 0),
                porcentajeArtNoRetorno: 0
              };
              monthlyData.push(totalRow);
            }

            // Ensure percentages are correct for the total row
            totalRow.porcentajeLocal = totalRow.total > 0 ? totalRow.productoLocal / totalRow.total : 0;
            totalRow.porcentajeRetornable = (totalRow.envasesRetornable + totalRow.noRetornable) > 0 ? totalRow.envasesRetornable / (totalRow.envasesRetornable + totalRow.noRetornable) : 0;
            totalRow.porcentajeArtNoRetorno = totalRow.total > 0 ? totalRow.articulosNoRetorno / totalRow.total : 0;

            reports.push({
              hotelName: sheetName,
              monthlyData,
              total: totalRow
            });
          }
        });

        resolve(reports);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};
